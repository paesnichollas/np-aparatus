import "server-only";

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;

export const normalizePage = (page: number | undefined) => {
  if (!page || Number.isNaN(page) || page < 1) {
    return 1;
  }

  return Math.floor(page);
};

export const normalizePageSize = (
  pageSize: number | undefined,
  maxPageSize = MAX_PAGE_SIZE,
  defaultPageSize = DEFAULT_PAGE_SIZE,
) => {
  if (!pageSize || Number.isNaN(pageSize) || pageSize < 1) {
    return defaultPageSize;
  }

  return Math.min(Math.floor(pageSize), maxPageSize);
};

export const normalizeSearch = (search: string | undefined) => {
  const normalizedSearch = search?.trim();
  return normalizedSearch?.length ? normalizedSearch : null;
};

export const normalizeRequiredId = (value: string, errorMessage: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(errorMessage);
  }

  return normalizedValue;
};
