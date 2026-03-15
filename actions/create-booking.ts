"use server";

import { createCustomerBooking } from "@/lib/booking-creation-service";
import { criticalActionClient } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.uuid(),
  serviceId: z.uuid(),
  barberId: z.uuid(),
  date: z.date(),
});

export const createBooking = criticalActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { barbershopId, serviceId, barberId, date }, ctx: { user } }) => {
    const result = await createCustomerBooking({
      barbershopId,
      serviceId,
      barberId,
      date,
      userId: user.id,
    });

    if (!result.ok) {
      returnValidationErrors(inputSchema, {
        _errors: [result.error],
      });
    }

    return prisma.booking.findUniqueOrThrow({
      where: { id: result.bookingId },
    });
  });
