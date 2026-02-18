import { getBarbershopMonthlySummary } from "@/data/reports";
import {
  calculateAverageTicket,
  parseReportYear,
  resolveReportBarbershopIdForRole,
} from "@/data/reports-shared";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .optional(),
  barbershopId: z.string().uuid().optional(),
});

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
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    year: requestUrl.searchParams.get("year") ?? undefined,
    barbershopId: requestUrl.searchParams.get("barbershopId") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        error: "Parametros invalidos.",
      },
      { status: 400 },
    );
  }

  const year = parseReportYear(parsedQuery.data.year);

  if (year === null) {
    return NextResponse.json(
      {
        error: "Ano invalido.",
      },
      { status: 400 },
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
      { status: 401 },
    );
  }

  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return NextResponse.json(
      {
        error: "Acesso negado.",
      },
      { status: 403 },
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

  const barbershopId = resolvedBarbershop.barbershopId;

  const months = await getBarbershopMonthlySummary({
    barbershopId,
    year,
  });
  const totalBookings = months.reduce((sum, month) => sum + month.totalBookings, 0);
  const revenue = months.reduce((sum, month) => sum + month.revenue, 0);
  const averageTicket = calculateAverageTicket(revenue, totalBookings);

  const response = NextResponse.json(
    {
      year,
      barbershopId,
      months,
      totals: {
        totalBookings,
        revenue,
        averageTicket,
      },
    },
    { status: 200 },
  );

  response.headers.set("cache-control", "no-store");
  return response;
}
