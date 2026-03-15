import { headers } from "next/headers";

export const parseAbsoluteHttpUrl = (value: string | null | undefined) => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(normalizedValue);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    return parsedUrl;
  } catch {
    return null;
  }
};

export const resolveAppBaseUrl = async () => {
  const envAppUrl = parseAbsoluteHttpUrl(process.env.NEXT_PUBLIC_APP_URL);

  if (envAppUrl) {
    return envAppUrl;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    return null;
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return parseAbsoluteHttpUrl(`${protocol}://${host}`);
};
