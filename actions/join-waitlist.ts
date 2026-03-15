"use server";

import { Prisma } from "@/generated/prisma/client";
import { criticalActionClient } from "@/lib/action-client";
import { getAvailableBookingTimeSlots } from "@/lib/booking-availability";
import { resolveInitialPaymentState } from "@/lib/booking-payment";
import { revalidateBookingSurfaces } from "@/lib/cache-invalidation";
import { getBookingDateKey } from "@/lib/booking-time";
import { prisma } from "@/lib/prisma";
import {
  computeWaitlistPosition,
  findActiveWaitlistEntry,
  isWaitlistDateDayInPast,
  parseWaitlistDateDay,
  resolveWaitlistContext,
  WAITLIST_JOIN_INPUT_SCHEMA,
} from "@/lib/waitlist-shared";
import { returnValidationErrors } from "next-safe-action";

export const joinWaitlist = criticalActionClient
  .inputSchema(WAITLIST_JOIN_INPUT_SCHEMA)
  .action(
    async ({
      parsedInput: { barbershopId, barberId, serviceId, dateDay, paymentMethod },
      ctx: { user },
    }) => {
      const parsedDateDay = parseWaitlistDateDay(dateDay);
      if (!parsedDateDay) {
        returnValidationErrors(WAITLIST_JOIN_INPUT_SCHEMA, {
          _errors: ["Dia inválido para fila de espera."],
        });
      }

      if (isWaitlistDateDayInPast(parsedDateDay)) {
        returnValidationErrors(WAITLIST_JOIN_INPUT_SCHEMA, {
          _errors: ["Não é possível entrar na fila para dias passados."],
        });
      }

      const context = await resolveWaitlistContext({
        barbershopId,
        barberId,
        serviceId,
      });

      if (!context || !context.barbershop.isActive) {
        returnValidationErrors(WAITLIST_JOIN_INPUT_SCHEMA, {
          _errors: ["Barbearia indisponível para fila de espera."],
        });
      }

      const hasExistingActiveEntry = await findActiveWaitlistEntry(
        user.id,
        barbershopId,
        barberId,
        serviceId,
        parsedDateDay,
      );

      if (hasExistingActiveEntry) {
        returnValidationErrors(WAITLIST_JOIN_INPUT_SCHEMA, {
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
        returnValidationErrors(WAITLIST_JOIN_INPUT_SCHEMA, {
          _errors: ["Ainda há horários disponíveis. Selecione um horário."],
        });
      }

      const initialPaymentState = resolveInitialPaymentState({
        stripeEnabled: context.barbershop.stripeEnabled,
        requestedPaymentMethod: paymentMethod ?? "IN_PERSON",
        allowStripeCheckout: true,
      });

      const selectedDateKey = getBookingDateKey(parsedDateDay);

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

          const position = await computeWaitlistPosition(
            tx,
            barbershopId,
            barberId,
            serviceId,
            parsedDateDay,
            entry,
          );

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
          returnValidationErrors(WAITLIST_JOIN_INPUT_SCHEMA, {
            _errors: ["Você já possui uma entrada ativa para este dia."],
          });
        }

        throw error;
      }
    },
  );
