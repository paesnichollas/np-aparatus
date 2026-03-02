import { joinWaitlist } from "@/actions/join-waitlist";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  barbershopId: z.uuid(),
  barberId: z.uuid(),
  serviceId: z.uuid(),
  dateDay: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(["STRIPE", "IN_PERSON"]).optional(),
});

const INVALID_REQUEST_MESSAGE = "Requisição inválida.";

const getValidationErrorMessage = (validationErrors: unknown) => {
  if (!validationErrors || typeof validationErrors !== "object") {
    return null;
  }

  const rootErrors = (validationErrors as { _errors?: unknown })._errors;
  if (!Array.isArray(rootErrors) || rootErrors.length === 0) {
    return null;
  }

  return typeof rootErrors[0] === "string" ? rootErrors[0] : null;
};

const normalizeForMessageMatch = (value: string) => {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

const isUnauthorizedErrorMessage = (message: string) => {
  const normalizedMessage = normalizeForMessageMatch(message);
  return (
    normalizedMessage.includes("nao autorizado") ||
    normalizedMessage.includes("não autorizado") ||
    normalizedMessage.includes("login")
  );
};

export const POST = async (request: Request) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json(
      {
        error: "Não autorizado.",
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
        error: INVALID_REQUEST_MESSAGE,
      },
      { status: 400 },
    );
  }

  const parsedRequest = requestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: INVALID_REQUEST_MESSAGE,
      },
      { status: 400 },
    );
  }

  const joinWaitlistResult = await joinWaitlist({
    barbershopId: parsedRequest.data.barbershopId,
    barberId: parsedRequest.data.barberId,
    serviceId: parsedRequest.data.serviceId,
    dateDay: parsedRequest.data.dateDay,
    paymentMethod: parsedRequest.data.paymentMethod,
  });

  const validationMessage = getValidationErrorMessage(
    joinWaitlistResult.validationErrors,
  );
  if (validationMessage) {
    return NextResponse.json(
      {
        error: validationMessage,
      },
      { status: 400 },
    );
  }

  const serverMessage =
    typeof joinWaitlistResult.serverError === "string" &&
    joinWaitlistResult.serverError.trim().length > 0
      ? joinWaitlistResult.serverError.trim()
      : null;
  if (serverMessage) {
    return NextResponse.json(
      {
        error: serverMessage,
      },
      { status: isUnauthorizedErrorMessage(serverMessage) ? 401 : 500 },
    );
  }

  if (!joinWaitlistResult.data) {
    return NextResponse.json(
      {
        error: "Não foi possível entrar na fila de espera.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      entryId: joinWaitlistResult.data.entryId,
      position: joinWaitlistResult.data.position,
      dateDay: joinWaitlistResult.data.dateDay,
    },
    { status: 201 },
  );
};
