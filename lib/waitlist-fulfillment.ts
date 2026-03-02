import { Prisma } from "@/generated/prisma/client";
import { resolveInitialPaymentState } from "@/lib/booking-payment";
import { scheduleBookingNotificationJobs } from "@/lib/notifications/notification-jobs";
import { getBookingDateKey, parseBookingDateOnly } from "@/lib/booking-time";
import { prisma } from "@/lib/prisma";

const MAX_FULFILLMENT_ATTEMPTS = 100;

export interface ReleasedSlotInput {
  sourceBookingId: string;
  barbershopId: string;
  barberId: string | null;
  serviceId: string;
  releasedStartAt: Date;
  releasedEndAt?: Date | null;
  releasedDurationMinutes?: number | null;
}

export interface WaitlistFulfillmentResult {
  fulfilled: boolean;
  fulfilledEntryId: string | null;
  fulfilledBookingId: string | null;
  expiredEntriesCount: number;
  skippedReason: string | null;
}

type WaitlistFulfillmentTransaction = Pick<
  Prisma.TransactionClient,
  "waitlistEntry" | "barbershopService" | "booking" | "barbershop"
>;

export const resolveReleasedDurationMinutes = ({
  releasedStartAt,
  releasedEndAt,
  releasedDurationMinutes,
}: {
  releasedStartAt: Date;
  releasedEndAt?: Date | null;
  releasedDurationMinutes?: number | null;
}) => {
  if (
    Number.isInteger(releasedDurationMinutes) &&
    Number(releasedDurationMinutes) > 0
  ) {
    return Number(releasedDurationMinutes);
  }

  if (!releasedEndAt) {
    return null;
  }

  const diffInMinutes = Math.round(
    (releasedEndAt.getTime() - releasedStartAt.getTime()) / 60_000,
  );

  if (!Number.isInteger(diffInMinutes) || diffInMinutes <= 0) {
    return null;
  }

  return diffInMinutes;
};

export const fulfillWaitlistInTransaction = async (
  tx: WaitlistFulfillmentTransaction,
  input: ReleasedSlotInput,
  dependencies: {
    scheduleBookingNotificationJobs: (
      bookingId: string,
      transaction: Prisma.TransactionClient,
    ) => Promise<unknown>;
  } = { scheduleBookingNotificationJobs },
): Promise<WaitlistFulfillmentResult> => {
  if (!input.barberId) {
    return {
      fulfilled: false,
      fulfilledEntryId: null,
      fulfilledBookingId: null,
      expiredEntriesCount: 0,
      skippedReason: "missing-barber",
    };
  }

  const dateDay = parseBookingDateOnly(getBookingDateKey(input.releasedStartAt));
  if (!dateDay) {
    return {
      fulfilled: false,
      fulfilledEntryId: null,
      fulfilledBookingId: null,
      expiredEntriesCount: 0,
      skippedReason: "invalid-day",
    };
  }

  const releasedDurationMinutes = resolveReleasedDurationMinutes({
    releasedStartAt: input.releasedStartAt,
    releasedEndAt: input.releasedEndAt,
    releasedDurationMinutes: input.releasedDurationMinutes,
  });
  if (!releasedDurationMinutes) {
    return {
      fulfilled: false,
      fulfilledEntryId: null,
      fulfilledBookingId: null,
      expiredEntriesCount: 0,
      skippedReason: "invalid-duration",
    };
  }

  let expiredEntriesCount = 0;
  const barbershop = await tx.barbershop.findUnique({
    where: {
      id: input.barbershopId,
    },
    select: {
      stripeEnabled: true,
    },
  });
  const stripeEnabled = barbershop?.stripeEnabled ?? false;

  for (let attempt = 0; attempt < MAX_FULFILLMENT_ATTEMPTS; attempt += 1) {
    const entry = await tx.waitlistEntry.findFirst({
      where: {
        barbershopId: input.barbershopId,
        barberId: input.barberId,
        serviceId: input.serviceId,
        dateDay,
        status: "ACTIVE",
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        userId: true,
        requestedPaymentMethod: true,
      },
    });

    if (!entry) {
      return {
        fulfilled: false,
        fulfilledEntryId: null,
        fulfilledBookingId: null,
        expiredEntriesCount,
        skippedReason: "no-active-entry",
      };
    }

    const service = await tx.barbershopService.findFirst({
      where: {
        id: input.serviceId,
        barbershopId: input.barbershopId,
        deletedAt: null,
      },
      select: {
        durationInMinutes: true,
        priceInCents: true,
      },
    });

    if (!service || service.durationInMinutes !== releasedDurationMinutes) {
      const expiredEntry = await tx.waitlistEntry.updateMany({
        where: {
          id: entry.id,
          status: "ACTIVE",
        },
        data: {
          status: "EXPIRED",
        },
      });

      if (expiredEntry.count === 1) {
        expiredEntriesCount += 1;
      }

      continue;
    }

    const claim = await tx.waitlistEntry.updateMany({
      where: {
        id: entry.id,
        status: "ACTIVE",
      },
      data: {
        status: "FULFILLED",
      },
    });

    if (claim.count === 0) {
      continue;
    }

    const bookingEndAt = new Date(
      input.releasedStartAt.getTime() + service.durationInMinutes * 60_000,
    );
    const initialPaymentState = resolveInitialPaymentState({
      stripeEnabled,
      requestedPaymentMethod: entry.requestedPaymentMethod,
      allowStripeCheckout: true,
    });

    const fulfilledBooking = await tx.booking.create({
      data: {
        serviceId: input.serviceId,
        date: input.releasedStartAt.toISOString(),
        startAt: input.releasedStartAt.toISOString(),
        endAt: bookingEndAt.toISOString(),
        totalDurationMinutes: service.durationInMinutes,
        totalPriceInCents: service.priceInCents,
        userId: entry.userId,
        barberId: input.barberId,
        barbershopId: input.barbershopId,
        paymentMethod: initialPaymentState.paymentMethod,
        paymentStatus: initialPaymentState.paymentStatus,
        services: {
          create: {
            serviceId: input.serviceId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    await tx.waitlistEntry.update({
      where: {
        id: entry.id,
      },
      data: {
        fulfilledBookingId: fulfilledBooking.id,
      },
      select: {
        id: true,
      },
    });

    await dependencies.scheduleBookingNotificationJobs(
      fulfilledBooking.id,
      tx as Prisma.TransactionClient,
    );

    return {
      fulfilled: true,
      fulfilledEntryId: entry.id,
      fulfilledBookingId: fulfilledBooking.id,
      expiredEntriesCount,
      skippedReason: null,
    };
  }

  return {
    fulfilled: false,
    fulfilledEntryId: null,
    fulfilledBookingId: null,
    expiredEntriesCount,
    skippedReason: "max-attempts-reached",
  };
};

export const tryFulfillWaitlistForReleasedSlot = async (
  input: ReleasedSlotInput,
) => {
  if (!input.sourceBookingId.trim()) {
    return {
      fulfilled: false,
      fulfilledEntryId: null,
      fulfilledBookingId: null,
      expiredEntriesCount: 0,
      skippedReason: "missing-source-booking-id",
    } satisfies WaitlistFulfillmentResult;
  }

  return prisma.$transaction((tx) => {
    return fulfillWaitlistInTransaction(tx, input);
  });
};
