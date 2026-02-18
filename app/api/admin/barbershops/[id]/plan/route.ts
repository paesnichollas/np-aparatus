import { NextResponse } from "next/server";
import { z } from "zod";

import { cancelFuturePendingBarbershopNotificationJobs } from "@/lib/notifications/notification-jobs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

const requestSchema = z.object({
  plan: z.enum(["BASIC", "PRO"]),
  whatsappProvider: z.enum(["NONE", "TWILIO"]).optional(),
  whatsappFrom: z.union([z.string().trim().max(60), z.null()]).optional(),
  whatsappEnabled: z.boolean().optional(),
});

const barbershopIdSchema = z.uuid();

const parseBarbershopIdFromUrl = (requestUrl: string) => {
  const url = new URL(requestUrl);
  const match = url.pathname.match(/^\/api\/admin\/barbershops\/([^/]+)\/plan$/);

  if (!match) {
    return null;
  }

  return match[1] ?? null;
};

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    await requireAdmin({ onUnauthorized: "throw" });
  } catch {
    return NextResponse.json(
      {
        error: "Nao autorizado.",
      },
      { status: 401 },
    );
  }

  const rawBarbershopId = parseBarbershopIdFromUrl(request.url);
  const parsedBarbershopId = barbershopIdSchema.safeParse(rawBarbershopId);

  if (!parsedBarbershopId.success) {
    return NextResponse.json(
      {
        error: "Barbearia invalida.",
      },
      { status: 400 },
    );
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Corpo da requisicao invalido.",
      },
      { status: 400 },
    );
  }

  const parsedRequest = requestSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Dados invalidos para atualizar plano da barbearia.",
      },
      { status: 422 },
    );
  }

  const barbershopId = parsedBarbershopId.data;
  const payload = parsedRequest.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingBarbershop = await tx.barbershop.findUnique({
        where: {
          id: barbershopId,
        },
        select: {
          id: true,
          plan: true,
          whatsappProvider: true,
          whatsappFrom: true,
          whatsappEnabled: true,
        },
      });

      if (!existingBarbershop) {
        throw new Error("BARBERSHOP_NOT_FOUND");
      }

      const normalizedWhatsappFrom =
        payload.whatsappFrom === undefined
          ? existingBarbershop.whatsappFrom
          : payload.whatsappFrom?.trim() || null;

      const nextPlan = payload.plan;
      const nextProvider =
        nextPlan === "BASIC"
          ? "NONE"
          : payload.whatsappProvider ?? existingBarbershop.whatsappProvider;
      const nextEnabled =
        nextPlan === "BASIC"
          ? false
          : payload.whatsappEnabled ?? existingBarbershop.whatsappEnabled;

      if (nextPlan === "PRO" && nextEnabled && nextProvider !== "TWILIO") {
        throw new Error("WHATSAPP_PROVIDER_REQUIRED");
      }

      const updatedBarbershop = await tx.barbershop.update({
        where: {
          id: existingBarbershop.id,
        },
        data: {
          plan: nextPlan,
          whatsappProvider: nextProvider,
          whatsappFrom: nextPlan === "BASIC" ? null : normalizedWhatsappFrom,
          whatsappEnabled: nextEnabled,
        },
        select: {
          id: true,
          plan: true,
          whatsappProvider: true,
          whatsappFrom: true,
          whatsappEnabled: true,
        },
      });

      await tx.barbershopWhatsAppSettings.upsert({
        where: {
          barbershopId: existingBarbershop.id,
        },
        update: {},
        create: {
          barbershopId: existingBarbershop.id,
        },
        select: {
          id: true,
        },
      });

      let canceledJobsCount = 0;
      if (existingBarbershop.plan === "PRO" && nextPlan === "BASIC") {
        const canceledJobs = await cancelFuturePendingBarbershopNotificationJobs(
          existingBarbershop.id,
          "plan_downgrade",
          tx,
        );

        canceledJobsCount = canceledJobs.canceledCount;
      }

      return {
        barbershop: updatedBarbershop,
        canceledJobsCount,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "BARBERSHOP_NOT_FOUND") {
      return NextResponse.json(
        {
          error: "Barbearia nao encontrada.",
        },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "WHATSAPP_PROVIDER_REQUIRED") {
      return NextResponse.json(
        {
          error: "Para habilitar WhatsApp no plano PRO, selecione provider TWILIO.",
        },
        { status: 422 },
      );
    }

    console.error("[adminBarbershopPlanPatch] Falha ao atualizar plano.", {
      error,
      barbershopId,
    });

    return NextResponse.json(
      {
        error: "Falha ao atualizar plano da barbearia.",
      },
      { status: 500 },
    );
  }
}
