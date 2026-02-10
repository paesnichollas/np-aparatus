"use server";

import { protectedActionClient } from "@/lib/action-client";
import { hasMinuteIntervalOverlap, toMinuteOfDay } from "@/lib/booking-interval";
import { prisma } from "@/lib/prisma";
import { endOfDay, isPast, startOfDay } from "date-fns";
import { headers } from "next/headers";
import { returnValidationErrors } from "next-safe-action";
import Stripe from "stripe";
import z from "zod";

const inputSchema = z.object({
  serviceId: z.uuid(),
  date: z.date(),
});

const hasInvalidServiceData = (service: {
  name: string;
  priceInCents: number;
  durationInMinutes: number;
}) => {
  if (service.name.trim().length === 0) {
    return true;
  }

  if (!Number.isInteger(service.priceInCents) || service.priceInCents < 0) {
    return true;
  }

  if (
    !Number.isInteger(service.durationInMinutes) ||
    service.durationInMinutes < 5
  ) {
    return true;
  }

  return false;
};

const parseAbsoluteHttpUrl = (value: string | null | undefined) => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedValue);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
};

const getAppBaseUrl = async () => {
  const envAppUrl = parseAbsoluteHttpUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (envAppUrl) {
    return envAppUrl;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    return null;
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return parseAbsoluteHttpUrl(`${protocol}://${host}`);
};

const getStripeServiceImageList = (
  serviceImageUrl: string | null,
  appBaseUrl: URL,
) => {
  if (!serviceImageUrl) {
    return undefined;
  }

  const normalizedImageUrl = serviceImageUrl.trim();

  if (!normalizedImageUrl) {
    return undefined;
  }

  if (normalizedImageUrl.startsWith("/")) {
    return [new URL(normalizedImageUrl, appBaseUrl).toString()];
  }

  const parsedImageUrl = parseAbsoluteHttpUrl(normalizedImageUrl);

  if (!parsedImageUrl) {
    return undefined;
  }

  return [parsedImageUrl.toString()];
};

export const createBookingCheckoutSession = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { serviceId, date }, ctx: { user } }) => {
    if (isPast(date)) {
      returnValidationErrors(inputSchema, {
        _errors: ["Data e hora selecionadas ja passaram."],
      });
    }

    const service = await prisma.barbershopService.findFirst({
      where: {
        id: serviceId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        priceInCents: true,
        durationInMinutes: true,
        barbershopId: true,
        barbershop: {
          select: {
            name: true,
            stripeEnabled: true,
          },
        },
      },
    });

    if (!service) {
      returnValidationErrors(inputSchema, {
        _errors: ["Servico nao encontrado."],
      });
    }

    if (hasInvalidServiceData(service)) {
      console.error("[createBookingCheckoutSession] Invalid service data.", {
        serviceId,
        service,
      });
      returnValidationErrors(inputSchema, {
        _errors: [
          "Este servico esta temporariamente indisponivel para reserva. Tente novamente mais tarde.",
        ],
      });
    }

    if (service.barbershop.stripeEnabled && service.priceInCents < 1) {
      console.error(
        "[createBookingCheckoutSession] Stripe booking with non-positive amount.",
        {
          serviceId,
          priceInCents: service.priceInCents,
        },
      );
      returnValidationErrors(inputSchema, {
        _errors: ["O valor deste servico e invalido para pagamento online."],
      });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        barbershopId: service.barbershopId,
        date: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        cancelledAt: null,
      },
      select: {
        date: true,
        service: {
          select: {
            durationInMinutes: true,
          },
        },
      },
    });

    const hasCollision = hasMinuteIntervalOverlap(
      toMinuteOfDay(date),
      service.durationInMinutes,
      bookings.map((booking) => {
        const startMinute = toMinuteOfDay(booking.date);
        return {
          startMinute,
          endMinute: startMinute + booking.service.durationInMinutes,
        };
      }),
    );

    if (hasCollision) {
      returnValidationErrors(inputSchema, {
        _errors: ["Data e hora selecionadas ja estao agendadas."],
      });
    }

    if (!service.barbershop.stripeEnabled) {
      const booking = await prisma.booking.create({
        data: {
          serviceId: service.id,
          barbershopId: service.barbershopId,
          userId: user.id,
          date: date.toISOString(),
          paymentMethod: "IN_PERSON",
        },
        select: {
          id: true,
        },
      });

      return {
        kind: "created" as const,
        bookingId: booking.id,
      };
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      returnValidationErrors(inputSchema, {
        _errors: ["Chave de API do Stripe nao encontrada."],
      });
    }

    const appBaseUrl = await getAppBaseUrl();

    if (!appBaseUrl) {
      console.error(
        "[createBookingCheckoutSession] Invalid NEXT_PUBLIC_APP_URL and request origin.",
      );
      returnValidationErrors(inputSchema, {
        _errors: [
          "Configuracao de URL da aplicacao invalida. Tente novamente em alguns instantes.",
        ],
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });
    const serviceDescription =
      service.description?.trim() || `Servico de ${service.name}`;
    const serviceImageList = getStripeServiceImageList(
      service.imageUrl,
      appBaseUrl,
    );

    let checkoutSession: Stripe.Checkout.Session;

    try {
      checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        success_url: appBaseUrl.toString(),
        cancel_url: appBaseUrl.toString(),
        metadata: {
          serviceId: service.id,
          barbershopId: service.barbershopId,
          userId: user.id,
          date: date.toISOString(),
        },
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: service.priceInCents,
              product_data: {
                name: `${service.barbershop.name} - ${service.name}`,
                description: serviceDescription,
                images: serviceImageList,
              },
            },
            quantity: 1,
          },
        ],
      });
    } catch (error) {
      console.error("[createBookingCheckoutSession] Stripe checkout error.", {
        error,
        serviceId,
        appBaseUrl: appBaseUrl.toString(),
        serviceImageUrl: service.imageUrl,
      });
      returnValidationErrors(inputSchema, {
        _errors: [
          "Nao foi possivel iniciar o pagamento agora. Verifique os dados do servico e tente novamente.",
        ],
      });
    }

    return {
      kind: "stripe" as const,
      sessionId: checkoutSession.id,
    };
  });
