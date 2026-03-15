export const parseStringParam = (value: string | string[] | undefined) => {
  if (!value) {
    return "";
  }

  return Array.isArray(value) ? value[0] ?? "" : value;
};

export const parseNullableStringParam = (
  value: string | string[] | undefined,
): string | null => {
  const raw = parseStringParam(value);
  return raw.trim().length > 0 ? raw.trim() : null;
};

export const parsePageParam = (value: string | string[] | undefined) => {
  const rawValue = parseStringParam(value);
  const parsedPage = Number(rawValue);

  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return Math.floor(parsedPage);
};

export const parseDateParam = (
  value: string | string[] | undefined,
): Date | null => {
  const raw = parseStringParam(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export const parseFilterParam = <T extends string>(
  value: string | string[] | undefined,
  allowedValues: Set<T>,
  fallback: T,
): T => {
  const normalizedValue = parseStringParam(value).toUpperCase();

  if (allowedValues.has(normalizedValue as T)) {
    return normalizedValue as T;
  }

  return fallback;
};

export const buildPaginationHref = (
  basePath: string,
  params: Record<string, string | number | undefined>,
  page: number,
): string => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) {
      searchParams.set(key, String(value));
    }
  }

  if (page > 1) {
    searchParams.set("page", String(page));
  }

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
};
