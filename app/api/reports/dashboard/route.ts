import { getReportDashboardCached } from "@/data/reports";
import { resolveSummaryMonth } from "@/data/reports-shared";
import { resolveReportRouteContext } from "@/lib/reports-route-helpers";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
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

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    year: requestUrl.searchParams.get("year") ?? undefined,
    month: requestUrl.searchParams.get("month") ?? undefined,
    barbershopId: requestUrl.searchParams.get("barbershopId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 },
    );
  }

  const resolved = await resolveReportRouteContext({
    year: parsedQuery.data.year,
    month: parsedQuery.data.month,
    barbershopId: parsedQuery.data.barbershopId,
  });

  if (!resolved.ok) {
    return resolved.response;
  }

  const { barbershopId, year, month } = resolved.context;
  const summaryMonth = resolveSummaryMonth({
    year,
    requestedMonth: month,
  });

  const data = await getReportDashboardCached({
    barbershopId,
    year,
    summaryMonth,
  });

  return NextResponse.json(data, { status: 200 });
}
