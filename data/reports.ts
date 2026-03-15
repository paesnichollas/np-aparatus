import { prisma } from "@/lib/prisma";
import {
  getBookingCurrentMonth,
  getBookingCurrentYear,
  getBookingYearBounds,
} from "@/lib/booking-time";
import { BOOKING_TIMEZONE } from "@/lib/booking-time";
import { calculateAverageTicket } from "./reports-shared";

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export type MonthlySummaryItem = {
  month: number;
  label: (typeof MONTH_LABELS)[number];
  totalBookings: number;
  revenue: number;
  avgTicket: number;
};

interface GetBarbershopMonthlySummaryInput {
  barbershopId: string;
  year: number;
}

const createEmptyMonthlySummary = (): MonthlySummaryItem[] => {
  return MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    totalBookings: 0,
    revenue: 0,
    avgTicket: 0,
  }));
};

type MonthlyAggregateRow = {
  month: number;
  total_bookings: bigint;
  revenue: bigint;
};

export const getBarbershopMonthlySummary = async ({
  barbershopId,
  year,
}: GetBarbershopMonthlySummaryInput): Promise<MonthlySummaryItem[]> => {
  const { start, endExclusive } = getBookingYearBounds(year);

  const rows = await prisma.$queryRaw<MonthlyAggregateRow[]>`
    SELECT
      EXTRACT(MONTH FROM (
        COALESCE("startAt", "date") AT TIME ZONE ${BOOKING_TIMEZONE}
      ))::int AS month,
      COUNT(*)::bigint AS total_bookings,
      COALESCE(SUM("totalPriceInCents"), 0)::bigint AS revenue
    FROM "Booking"
    WHERE "barbershopId" = ${barbershopId}
      AND "cancelledAt" IS NULL
      AND "paymentStatus" = 'PAID'
      AND COALESCE("startAt", "date") >= ${start}
      AND COALESCE("startAt", "date") < ${endExclusive}
    GROUP BY EXTRACT(MONTH FROM (
      COALESCE("startAt", "date") AT TIME ZONE ${BOOKING_TIMEZONE}
    ))
    ORDER BY month
  `;

  const monthlySummary = createEmptyMonthlySummary();

  for (const row of rows) {
    const month = Number(row.month);
    if (Number.isNaN(month) || month < 1 || month > 12) {
      continue;
    }

    const targetMonth = monthlySummary[month - 1];
    if (!targetMonth) {
      continue;
    }

    targetMonth.totalBookings = Number(row.total_bookings);
    targetMonth.revenue = Number(row.revenue);
  }

  const now = new Date();
  if (year === getBookingCurrentYear(now)) {
    const currentMonth = getBookingCurrentMonth(now);

    for (const monthSummary of monthlySummary) {
      if (monthSummary.month <= currentMonth) {
        continue;
      }

      monthSummary.totalBookings = 0;
      monthSummary.revenue = 0;
    }
  }

  for (const monthSummary of monthlySummary) {
    monthSummary.avgTicket = calculateAverageTicket(
      monthSummary.revenue,
      monthSummary.totalBookings,
    );
  }

  return monthlySummary;
};
