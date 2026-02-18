import type { Prisma } from "@/generated/prisma/client";
import { isValidE164Phone } from "@/lib/phone-normalization";
import {
  getNotificationFeatureBlockReason,
  resolveNotificationSettings,
} from "@/lib/notifications/notification-gating";
import { prisma } from "@/lib/prisma";

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

type DbClient = Prisma.TransactionClient | typeof prisma;

const resolveDbClient = (tx?: Prisma.TransactionClient): DbClient => {
  return tx ?? prisma;
};

const getBookingStartDate = (booking: { startAt: Date | null; date: Date }) => {
  return booking.startAt ?? booking.date;
};

const isBookingConfirmedForNotifications = (booking: {
  paymentMethod: "STRIPE" | "IN_PERSON";
  paymentStatus: "PENDING" | "PAID" | "FAILED";
  stripeChargeId: string | null;
}) => {
  if (booking.paymentMethod === "IN_PERSON") {
    return true;
  }

  if (booking.paymentStatus === "PAID") {
    return true;
  }

  return Boolean(booking.stripeChargeId);
};

export const scheduleBookingNotificationJobs = async (
  bookingId: string,
  tx?: Prisma.TransactionClient,
) => {
  const dbClient = resolveDbClient(tx);
  const normalizedBookingId = bookingId.trim();

  if (!normalizedBookingId) {
    return { createdCount: 0 };
  }

  const booking = await dbClient.booking.findUnique({
    where: {
      id: normalizedBookingId,
    },
    select: {
      id: true,
      barbershopId: true,
      paymentMethod: true,
      paymentStatus: true,
      stripeChargeId: true,
      cancelledAt: true,
      startAt: true,
      date: true,
      user: {
        select: {
          phone: true,
        },
      },
      barbershop: {
        select: {
          plan: true,
          whatsappEnabled: true,
          whatsappProvider: true,
          whatsappSettings: {
            select: {
              sendBookingConfirmation: true,
              sendReminder24h: true,
              sendReminder1h: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    return { createdCount: 0 };
  }

  if (booking.cancelledAt) {
    return { createdCount: 0 };
  }

  if (!isBookingConfirmedForNotifications(booking)) {
    return { createdCount: 0 };
  }

  if (!isValidE164Phone(booking.user.phone)) {
    console.info(
      "[scheduleBookingNotificationJobs] Ignorando agendamento de notificacoes por telefone invalido.",
      {
        bookingId: booking.id,
        userPhone: booking.user.phone,
      },
    );
    return { createdCount: 0 };
  }

  const now = new Date();
  const bookingStartAt = getBookingStartDate(booking);
  const settings = resolveNotificationSettings(booking.barbershop.whatsappSettings);

  const candidates: Array<{
    type: "BOOKING_CONFIRM" | "REMINDER_24H" | "REMINDER_1H";
    scheduledAt: Date;
  }> = [];

  if (
    !getNotificationFeatureBlockReason({
      barbershop: {
        plan: booking.barbershop.plan,
        whatsappEnabled: booking.barbershop.whatsappEnabled,
        whatsappProvider: booking.barbershop.whatsappProvider,
      },
      settings,
      type: "BOOKING_CONFIRM",
    })
  ) {
    candidates.push({
      type: "BOOKING_CONFIRM",
      scheduledAt: now,
    });
  }

  const reminder24hDate = new Date(bookingStartAt.getTime() - 24 * HOUR_IN_MILLISECONDS);
  if (
    reminder24hDate.getTime() > now.getTime() &&
    !getNotificationFeatureBlockReason({
      barbershop: {
        plan: booking.barbershop.plan,
        whatsappEnabled: booking.barbershop.whatsappEnabled,
        whatsappProvider: booking.barbershop.whatsappProvider,
      },
      settings,
      type: "REMINDER_24H",
    })
  ) {
    candidates.push({
      type: "REMINDER_24H",
      scheduledAt: reminder24hDate,
    });
  }

  const reminder1hDate = new Date(bookingStartAt.getTime() - HOUR_IN_MILLISECONDS);
  if (
    reminder1hDate.getTime() > now.getTime() &&
    !getNotificationFeatureBlockReason({
      barbershop: {
        plan: booking.barbershop.plan,
        whatsappEnabled: booking.barbershop.whatsappEnabled,
        whatsappProvider: booking.barbershop.whatsappProvider,
      },
      settings,
      type: "REMINDER_1H",
    })
  ) {
    candidates.push({
      type: "REMINDER_1H",
      scheduledAt: reminder1hDate,
    });
  }

  if (candidates.length === 0) {
    return { createdCount: 0 };
  }

  const createdJobs = await dbClient.notificationJob.createMany({
    data: candidates.map((candidate) => ({
      bookingId: booking.id,
      barbershopId: booking.barbershopId,
      type: candidate.type,
      scheduledAt: candidate.scheduledAt,
    })),
    skipDuplicates: true,
  });

  return {
    createdCount: createdJobs.count,
  };
};

export const cancelPendingBookingNotificationJobs = async (
  bookingId: string,
  reason: string,
  tx?: Prisma.TransactionClient,
) => {
  const dbClient = resolveDbClient(tx);
  const normalizedBookingId = bookingId.trim();

  if (!normalizedBookingId) {
    return { canceledCount: 0 };
  }

  const now = new Date();

  const canceledJobs = await dbClient.notificationJob.updateMany({
    where: {
      bookingId: normalizedBookingId,
      status: "PENDING",
    },
    data: {
      status: "CANCELED",
      canceledAt: now,
      cancelReason: reason,
      lastError: null,
    },
  });

  return {
    canceledCount: canceledJobs.count,
  };
};

export const cancelFuturePendingBarbershopNotificationJobs = async (
  barbershopId: string,
  reason: string,
  tx?: Prisma.TransactionClient,
) => {
  const dbClient = resolveDbClient(tx);
  const normalizedBarbershopId = barbershopId.trim();

  if (!normalizedBarbershopId) {
    return { canceledCount: 0 };
  }

  const now = new Date();

  const canceledJobs = await dbClient.notificationJob.updateMany({
    where: {
      barbershopId: normalizedBarbershopId,
      status: "PENDING",
      scheduledAt: {
        gt: now,
      },
    },
    data: {
      status: "CANCELED",
      canceledAt: now,
      cancelReason: reason,
      lastError: null,
    },
  });

  return {
    canceledCount: canceledJobs.count,
  };
};
