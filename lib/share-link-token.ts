import { createHmac, timingSafeEqual } from "node:crypto";

const SHARE_LINK_TOKEN_VERSION = 1;
export const DEFAULT_SHARE_LINK_TOKEN_TTL_IN_SECONDS = 60 * 60 * 24 * 30;

type ShareLinkTokenPayload = {
  v: number;
  barbershopId: string;
  publicSlug: string;
  iat: number;
  exp: number;
};

type VerifyShareLinkTokenFailureReason =
  | "missing-token"
  | "missing-secret"
  | "malformed-token"
  | "invalid-signature"
  | "invalid-payload"
  | "expired-token"
  | "barbershop-mismatch"
  | "slug-mismatch";

type VerifyShareLinkTokenSuccess = {
  valid: true;
  payload: ShareLinkTokenPayload;
};

type VerifyShareLinkTokenFailure = {
  valid: false;
  reason: VerifyShareLinkTokenFailureReason;
};

type VerifyShareLinkTokenResult =
  | VerifyShareLinkTokenSuccess
  | VerifyShareLinkTokenFailure;

const base64UrlEncode = (value: string | Buffer) => {
  return Buffer.from(value).toString("base64url");
};

const base64UrlDecodeToString = (value: string) => {
  return Buffer.from(value, "base64url").toString("utf-8");
};

const getShareLinkSecret = () => {
  const shareLinkTokenSecret = process.env.SHARE_LINK_TOKEN_SECRET?.trim();

  if (shareLinkTokenSecret) {
    return shareLinkTokenSecret;
  }

  const betterAuthSecret = process.env.BETTER_AUTH_SECRET?.trim();

  return betterAuthSecret || null;
};

const signShareLinkTokenPayload = (encodedPayload: string, secret: string) => {
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest();

  return base64UrlEncode(signature);
};

const parseTokenPayload = (
  encodedPayload: string,
): ShareLinkTokenPayload | null => {
  try {
    const decodedPayload = base64UrlDecodeToString(encodedPayload);
    const parsedPayload = JSON.parse(decodedPayload) as Partial<ShareLinkTokenPayload>;

    if (
      typeof parsedPayload.v !== "number" ||
      parsedPayload.v !== SHARE_LINK_TOKEN_VERSION
    ) {
      return null;
    }

    if (
      typeof parsedPayload.barbershopId !== "string" ||
      parsedPayload.barbershopId.trim().length === 0
    ) {
      return null;
    }

    if (
      typeof parsedPayload.publicSlug !== "string" ||
      parsedPayload.publicSlug.trim().length === 0
    ) {
      return null;
    }

    if (
      typeof parsedPayload.iat !== "number" ||
      typeof parsedPayload.exp !== "number"
    ) {
      return null;
    }

    if (!Number.isFinite(parsedPayload.iat) || !Number.isFinite(parsedPayload.exp)) {
      return null;
    }

    return {
      v: SHARE_LINK_TOKEN_VERSION,
      barbershopId: parsedPayload.barbershopId.trim(),
      publicSlug: parsedPayload.publicSlug.trim(),
      iat: parsedPayload.iat,
      exp: parsedPayload.exp,
    };
  } catch {
    return null;
  }
};

export const createShareLinkToken = ({
  barbershopId,
  publicSlug,
  ttlInSeconds = DEFAULT_SHARE_LINK_TOKEN_TTL_IN_SECONDS,
  now = Date.now(),
}: {
  barbershopId: string;
  publicSlug: string;
  ttlInSeconds?: number;
  now?: number;
}) => {
  const normalizedBarbershopId = barbershopId.trim();
  const normalizedPublicSlug = publicSlug.trim();

  if (!normalizedBarbershopId || !normalizedPublicSlug) {
    throw new Error(
      "[createShareLinkToken] barbershopId and publicSlug are required.",
    );
  }

  const secret = getShareLinkSecret();

  if (!secret) {
    throw new Error(
      "[createShareLinkToken] SHARE_LINK_TOKEN_SECRET or BETTER_AUTH_SECRET is required.",
    );
  }

  const iat = now;
  const exp = now + ttlInSeconds * 1000;
  const payload: ShareLinkTokenPayload = {
    v: SHARE_LINK_TOKEN_VERSION,
    barbershopId: normalizedBarbershopId,
    publicSlug: normalizedPublicSlug,
    iat,
    exp,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signShareLinkTokenPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
};

export const verifyShareLinkToken = ({
  token,
  expectedBarbershopId,
  expectedPublicSlug,
  now = Date.now(),
}: {
  token: string | null | undefined;
  expectedBarbershopId?: string | null;
  expectedPublicSlug?: string | null;
  now?: number;
}): VerifyShareLinkTokenResult => {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return {
      valid: false,
      reason: "missing-token",
    };
  }

  const secret = getShareLinkSecret();

  if (!secret) {
    return {
      valid: false,
      reason: "missing-secret",
    };
  }

  const tokenParts = normalizedToken.split(".");

  if (tokenParts.length !== 2) {
    return {
      valid: false,
      reason: "malformed-token",
    };
  }

  const [encodedPayload, signature] = tokenParts;

  if (!encodedPayload || !signature) {
    return {
      valid: false,
      reason: "malformed-token",
    };
  }

  const expectedSignature = signShareLinkTokenPayload(encodedPayload, secret);

  const providedSignatureBuffer = Buffer.from(signature, "utf-8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf-8");

  if (providedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    return {
      valid: false,
      reason: "invalid-signature",
    };
  }

  if (!timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)) {
    return {
      valid: false,
      reason: "invalid-signature",
    };
  }

  const payload = parseTokenPayload(encodedPayload);

  if (!payload) {
    return {
      valid: false,
      reason: "invalid-payload",
    };
  }

  if (payload.exp <= now) {
    return {
      valid: false,
      reason: "expired-token",
    };
  }

  const normalizedExpectedBarbershopId = expectedBarbershopId?.trim();
  if (
    normalizedExpectedBarbershopId &&
    payload.barbershopId !== normalizedExpectedBarbershopId
  ) {
    return {
      valid: false,
      reason: "barbershop-mismatch",
    };
  }

  const normalizedExpectedPublicSlug = expectedPublicSlug?.trim();
  if (normalizedExpectedPublicSlug && payload.publicSlug !== normalizedExpectedPublicSlug) {
    return {
      valid: false,
      reason: "slug-mismatch",
    };
  }

  return {
    valid: true,
    payload,
  };
};
