import "server-only";

import { type Prisma } from "@/generated/prisma/client";
import {
  normalizePage,
  normalizePageSize,
} from "@/data/admin/shared";
import { prisma } from "@/lib/prisma";

const ADMIN_BOOKING_LIST_SELECT = {
  id: true,
  stripeSessionId: true,
  stripeChargeId: true,
  paymentMethod: true,
  paymentStatus: true,
  barbershopId: true,
  barberId: true,
  serviceId: true,
  userId: true,
  totalDurationMinutes: true,
  totalPriceInCents: true,
  startAt: true,
  endAt: true,
  paymentConfirmedAt: true,
  date: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  barbershop: {
    select: {
      id: true,
      name: true,
    },
  },
  barber: {
    select: {
      id: true,
      name: true,
    },
  },
  service: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.BookingSelect;

export type AdminBookingStatusFilter =
  | "ALL"
  | "UPCOMING"
  | "PAST"
  | "CANCELLED"
  | "FAILED";

interface AdminListBookingsInput {
  barbershopId?: string;
  status?: AdminBookingStatusFilter;
  startDate?: Date | null;
  endDate?: Date | null;
  page?: number;
  pageSize?: number;
}

export const adminListBookings = async ({
  barbershopId,
  status = "ALL",
  startDate = null,
  endDate = null,
  page,
  pageSize,
}: AdminListBookingsInput = {}) => {
  const normalizedPage = normalizePage(page);
  const normalizedPageSize = normalizePageSize(pageSize, 100, 20);
  const now = new Date();

  const where: Prisma.BookingWhereInput = {};
  const dateFilter: Prisma.DateTimeFilter = {};

  if (barbershopId?.trim()) {
    where.barbershopId = barbershopId.trim();
  }

  if (startDate) {
    dateFilter.gte = startDate;
  }

  if (endDate) {
    dateFilter.lte = endDate;
  }

  if (status === "UPCOMING") {
    where.cancelledAt = null;
    dateFilter.gte = now;
  }

  if (status === "PAST") {
    where.cancelledAt = null;
    dateFilter.lt = now;
  }

  if (status === "CANCELLED") {
    where.cancelledAt = {
      not: null,
    };
  }

  if (status === "FAILED") {
    where.paymentStatus = "FAILED";
  }

  if (
    dateFilter.gte ||
    dateFilter.lte ||
    dateFilter.lt ||
    dateFilter.gt ||
    dateFilter.equals
  ) {
    where.date = dateFilter;
  }

  const [totalCount, items] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      select: ADMIN_BOOKING_LIST_SELECT,
      orderBy: {
        date: "desc",
      },
      skip: (normalizedPage - 1) * normalizedPageSize,
      take: normalizedPageSize,
    }),
  ]);

  return {
    items,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / normalizedPageSize)),
  };
};
