import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getNotificationRetryDate, NOTIFICATION_MAX_ATTEMPTS } from "@/lib/notifications/constants";
import { getNotificationFeatureBlockReason } from "@/lib/notifications/notification-gating";
import { isValidE164Phone } from "@/lib/phone-normalization";
import {
  buildNotificationContentVariables,
  buildNotificationTextBody,
} from "@/lib/whatsapp/notification-template-payload";
import { sendWhatsAppMessage } from "@/lib/whatsapp/whatsapp-service";

const BATCH_SIZE = 30;
const MAX_JOBS_PER_RUN = 180;

const getRequestSecret = (request: Request) => {
  const headerSecret = request.headers.get("x-cron-secret")?.trim();

  if (headerSecret) {
    return headerSecret;
  }

  const authorizationHeader = request.headers.get("authorization")?.trim();
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim() || null;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.slice(0, 900);
  }

  return "Erro desconhecido ao processar notificacao.";
};

const getTwilioFrom = (barbershopFrom: string | null) => {
  const normalizedFrom = barbershopFrom?.trim();

  if (normalizedFrom) {
    return normalizedFrom;
  }

  const defaultFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();

  if (defaultFrom) {
    return defaultFrom;
  }

  throw new Error("Numero remetente do WhatsApp nao configurado.");
};

const markJobAsCanceled = async (
  jobId: string,
  reason: "plan_downgrade" | "feature_disabled" | "booking_canceled",
) => {
  await prisma.notificationJob.update({
    where: {
      id: jobId,
    },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      cancelReason: reason,
      lastError: null,
    },
    select: {
      id: true,
    },
  });
};

const processNotificationJob = async (jobId: string) => {
  const claim = await prisma.notificationJob.updateMany({
    where: {
      id: jobId,
      status: "PENDING",
    },
    data: {
      status: "SENDING",
      lastError: null,
    },
  });

  if (claim.count === 0) {
    return "claim_skipped" as const;
  }

  const job = await prisma.notificationJob.findUnique({
    where: {
      id: jobId,
    },
    select: {
      id: true,
      type: true,
      attempts: true,
      booking: {
        select: {
          id: true,
          cancelledAt: true,
          startAt: true,
          date: true,
          totalPriceInCents: true,
          user: {
            select: {
              name: true,
              phone: true,
            },
          },
          barbershop: {
            select: {
              name: true,
              phones: true,
            },
          },
          barber: {
            select: {
              name: true,
            },
          },
          service: {
            select: {
              name: true,
            },
          },
          services: {
            select: {
              service: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      barbershop: {
        select: {
          plan: true,
          whatsappEnabled: true,
          whatsappProvider: true,
          whatsappFrom: true,
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

  if (!job) {
    return "claim_skipped" as const;
  }

  if (job.booking.cancelledAt) {
    await markJobAsCanceled(job.id, "booking_canceled");
    return "canceled" as const;
  }

  const featureBlockReason = getNotificationFeatureBlockReason({
    barbershop: {
      plan: job.barbershop.plan,
      whatsappEnabled: job.barbershop.whatsappEnabled,
      whatsappProvider: job.barbershop.whatsappProvider,
    },
    settings: job.barbershop.whatsappSettings,
    type: job.type,
  });

  if (featureBlockReason) {
    await markJobAsCanceled(job.id, featureBlockReason);
    return "canceled" as const;
  }

  const destinationPhone = job.booking.user.phone;

  if (!destinationPhone || !isValidE164Phone(destinationPhone)) {
    const nextAttempts = job.attempts + 1;

    await prisma.notificationJob.update({
      where: {
        id: job.id,
      },
      data: {
        attempts: nextAttempts,
        status: nextAttempts >= NOTIFICATION_MAX_ATTEMPTS ? "FAILED" : "PENDING",
        lastError: "Telefone de destino invalido para envio WhatsApp.",
        scheduledAt:
          nextAttempts >= NOTIFICATION_MAX_ATTEMPTS
            ? undefined
            : getNotificationRetryDate(nextAttempts),
      },
      select: {
        id: true,
      },
    });

    return nextAttempts >= NOTIFICATION_MAX_ATTEMPTS ? "failed" : "retried";
  }

  try {
    await sendWhatsAppMessage({
      to: destinationPhone,
      from: getTwilioFrom(job.barbershop.whatsappFrom),
      type: job.type,
      contentVariables: buildNotificationContentVariables({
        type: job.type,
        booking: job.booking,
      }),
      fallbackBody: buildNotificationTextBody({
        type: job.type,
        booking: job.booking,
      }),
    });

    await prisma.notificationJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: null,
        canceledAt: null,
        cancelReason: null,
      },
      select: {
        id: true,
      },
    });

    return "sent" as const;
  } catch (error) {
    const nextAttempts = job.attempts + 1;
    const reachedLimit = nextAttempts >= NOTIFICATION_MAX_ATTEMPTS;

    await prisma.notificationJob.update({
      where: {
        id: job.id,
      },
      data: {
        attempts: nextAttempts,
        status: reachedLimit ? "FAILED" : "PENDING",
        lastError: getErrorMessage(error),
        scheduledAt: reachedLimit ? undefined : getNotificationRetryDate(nextAttempts),
      },
      select: {
        id: true,
      },
    });

    return reachedLimit ? "failed" : "retried";
  }
};

const dispatchNotificationJobs = async () => {
  const summary = {
    scanned: 0,
    sent: 0,
    retried: 0,
    failed: 0,
    canceled: 0,
    claimSkipped: 0,
  };

  while (summary.scanned < MAX_JOBS_PER_RUN) {
    const remaining = MAX_JOBS_PER_RUN - summary.scanned;
    const jobs = await prisma.notificationJob.findMany({
      where: {
        status: "PENDING",
        scheduledAt: {
          lte: new Date(),
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      take: Math.min(BATCH_SIZE, remaining),
      select: {
        id: true,
      },
    });

    if (jobs.length === 0) {
      break;
    }

    for (const job of jobs) {
      const result = await processNotificationJob(job.id);
      summary.scanned += 1;

      if (result === "sent") {
        summary.sent += 1;
      } else if (result === "retried") {
        summary.retried += 1;
      } else if (result === "failed") {
        summary.failed += 1;
      } else if (result === "canceled") {
        summary.canceled += 1;
      } else {
        summary.claimSkipped += 1;
      }

      if (summary.scanned >= MAX_JOBS_PER_RUN) {
        break;
      }
    }
  }

  return summary;
};

const handleDispatch = async (request: Request) => {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return NextResponse.json(
      {
        error: "CRON_SECRET nao configurado.",
      },
      { status: 500 },
    );
  }

  const requestSecret = getRequestSecret(request);

  if (!requestSecret || requestSecret !== cronSecret) {
    return NextResponse.json(
      {
        error: "Nao autorizado.",
      },
      { status: 401 },
    );
  }

  const summary = await dispatchNotificationJobs();

  return NextResponse.json(
    {
      ok: true,
      ...summary,
    },
    { status: 200 },
  );
};

export const runtime = "nodejs";

export const GET = handleDispatch;
export const POST = handleDispatch;
