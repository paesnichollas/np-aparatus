import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { jsonNoStore } from "@/lib/http-helpers";
import { PHONE_VERIFICATION_DISABLED_CODE } from "@/lib/profile-completion";

const PHONE_VERIFICATION_DISABLED_ERROR_MESSAGE =
  "Verificação de telefone por código foi desativada.";

export const createOtpDisabledResponse = async (
  logMessage: string,
): Promise<NextResponse> => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Não autorizado.",
      },
      { status: 401 },
    );
  }

  console.info(logMessage, {
    userId: session.user.id,
  });

  return jsonNoStore(
    {
      code: PHONE_VERIFICATION_DISABLED_CODE,
      error: PHONE_VERIFICATION_DISABLED_ERROR_MESSAGE,
    },
    410,
  );
};
