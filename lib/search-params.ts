export const parseStringParam = (value: string | string[] | undefined) => {
  if (!value) {
    return "";
  }

  return Array.isArray(value) ? value[0] ?? "" : value;
};

export const parsePageParam = (value: string | string[] | undefined) => {
  const rawValue = parseStringParam(value);
  const parsedPage = Number(rawValue);

  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return Math.floor(parsedPage);
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
