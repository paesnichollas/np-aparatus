import {
  ensureBarbershopPublicSlug,
  resolveBarbershopByShareToken,
} from "@/data/barbershops";
import { linkCustomerToBarbershop } from "@/data/customer-barbershops";
import { auth } from "@/lib/auth";
import {
  BARBERSHOP_FORCE_GENERAL_HOME_COOKIE_NAME,
  BARBERSHOP_CONTEXT_COOKIE_MAX_AGE_IN_SECONDS,
  BARBERSHOP_CONTEXT_COOKIE_NAME,
  BARBERSHOP_INTENT_COOKIE_NAME,
  serializeBarbershopIntentCookie,
} from "@/lib/barbershop-context";
import { verifyShareLinkToken } from "@/lib/share-link-token";
import { NextResponse } from "next/server";

interface ShareRouteContext {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(request: Request, context: ShareRouteContext) {
  const requestUrl = new URL(request.url);
  const { slug } = await context.params;
  const shareToken = requestUrl.searchParams.get("st")?.trim() ?? "";
  const shareResolution = await resolveBarbershopByShareToken(slug);

  if (!shareResolution) {
    return NextResponse.redirect(new URL("/?share=invalid", request.url));
  }

  const { barbershop, source } = shareResolution;

  if (source !== "public-slug") {
    const canonicalPublicSlug =
      barbershop.publicSlug.trim() || (await ensureBarbershopPublicSlug(barbershop.id));
    const canonicalShareUrl = new URL(`/s/${canonicalPublicSlug}`, request.url);

    if (shareToken) {
      canonicalShareUrl.searchParams.set("st", shareToken);
    }

    return NextResponse.redirect(canonicalShareUrl, 301);
  }

  const tokenVerification = verifyShareLinkToken({
    token: shareToken,
    expectedBarbershopId: barbershop.id,
    expectedPublicSlug: barbershop.publicSlug,
  });
  const hasValidShareProof = tokenVerification.valid;

  if (shareToken && !tokenVerification.valid) {
    console.warn("[ShareRoute] Invalid share-link token.", {
      slug,
      barbershopId: barbershop.id,
      reason: tokenVerification.reason,
    });
  }

  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (session?.user && hasValidShareProof) {
    await linkCustomerToBarbershop({
      userId: session.user.id,
      barbershopId: barbershop.id,
    });
  }

  const response = session?.user
    ? NextResponse.redirect(new URL("/", request.url))
    : NextResponse.redirect(
        new URL("/auth?callbackUrl=%2F", request.url),
      );

  response.cookies.set({
    name: BARBERSHOP_CONTEXT_COOKIE_NAME,
    value: barbershop.id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BARBERSHOP_CONTEXT_COOKIE_MAX_AGE_IN_SECONDS,
  });

  response.cookies.set({
    name: BARBERSHOP_INTENT_COOKIE_NAME,
    value: serializeBarbershopIntentCookie({
      entrySource: hasValidShareProof ? "share_link" : "unknown",
      barbershopId: barbershop.id,
      shareSlug: barbershop.publicSlug,
      shareToken: hasValidShareProof ? shareToken : undefined,
      timestamp: Date.now(),
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BARBERSHOP_CONTEXT_COOKIE_MAX_AGE_IN_SECONDS,
  });

  if (hasValidShareProof) {
    response.cookies.delete(BARBERSHOP_FORCE_GENERAL_HOME_COOKIE_NAME);
  } else {
    response.cookies.set({
      name: BARBERSHOP_FORCE_GENERAL_HOME_COOKIE_NAME,
      value: "1",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: BARBERSHOP_CONTEXT_COOKIE_MAX_AGE_IN_SECONDS,
    });
  }

  return response;
}
