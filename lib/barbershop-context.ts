export const BARBERSHOP_CONTEXT_COOKIE_NAME = "bs_ctx";
export const BARBERSHOP_INTENT_COOKIE_NAME = "bs_intent";
export const BARBERSHOP_CONTEXT_COOKIE_MAX_AGE_IN_SECONDS = 60 * 60 * 24 * 7;

export interface BarbershopIntentCookiePayload {
  barbershopId: string;
  shareSlug?: string | null;
  timestamp: number;
}

export const serializeBarbershopIntentCookie = (
  payload: BarbershopIntentCookiePayload,
) => {
  const normalizedPayload: BarbershopIntentCookiePayload = {
    barbershopId: payload.barbershopId.trim(),
    shareSlug: payload.shareSlug?.trim() || undefined,
    timestamp: payload.timestamp,
  };

  return encodeURIComponent(JSON.stringify(normalizedPayload));
};

export const parseBarbershopIntentCookie = (
  cookieValue: string | null | undefined,
) => {
  if (!cookieValue) {
    return null;
  }

  try {
    const decodedCookieValue = decodeURIComponent(cookieValue);
    const parsedCookieValue = JSON.parse(decodedCookieValue) as Partial<
      BarbershopIntentCookiePayload
    >;

    if (
      typeof parsedCookieValue.barbershopId !== "string" ||
      parsedCookieValue.barbershopId.trim().length === 0
    ) {
      return null;
    }

    if (typeof parsedCookieValue.timestamp !== "number") {
      return null;
    }

    return {
      barbershopId: parsedCookieValue.barbershopId.trim(),
      shareSlug: parsedCookieValue.shareSlug?.trim() || undefined,
      timestamp: parsedCookieValue.timestamp,
    };
  } catch {
    return null;
  }
};
