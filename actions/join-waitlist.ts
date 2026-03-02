"use server";

import { Prisma } from "@/generated/prisma/client";
import { criticalActionClient } from "@/lib/action-client";
import { getAvailableBookingTimeSlots } from "@/lib/booking-availability";
import { resolveInitialPaymentState } from "@/lib/booking-payment";
import { revalidateBookingSurfaces } from "@/lib/cache-invalidation";
import { getBookingDateKey, parseBookingDateOnly } from "@/lib/booking-time";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.uuid(),
  barberId: z.uuid(),
  serviceId: z.uuid(),
  dateDay: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(["STRIPE", "IN_PERSON"]).optional(),
});

export const joinWaitlist = criticalActionClient
  .inputSchema(inputSchema)
  .action(
    async ({
      parsedInput: { barbershopId, barberId, serviceId, dateDay, paymentMethod },
      ctx: { user },
    }) => {
      const parsedDateDay = parseBookingDateOnly(dateDay);
      if (!parsedDateDay) {
        returnValidationErrors(inputSchema, {
          _errors: ["Dia inválido para fila de espera."],
        });
      }

      const selectedDateKey = getBookingDateKey(parsedDateDay);
      const todayDateKey = getBookingDateKey(new Date());

      if (selectedDateKey < todayDateKey) {
        returnValidationErrors(inputSchema, {
          _errors: ["Não é possível entrar na fila para dias passados."],
        });
      }

      const [barbershop, barber, service] = await Promise.all([
        prisma.barbershop.findUnique({
          where: {
            id: barbershopId,
          },
          select: {
            id: true,
            isActive: true,
            stripeEnabled: true,
          },
        }),
        prisma.barber.findFirst({
          where: {
            id: barberId,
            barbershopId,
          },
          select: {
            id: true,
          },
        }),
        prisma.barbershopService.findFirst({
          where: {
            id: serviceId,
            barbershopId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        }),
      ]);

      if (!barbershop || !barbershop.isActive) {
        returnValidationErrors(inputSchema, {
          _errors: ["Barbearia indisponível para fila de espera."],
        });
      }

      if (!barber) {
        returnValidationErrors(inputSchema, {
          _errors: ["Barbeiro não encontrado para esta barbearia."],
        });
      }

      if (!service) {
        returnValidationErrors(inputSchema, {
          _errors: ["Serviço não encontrado para esta barbearia."],
        });
      }

      const hasExistingActiveEntry = await prisma.waitlistEntry.findFirst({
        where: {
          userId: user.id,
          barbershopId,
          barberId,
          serviceId,
          dateDay: parsedDateDay,
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      });

      if (hasExistingActiveEntry) {
        returnValidationErrors(inputSchema, {
          _errors: ["Você já está na fila de espera para este dia."],
        });
      }

      const availableTimeSlots = await getAvailableBookingTimeSlots({
        barbershopId,
        barberId,
        serviceIds: [serviceId],
        date: parsedDateDay,
      });

      if (availableTimeSlots.length > 0) {
        returnValidationErrors(inputSchema, {
          _errors: ["Ainda há horários disponíveis. Selecione um horário."],
        });
      }

      const initialPaymentState = resolveInitialPaymentState({
        stripeEnabled: barbershop.stripeEnabled,
        requestedPaymentMethod: paymentMethod ?? "IN_PERSON",
        allowStripeCheckout: true,
      });

      try {
        const createdEntry = await prisma.$transaction(async (tx) => {
          const entry = await tx.waitlistEntry.create({
            data: {
              barbershopId,
              barberId,
              serviceId,
              userId: user.id,
              dateDay: parsedDateDay,
              status: "ACTIVE",
              requestedPaymentMethod: initialPaymentState.paymentMethod,
            },
            select: {
              id: true,
              createdAt: true,
            },
          });

          const position = await tx.waitlistEntry.count({
            where: {
              barbershopId,
              barberId,
              serviceId,
              dateDay: parsedDateDay,
              status: "ACTIVE",
              OR: [
                {
                  createdAt: {
                    lt: entry.createdAt,
                  },
                },
                {
                  createdAt: entry.createdAt,
                  id: {
                    lte: entry.id,
                  },
                },
              ],
            },
          });

          return {
            entryId: entry.id,
            position,
            dateDay: selectedDateKey,
          };
        });

        revalidateBookingSurfaces({
          includeHome: false,
          includeOwner: false,
          includeAdmin: false,
        });

        return createdEntry;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          returnValidationErrors(inputSchema, {
            _errors: ["Você já possui uma entrada ativa para este dia."],
          });
        }

        throw error;
      }
    },
  );
