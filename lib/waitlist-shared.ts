import { getBookingDateKey, parseBookingDateOnly } from "@/lib/booking-time";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const WAITLIST_DATE_DAY_SCHEMA = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/);

export const WAITLIST_JOIN_INPUT_SCHEMA = z.object({
  barbershopId: z.uuid(),
  barberId: z.uuid(),
  serviceId: z.uuid(),
  dateDay: WAITLIST_DATE_DAY_SCHEMA,
  paymentMethod: z.enum(["STRIPE", "IN_PERSON"]).optional(),
});

export const WAITLIST_STATUS_INPUT_SCHEMA = z.object({
  barbershopId: z.uuid(),
  barberId: z.uuid(),
  serviceId: z.uuid(),
  dateDay: WAITLIST_DATE_DAY_SCHEMA,
});

export type WaitlistJoinInput = z.infer<typeof WAITLIST_JOIN_INPUT_SCHEMA>;
export type WaitlistStatusInput = z.infer<typeof WAITLIST_STATUS_INPUT_SCHEMA>;

export type WaitlistContext = {
  barbershop: { id: string; isActive: boolean; stripeEnabled: boolean };
  barber: { id: string };
  service: { id: string };
};

export const resolveWaitlistContext = async (
  input: Pick<WaitlistJoinInput, "barbershopId" | "barberId" | "serviceId">,
): Promise<WaitlistContext | null> => {
  const [barbershop, barber, service] = await Promise.all([
    prisma.barbershop.findUnique({
      where: { id: input.barbershopId },
      select: { id: true, isActive: true, stripeEnabled: true },
    }),
    prisma.barber.findFirst({
      where: { id: input.barberId, barbershopId: input.barbershopId },
      select: { id: true },
    }),
    prisma.barbershopService.findFirst({
      where: {
        id: input.serviceId,
        barbershopId: input.barbershopId,
        deletedAt: null,
      },
      select: { id: true },
    }),
  ]);

  if (!barbershop || !barber || !service) {
    return null;
  }

  return { barbershop, barber, service };
};

export const parseWaitlistDateDay = (dateDay: string): Date | null =>
  parseBookingDateOnly(dateDay);

export const isWaitlistDateDayInPast = (parsedDateDay: Date): boolean => {
  const selectedDateKey = getBookingDateKey(parsedDateDay);
  const todayDateKey = getBookingDateKey(new Date());
  return selectedDateKey < todayDateKey;
};

export const findActiveWaitlistEntry = async (
  userId: string,
  barbershopId: string,
  barberId: string,
  serviceId: string,
  dateDay: Date,
) => {
  return prisma.waitlistEntry.findFirst({
    where: {
      userId,
      barbershopId,
      barberId,
      serviceId,
      dateDay,
      status: "ACTIVE",
    },
    select: { id: true, createdAt: true },
  });
};

type WaitlistDbClient = Pick<typeof prisma, "waitlistEntry">;

export const computeWaitlistPosition = async (
  tx: WaitlistDbClient,
  barbershopId: string,
  barberId: string,
  serviceId: string,
  dateDay: Date,
  entry: { id: string; createdAt: Date },
): Promise<number> => {
  return tx.waitlistEntry.count({
    where: {
      barbershopId,
      barberId,
      serviceId,
      dateDay,
      status: "ACTIVE",
      OR: [
        { createdAt: { lt: entry.createdAt } },
        {
          createdAt: entry.createdAt,
          id: { lte: entry.id },
        },
      ],
    },
  });
};

export const getWaitlistQueueLength = async (
  barbershopId: string,
  barberId: string,
  serviceId: string,
  dateDay: Date,
) =>
  prisma.waitlistEntry.count({
    where: {
      barbershopId,
      barberId,
      serviceId,
      dateDay,
      status: "ACTIVE",
    },
  });
