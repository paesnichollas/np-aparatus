import { prisma } from "@/lib/prisma";
import {
  getBookingCurrentMonth,
  getBookingCurrentYear,
  getBookingDateKey,
  getBookingYearBounds,
} from "@/lib/booking-time";
import {
  buildReportRevenueEligibilityWhere,
  buildServiceDateRangeWhere,
  calculateAverageTicket,
  getReportServiceDate,
} from "./reports-shared";

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

export const getBarbershopMonthlySummary = async ({
  barbershopId,
  year,
}: GetBarbershopMonthlySummaryInput): Promise<MonthlySummaryItem[]> => {
  const { start, endExclusive } = getBookingYearBounds(year);

  const bookings = await prisma.booking.findMany({
    where: {
      barbershopId,
      ...buildReportRevenueEligibilityWhere(),
      ...buildServiceDateRangeWhere({
        start,
        endExclusive,
      }),
    },
    select: {
      startAt: true,
      date: true,
      totalPriceInCents: true,
    },
  });

  const monthlySummary = createEmptyMonthlySummary();

  for (const booking of bookings) {
    const bookingDate = getReportServiceDate(booking);
    const month = Number(getBookingDateKey(bookingDate).slice(5, 7));

    if (Number.isNaN(month) || month < 1 || month > 12) {
      continue;
    }

    const targetMonth = monthlySummary[month - 1];

    if (!targetMonth) {
      continue;
    }

    targetMonth.totalBookings += 1;
    targetMonth.revenue += booking.totalPriceInCents ?? 0;
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
      monthSummary.avgTicket = 0;
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
