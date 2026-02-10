"use server";

import { protectedActionClient } from "@/lib/action-client";
import z from "zod";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";
import { isPast } from "date-fns";

const inputSchema = z.object({
  serviceId: z.uuid(),
  date: z.date(),
});

export const createBookingCheckoutSession = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { serviceId, date }, ctx: { user } }) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      returnValidationErrors(inputSchema, {
        _errors: ["Chave de API do Stripe não encontrada."],
      });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-07-30.basil",
    });
    const service = await prisma.barbershopService.findUnique({
      where: {
        id: serviceId,
      },
      include: {
        barbershop: true,
      },
    });
    if (!service) {
      returnValidationErrors(inputSchema, {
        _errors: ["Serviço não encontrado."],
      });
    }
    if (isPast(date)) {
      returnValidationErrors(inputSchema, {
        _errors: ["Data e hora selecionadas já passaram."],
      });
    }
    const existingBooking = await prisma.booking.findFirst({
      where: {
        barbershopId: service.barbershopId,
        date,
        cancelledAt: null,
      },
    });
    if (existingBooking) {
      returnValidationErrors(inputSchema, {
        _errors: ["Data e hora selecionadas já estão agendadas."],
      });
    }
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
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
            unit_amount: service?.priceInCents,
            product_data: {
              name: `${service?.barbershop?.name} - ${service?.name}`,
              description: service?.description,
              images: [service.imageUrl],
            },
          },
          quantity: 1,
        },
      ],
    });
    return checkoutSession;
  });
