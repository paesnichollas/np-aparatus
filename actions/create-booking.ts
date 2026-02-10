"use server";

import { protectedActionClient } from "@/lib/action-client";
import { hasMinuteIntervalOverlap, toMinuteOfDay } from "@/lib/booking-interval";
import { prisma } from "@/lib/prisma";
import { endOfDay, isPast, startOfDay } from "date-fns";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  serviceId: z.uuid(),
  date: z.date(),
});

const hasInvalidServiceData = (service: {
  name: string;
  priceInCents: number;
  durationInMinutes: number;
}) => {
  if (service.name.trim().length === 0) {
    return true;
  }

  if (!Number.isInteger(service.priceInCents) || service.priceInCents < 0) {
    return true;
  }

  if (
    !Number.isInteger(service.durationInMinutes) ||
    service.durationInMinutes < 5
  ) {
    return true;
  }

  return false;
};

export const createBooking = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { serviceId, date }, ctx: { user } }) => {
    if (isPast(date)) {
      returnValidationErrors(inputSchema, {
        _errors: ["Data e hora selecionadas já passaram."],
      });
    }

    const service = await prisma.barbershopService.findFirst({
      where: {
        id: serviceId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        priceInCents: true,
        barbershopId: true,
        durationInMinutes: true,
      },
    });

    if (!service) {
      returnValidationErrors(inputSchema, {
        _errors: ["Serviço não encontrado. Por favor, selecione outro serviço."],
      });
    }

    if (hasInvalidServiceData(service)) {
      console.error("[createBooking] Invalid service data.", {
        serviceId,
        service,
      });
      returnValidationErrors(inputSchema, {
        _errors: [
          "Este serviço está temporariamente indisponível para reserva. Tente novamente mais tarde.",
        ],
      });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        barbershopId: service.barbershopId,
        date: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        cancelledAt: null,
      },
      select: {
        date: true,
        service: {
          select: {
            durationInMinutes: true,
          },
        },
      },
    });

    const hasCollision = hasMinuteIntervalOverlap(
      toMinuteOfDay(date),
      service.durationInMinutes,
      bookings.map((booking) => {
        const startMinute = toMinuteOfDay(booking.date);
        return {
          startMinute,
          endMinute: startMinute + booking.service.durationInMinutes,
        };
      }),
    );

    if (hasCollision) {
      returnValidationErrors(inputSchema, {
        _errors: ["Data e hora selecionadas já estão agendadas."],
      });
    }

    const booking = await prisma.booking.create({
      data: {
        serviceId,
        date: date.toISOString(),
        userId: user.id,
        barbershopId: service.barbershopId,
        paymentMethod: "IN_PERSON",
      },
    });

    return booking;
  });
