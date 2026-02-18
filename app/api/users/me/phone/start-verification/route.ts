import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { PHONE_VERIFICATION_DISABLED_CODE } from "@/lib/profile-completion";

const PHONE_VERIFICATION_DISABLED_ERROR_MESSAGE =
  "Verificacao de telefone por codigo foi desativada.";

export const runtime = "nodejs";

export async function POST() {
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

  console.info("[phone-verification] OTP disabled: start endpoint called.", {
    userId: session.user.id,
  });

  const response = NextResponse.json(
    {
      code: PHONE_VERIFICATION_DISABLED_CODE,
      error: PHONE_VERIFICATION_DISABLED_ERROR_MESSAGE,
    },
    { status: 410 },
  );

  response.headers.set("cache-control", "no-store");
  return response;
}
