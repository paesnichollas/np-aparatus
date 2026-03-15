import { joinWaitlist } from "@/actions/join-waitlist";
import {
  handleActionJsonResponse,
  parseBody,
  requireAuth,
} from "@/lib/api-action-adapter";
import { WAITLIST_JOIN_INPUT_SCHEMA } from "@/lib/waitlist-shared";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const POST = async (request: Request) => {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const parsed = await parseBody(request, WAITLIST_JOIN_INPUT_SCHEMA);
  if (!parsed.success) {
    return parsed.response;
  }

  const result = await joinWaitlist({
    barbershopId: parsed.data.barbershopId,
    barberId: parsed.data.barberId,
    serviceId: parsed.data.serviceId,
    dateDay: parsed.data.dateDay,
    paymentMethod: parsed.data.paymentMethod,
  });

  return handleActionJsonResponse(result, {
    successStatus: 201,
    conflictStatus: 400,
    noDataMessage: "Não foi possível entrar na fila de espera.",
  });
};
