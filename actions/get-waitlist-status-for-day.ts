"use server";

import { protectedActionClient } from "@/lib/action-client";
import { getBookingDateKey } from "@/lib/booking-time";
import {
  computeWaitlistPosition,
  findActiveWaitlistEntry,
  getWaitlistQueueLength,
  parseWaitlistDateDay,
  resolveWaitlistContext,
  WAITLIST_STATUS_INPUT_SCHEMA,
} from "@/lib/waitlist-shared";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";

const defaultWaitlistStatus = {
  isInQueue: false,
  entryId: null as string | null,
  position: null as number | null,
  queueLength: 0,
};

export const getWaitlistStatusForDay = protectedActionClient
  .inputSchema(WAITLIST_STATUS_INPUT_SCHEMA)
  .action(
    async ({
      parsedInput: { barbershopId, barberId, serviceId, dateDay },
      ctx: { user },
    }) => {
      const parsedDateDay = parseWaitlistDateDay(dateDay);

      if (!parsedDateDay) {
        returnValidationErrors(WAITLIST_STATUS_INPUT_SCHEMA, {
          _errors: ["Dia inválido para consulta da fila de espera."],
        });
      }

      const context = await resolveWaitlistContext({
        barbershopId,
        barberId,
        serviceId,
      });

      if (!context || !context.barbershop.isActive) {
        return defaultWaitlistStatus;
      }

      const [entry, queueLength] = await Promise.all([
        findActiveWaitlistEntry(
          user.id,
          barbershopId,
          barberId,
          serviceId,
          parsedDateDay,
        ),
        getWaitlistQueueLength(
          barbershopId,
          barberId,
          serviceId,
          parsedDateDay,
        ),
      ]);

      if (!entry) {
        return defaultWaitlistStatus;
      }

      const position = await computeWaitlistPosition(
        prisma,
        barbershopId,
        barberId,
        serviceId,
        parsedDateDay,
        entry,
      );

      return {
        isInQueue: true,
        entryId: entry.id,
        position,
        queueLength,
        dateDay: getBookingDateKey(parsedDateDay),
      };
    },
  );
