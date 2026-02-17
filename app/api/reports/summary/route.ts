import {
  aggregateReportMetrics,
  getMonthlyReportRanges,
  getWeeklyReportRanges,
  getYearlyReportRanges,
  parseReportMonth,
  parseReportYear,
  resolveReportBarbershopIdForRole,
  resolveSummaryMonth,
  toRangeResponse,
} from "@/data/reports-shared";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  period: z.enum(["week", "month", "year"]),
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .optional(),
  month: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/)
    .optional(),
  barbershopId: z.string().uuid().optional(),
});

const calculateDeltaPercent = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Nao autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  const requestUrl = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    period: requestUrl.searchParams.get("period") ?? undefined,
    year: requestUrl.searchParams.get("year") ?? undefined,
    month: requestUrl.searchParams.get("month") ?? undefined,
    barbershopId: requestUrl.searchParams.get("barbershopId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: "Parametros invalidos.",
      },
      {
        status: 400,
      },
    );
  }

  const year = parseReportYear(parsedQuery.data.year);

  if (year === null) {
    return NextResponse.json(
      {
        error: "Ano invalido.",
      },
      {
        status: 400,
      },
    );
  }

  const requestedMonth = parseReportMonth(parsedQuery.data.month);

  if (parsedQuery.data.month && requestedMonth === null) {
    return NextResponse.json(
      {
        error: "Mes invalido.",
      },
      {
        status: 400,
      },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: "Nao autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return NextResponse.json(
      {
        error: "Acesso negado.",
      },
      {
        status: 403,
      },
    );
  }

  const resolvedBarbershop = await resolveReportBarbershopIdForRole({
    userId: user.id,
    role: user.role,
    requestedBarbershopId: parsedQuery.data.barbershopId,
  });

  if (!resolvedBarbershop.ok) {
    return NextResponse.json(
      {
        error: resolvedBarbershop.error,
      },
      {
        status: resolvedBarbershop.status,
      },
    );
  }

  const period = parsedQuery.data.period;
  let ranges: ReturnType<typeof getWeeklyReportRanges> | null = null;

  if (period === "week") {
    ranges = getWeeklyReportRanges();
  } else if (period === "month") {
    const month = resolveSummaryMonth({
      year,
      requestedMonth,
    });

    ranges = getMonthlyReportRanges(year, month);
  } else {
    ranges = getYearlyReportRanges(year);
  }

  if (!ranges) {
    return NextResponse.json(
      {
        error: "Periodo invalido para gerar o relatorio.",
      },
      {
        status: 400,
      },
    );
  }

  const [current, previous] = await Promise.all([
    aggregateReportMetrics({
      barbershopId: resolvedBarbershop.barbershopId,
      range: ranges.current,
    }),
    aggregateReportMetrics({
      barbershopId: resolvedBarbershop.barbershopId,
      range: ranges.previous,
    }),
  ]);

  const response = NextResponse.json(
    {
      current: {
        ...current,
        ...toRangeResponse(ranges.current),
      },
      previous: {
        ...previous,
        ...toRangeResponse(ranges.previous),
      },
      delta: {
        bookingsPercent: calculateDeltaPercent(
          current.totalBookings,
          previous.totalBookings,
        ),
        revenuePercent: calculateDeltaPercent(current.revenue, previous.revenue),
        ticketPercent: calculateDeltaPercent(current.avgTicket, previous.avgTicket),
      },
    },
    {
      status: 200,
    },
  );

  response.headers.set("cache-control", "no-store");

  return response;
}
