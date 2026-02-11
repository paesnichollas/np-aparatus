import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getPhoneAuthEmail,
  getPhoneAuthPassword,
  isValidPhoneNumber,
  normalizePhoneNumber,
} from "@/lib/auth-phone";

interface PhoneAuthRequestBody {
  name?: string;
  phone?: string;
  callbackUrl?: string;
}

const MIN_NAME_LENGTH = 2;
const FALLBACK_CUSTOMER_NAME = "Cliente";

const getSafeCallbackUrl = (callbackUrl: string | undefined) => {
  if (!callbackUrl) {
    return "/";
  }

  if (!callbackUrl.startsWith("/")) {
    return "/";
  }

  if (callbackUrl.startsWith("//")) {
    return "/";
  }

  return callbackUrl;
};

const appendSetCookieHeaders = (
  sourceHeaders: Headers,
  targetHeaders: Headers,
) => {
  const headersWithGetSetCookie = sourceHeaders as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    for (const cookieValue of headersWithGetSetCookie.getSetCookie()) {
      targetHeaders.append("set-cookie", cookieValue);
    }
    return;
  }

  const setCookieHeader = sourceHeaders.get("set-cookie");
  if (setCookieHeader) {
    targetHeaders.append("set-cookie", setCookieHeader);
  }
};

const getNormalizedCustomerName = (name: string | undefined) => {
  const normalizedName = name?.trim();

  if (!normalizedName || normalizedName.length < MIN_NAME_LENGTH) {
    return FALLBACK_CUSTOMER_NAME;
  }

  return normalizedName;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  let requestBody: PhoneAuthRequestBody;

  try {
    requestBody = (await request.json()) as PhoneAuthRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: "Dados de autenticacao invalidos.",
      },
      { status: 400 },
    );
  }

  const normalizedPhoneNumber = normalizePhoneNumber(requestBody.phone ?? "");

  if (!isValidPhoneNumber(normalizedPhoneNumber)) {
    return NextResponse.json(
      {
        error: "Informe um telefone valido.",
      },
      { status: 400 },
    );
  }

  const normalizedCustomerName = getNormalizedCustomerName(requestBody.name);
  const safeCallbackUrl = getSafeCallbackUrl(requestBody.callbackUrl);
  const callbackPath = `/auth/callback?callbackUrl=${encodeURIComponent(
    safeCallbackUrl,
  )}`;
  const authCallbackUrl = new URL(callbackPath, request.url).toString();
  const phoneAuthEmail = getPhoneAuthEmail(normalizedPhoneNumber);
  const phoneAuthPassword = getPhoneAuthPassword(normalizedPhoneNumber);

  const existingUser = await prisma.user.findUnique({
    where: {
      email: phoneAuthEmail,
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  let authResponse: Response;

  if (existingUser) {
    authResponse = await auth.api.signInEmail({
      request,
      asResponse: true,
      body: {
        email: phoneAuthEmail,
        password: phoneAuthPassword,
      },
    });
  } else {
    const signUpResponse = await auth.api.signUpEmail({
      request,
      asResponse: true,
      body: {
        name: normalizedCustomerName,
        email: phoneAuthEmail,
        password: phoneAuthPassword,
      },
    });

    if (signUpResponse.ok) {
      authResponse = signUpResponse;
    } else {
      authResponse = await auth.api.signInEmail({
        request,
        asResponse: true,
        body: {
          email: phoneAuthEmail,
          password: phoneAuthPassword,
        },
      });
    }
  }

  if (!authResponse.ok) {
    return NextResponse.json(
      {
        error: "Nao foi possivel autenticar com nome e telefone.",
      },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: phoneAuthEmail,
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  if (user) {
    const shouldUpdateName = user.name !== normalizedCustomerName;
    const shouldUpdatePhone = user.phone !== normalizedPhoneNumber;

    if (shouldUpdateName || shouldUpdatePhone) {
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          name: normalizedCustomerName,
          phone: normalizedPhoneNumber,
        },
        select: {
          id: true,
        },
      });
    }
  }

  const response = NextResponse.redirect(new URL(authCallbackUrl));
  appendSetCookieHeaders(authResponse.headers, response.headers);
  return response;
}
