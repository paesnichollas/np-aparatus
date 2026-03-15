import { createBookingPaymentCheckoutSession } from "@/actions/create-booking-payment-checkout-session";
import {
  getServerErrorMessage,
  getValidationErrorMessage,
} from "@/lib/action-errors";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const paramsSchema = z.object({
  bookingId: z.uuid(),
});

interface CheckoutBookingRouteContext {
  params: Promise<{
    bookingId: string;
  }>;
}

const buildBookingsRedirectUrl = ({
  request,
  bookingId,
  errorMessage,
}: {
  request: Request;
  bookingId?: string;
  errorMessage: string;
}) => {
  const redirectUrl = new URL("/bookings", request.url);

  if (bookingId) {
    redirectUrl.searchParams.set("bookingId", bookingId);
  }

  redirectUrl.searchParams.set("checkoutError", errorMessage);
  return redirectUrl;
};

export const GET = async (
  request: Request,
  context: CheckoutBookingRouteContext,
) => {
  const parsedParams = paramsSchema.safeParse(await context.params);

  if (!parsedParams.success) {
    return NextResponse.redirect(
      buildBookingsRedirectUrl({
        request,
        errorMessage: "Agendamento inválido para checkout.",
      }),
      { status: 303 },
    );
  }

  const checkoutResult = await createBookingPaymentCheckoutSession({
    bookingId: parsedParams.data.bookingId,
  });

  const validationMessage = getValidationErrorMessage(checkoutResult.validationErrors);
  if (validationMessage) {
    return NextResponse.redirect(
      buildBookingsRedirectUrl({
        request,
        bookingId: parsedParams.data.bookingId,
        errorMessage: validationMessage,
      }),
      { status: 303 },
    );
  }

  const serverMessage = getServerErrorMessage(checkoutResult.serverError);
  if (serverMessage) {
    return NextResponse.redirect(
      buildBookingsRedirectUrl({
        request,
        bookingId: parsedParams.data.bookingId,
        errorMessage: serverMessage,
      }),
      { status: 303 },
    );
  }

  if (!checkoutResult.data) {
    return NextResponse.redirect(
      buildBookingsRedirectUrl({
        request,
        bookingId: parsedParams.data.bookingId,
        errorMessage: "Não foi possível abrir o checkout para este agendamento.",
      }),
      { status: 303 },
    );
  }

  return NextResponse.redirect(checkoutResult.data.checkoutUrl, { status: 303 });
};
