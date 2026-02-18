import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/rbac";

const requestSchema = z
  .object({
    sendBookingConfirmation: z.boolean().optional(),
    sendReminder24h: z.boolean().optional(),
    sendReminder1h: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Informe ao menos uma configuracao para atualizar.",
  });

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  let ownerUser: Awaited<ReturnType<typeof requireOwner>>;

  try {
    ownerUser = await requireOwner({ onUnauthorized: "throw" });
  } catch {
    return NextResponse.json(
      {
        error: "Nao autorizado.",
      },
      { status: 401 },
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
        error: parsedRequest.error.issues[0]?.message ?? "Dados invalidos.",
      },
      { status: 422 },
    );
  }

  const ownerBarbershop = await prisma.barbershop.findFirst({
    where: {
      ownerId: ownerUser.id,
    },
    select: {
      id: true,
      plan: true,
    },
  });

  if (!ownerBarbershop) {
    return NextResponse.json(
      {
        error: "Barbearia do owner nao encontrada.",
      },
      { status: 404 },
    );
  }

  if (ownerBarbershop.plan !== "PRO") {
    return NextResponse.json(
      {
        code: "FEATURE_NOT_AVAILABLE",
        error: "WhatsApp automatico disponivel apenas no plano PRO.",
      },
      { status: 403 },
    );
  }

  const nextSettings = await prisma.barbershopWhatsAppSettings.upsert({
    where: {
      barbershopId: ownerBarbershop.id,
    },
    update: {
      ...(parsedRequest.data.sendBookingConfirmation !== undefined
        ? {
            sendBookingConfirmation: parsedRequest.data.sendBookingConfirmation,
          }
        : {}),
      ...(parsedRequest.data.sendReminder24h !== undefined
        ? {
            sendReminder24h: parsedRequest.data.sendReminder24h,
          }
        : {}),
      ...(parsedRequest.data.sendReminder1h !== undefined
        ? {
            sendReminder1h: parsedRequest.data.sendReminder1h,
          }
        : {}),
    },
    create: {
      barbershopId: ownerBarbershop.id,
      sendBookingConfirmation: parsedRequest.data.sendBookingConfirmation ?? true,
      sendReminder24h: parsedRequest.data.sendReminder24h ?? true,
      sendReminder1h: parsedRequest.data.sendReminder1h ?? true,
    },
    select: {
      sendBookingConfirmation: true,
      sendReminder24h: true,
      sendReminder1h: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      settings: nextSettings,
    },
    { status: 200 },
  );
}
