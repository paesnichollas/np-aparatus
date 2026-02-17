export const BARBERSHOP_CONTEXT_COOKIE_NAME = "bs_ctx";
export const BARBERSHOP_INTENT_COOKIE_NAME = "bs_intent";
export const BARBERSHOP_FORCE_GENERAL_HOME_COOKIE_NAME = "bs_force_home";
export const BARBERSHOP_CONTEXT_COOKIE_MAX_AGE_IN_SECONDS = 60 * 60 * 24 * 7;

export type BarbershopEntrySource =
  | "share_link"
  | "general_list"
  | "unknown";

const BARBERSHOP_ENTRY_SOURCE_VALUES: BarbershopEntrySource[] = [
  "share_link",
  "general_list",
  "unknown",
];

const isBarbershopEntrySource = (
  value: unknown,
): value is BarbershopEntrySource => {
  return (
    typeof value === "string" &&
    BARBERSHOP_ENTRY_SOURCE_VALUES.includes(value as BarbershopEntrySource)
  );
};

export interface BarbershopIntentCookiePayload {
  entrySource: BarbershopEntrySource;
  barbershopId: string;
  shareSlug?: string | null;
  shareToken?: string | null;
  timestamp: number;
}

export const serializeBarbershopIntentCookie = (
  payload: BarbershopIntentCookiePayload,
) => {
  const normalizedPayload: BarbershopIntentCookiePayload = {
    entrySource: isBarbershopEntrySource(payload.entrySource)
      ? payload.entrySource
      : "unknown",
    barbershopId: payload.barbershopId.trim(),
    shareSlug: payload.shareSlug?.trim() || undefined,
    shareToken: payload.shareToken?.trim() || undefined,
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

    const parsedEntrySource = parsedCookieValue.entrySource;
    const normalizedEntrySource = isBarbershopEntrySource(parsedEntrySource)
      ? parsedEntrySource
      : "unknown";

    return {
      entrySource: normalizedEntrySource,
      barbershopId: parsedCookieValue.barbershopId.trim(),
      shareSlug: parsedCookieValue.shareSlug?.trim() || undefined,
      shareToken:
        typeof parsedCookieValue.shareToken === "string"
          ? parsedCookieValue.shareToken.trim() || undefined
          : undefined,
      timestamp: parsedCookieValue.timestamp,
    };
  } catch {
    return null;
  }
};
