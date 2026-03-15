"use server";

import {
  createCheckoutConfirmedBooking,
  createCheckoutPendingBooking,
  validateAndResolveCheckoutInput,
} from "@/lib/booking-creation-service";
import { criticalActionClient } from "@/lib/action-client";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { resolveInitialPaymentState } from "@/lib/booking-payment";
import { deduplicateServiceIds } from "@/lib/booking-mutation-helpers";
import { returnValidationErrors } from "next-safe-action";
import Stripe from "stripe";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.uuid(),
  barberId: z.uuid(),
  serviceIds: z.array(z.uuid()).min(1),
  startAt: z.date(),
  paymentMethod: z.enum(["STRIPE", "IN_PERSON"]).optional(),
});

export const createBookingCheckoutSession = criticalActionClient
  .inputSchema(inputSchema)
  .action(
    async ({
      parsedInput: {
        barbershopId,
        barberId,
        serviceIds,
        startAt,
        paymentMethod,
      },
      ctx: { user },
    }) => {
      const uniqueServiceIds = deduplicateServiceIds(serviceIds);
      const validation = await validateAndResolveCheckoutInput({
        barbershopId,
        barberId,
        serviceIds: uniqueServiceIds,
        startAt,
        userId: user.id,
        stripeEnabled: true,
        paymentMethod,
      });

      if (!validation.ok) {
        returnValidationErrors(inputSchema, {
          _errors: [validation.error],
        });
      }

      const {
        totalDurationMinutes,
        totalPriceInCents,
        barbershopId: validatedBarbershopId,
        barberId: validatedBarberId,
        barbershopName,
        barberName,
        barbershopPhone,
        stripeEnabled,
        services,
      } = validation;

      const requestedPaymentMethod =
        paymentMethod ?? (stripeEnabled ? "STRIPE" : "IN_PERSON");
      const initialPaymentState = resolveInitialPaymentState({
        stripeEnabled,
        requestedPaymentMethod,
        allowStripeCheckout: true,
      });

      if (!initialPaymentState.requiresStripeCheckout) {
        const directResult = await createCheckoutConfirmedBooking({
          barbershopId,
          barberId,
          serviceIds: uniqueServiceIds,
          startAt,
          userId: user.id,
          stripeEnabled,
          paymentMethod,
        });

        if (directResult.ok) {
          return {
            kind: "created" as const,
            bookingId: directResult.bookingId,
            receipt: {
              bookingId: directResult.bookingId,
              status: "confirmed" as const,
              customerName: user.name,
              barbershopName: directResult.receipt.barbershopName,
              barberName: directResult.receipt.barberName,
              barbershopPhone: directResult.receipt.barbershopPhone,
              bookingStartAt: startAt.toISOString(),
              serviceNames: directResult.receipt.serviceNames,
              totalPriceInCents: directResult.receipt.totalPriceInCents,
            },
          };
        }

        returnValidationErrors(inputSchema, {
          _errors: [directResult.error],
        });
      }

      if (totalPriceInCents < 1) {
        returnValidationErrors(inputSchema, {
          _errors: ["O valor total deste agendamento é inválido para pagamento online."],
        });
      }

      if (!process.env.STRIPE_SECRET_KEY) {
        returnValidationErrors(inputSchema, {
          _errors: ["Chave de API do Stripe não encontrada."],
        });
      }

      const appBaseUrl = await resolveAppBaseUrl();

      if (!appBaseUrl) {
        console.error(
          "[createBookingCheckoutSession] Invalid NEXT_PUBLIC_APP_URL and request origin.",
        );
        returnValidationErrors(inputSchema, {
          _errors: [
            "Configuração de URL da aplicação inválida. Tente novamente em alguns instantes.",
          ],
        });
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2026-01-28.clover",
      });

      const primaryServiceId = uniqueServiceIds[0]!;
      const serviceDescription = services
        .map((service) => service.name)
        .join(", ")
        .slice(0, 300);
      const endAt = new Date(startAt.getTime() + totalDurationMinutes * 60_000);
      const successUrl = new URL("/bookings", appBaseUrl);
      successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
      const cancelUrl = new URL("/bookings", appBaseUrl);

      let checkoutSession: Stripe.Checkout.Session;

      try {
        checkoutSession = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "payment",
          success_url: successUrl.toString(),
          cancel_url: cancelUrl.toString(),
          metadata: {
            barbershopId: validatedBarbershopId,
            barberId: validatedBarberId,
            userId: user.id,
            serviceIdsJson: JSON.stringify(uniqueServiceIds),
            primaryServiceId,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            date: startAt.toISOString(),
            totalDurationMinutes: String(totalDurationMinutes),
            totalPriceInCents: String(totalPriceInCents),
          },
          line_items: [
            {
              price_data: {
                currency: "brl",
                unit_amount: totalPriceInCents,
                product_data: {
                  name: `${barbershopName} - Agendamento com ${services.length} serviços`,
                  description: `Barbeiro: ${barberName}. Serviços: ${serviceDescription}`,
                },
              },
              quantity: 1,
            },
          ],
        });
      } catch (error) {
        console.error("[createBookingCheckoutSession] Stripe checkout error.", {
          error,
          barbershopId: validatedBarbershopId,
          barberId: validatedBarberId,
        });
        returnValidationErrors(inputSchema, {
          _errors: [
            "Não foi possível iniciar o pagamento agora. Verifique os dados do agendamento e tente novamente.",
          ],
        });
      }

      const pendingResult = await createCheckoutPendingBooking({
        barbershopId,
        barberId,
        serviceIds: uniqueServiceIds,
        startAt,
        userId: user.id,
        stripeEnabled,
        paymentMethod,
        stripeSessionId: checkoutSession!.id,
      });

      if (!pendingResult.ok) {
        try {
          await stripe.checkout.sessions.expire(checkoutSession!.id);
        } catch (expireError) {
          console.error(
            "[createBookingCheckoutSession] Failed to expire Stripe session after pending booking error.",
            { expireError, checkoutSessionId: checkoutSession!.id },
          );
        }
        returnValidationErrors(inputSchema, {
          _errors: [
            "Não foi possível reservar este horário agora. Tente novamente em alguns instantes.",
          ],
        });
      }

      if (!checkoutSession!.url) {
        try {
          await stripe.checkout.sessions.expire(checkoutSession!.id);
        } catch (expireError) {
          console.error(
            "[createBookingCheckoutSession] Failed to expire Stripe session without checkout url.",
            { expireError, checkoutSessionId: checkoutSession!.id },
          );
        }
        returnValidationErrors(inputSchema, {
          _errors: [
            "Não foi possível iniciar o pagamento agora. Tente novamente em alguns instantes.",
          ],
        });
      }

      return {
        kind: "stripe" as const,
        bookingId: pendingResult.bookingId,
        sessionId: checkoutSession!.id,
        checkoutUrl: checkoutSession!.url,
      };
    },
  );
