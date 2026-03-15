"use server";

import { getOwnerBarbershopContextByOwnerId } from "@/data/barbershops";
import { protectedActionClient } from "@/lib/action-client";
import { createOwnerBooking as createOwnerBookingService } from "@/lib/booking-creation-service";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const OWNER_BOOKING_RETURN_SELECT = {
  id: true,
  date: true,
  totalPriceInCents: true,
  paymentStatus: true,
  barber: { select: { name: true } },
  services: {
    select: {
      service: {
        select: {
          name: true,
          priceInCents: true,
          durationInMinutes: true,
        },
      },
    },
  },
  barbershop: { select: { name: true, phones: true } },
  user: { select: { name: true, phone: true } },
} as const;

const inputSchema = z.object({
  clientUserId: z.string().trim().min(1, "Cliente inválido."),
  barberId: z.uuid(),
  serviceIds: z.array(z.uuid()).min(1, "Selecione ao menos um serviço."),
  date: z.date(),
});

export const createOwnerBooking = protectedActionClient
  .inputSchema(inputSchema)
  .action(
    async ({
      parsedInput: { clientUserId, barberId, serviceIds, date },
      ctx: { user },
    }) => {
      if (user.role !== "OWNER") {
        returnValidationErrors(inputSchema, {
          _errors: ["Apenas owners podem criar agendamentos manuais."],
        });
      }

      const ownerBarbershop = await getOwnerBarbershopContextByOwnerId(user.id);

      if (!ownerBarbershop) {
        returnValidationErrors(inputSchema, {
          _errors: ["Barbearia do owner não encontrada."],
        });
      }

      const result = await createOwnerBookingService({
        barbershopId: ownerBarbershop.id,
        barberId,
        serviceIds,
        date,
        clientUserId,
      });

      if (!result.ok) {
        returnValidationErrors(inputSchema, {
          _errors: [result.error],
        });
      }

      const createdBooking = await prisma.booking.findUniqueOrThrow({
        where: { id: result.bookingId },
        select: OWNER_BOOKING_RETURN_SELECT,
      });

      return {
        ...createdBooking,
        status: "confirmed" as const,
      };
    },
  );
