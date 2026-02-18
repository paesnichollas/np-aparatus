import { normalizePhoneToE164 } from "./phone-normalization";

const BRAZIL_COUNTRY_CODE = "55";
const BR_PHONE_LENGTH_10 = 10;
const BR_PHONE_LENGTH_11 = 11;
const BR_DDD_LENGTH = 2;
const PHONE_LIST_SEPARATOR_CAPTURE_REGEX = /([,;\n])/g;
const PHONE_LIST_SEPARATOR_REGEX = /[,\n;]+/;

export const BR_PHONE_MIN_LENGTH = BR_PHONE_LENGTH_10;
export const BR_PHONE_MAX_LENGTH = BR_PHONE_LENGTH_11;

export const stripToDigits = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  return value.replace(/\D/g, "");
};

const getBrLocalPhoneDigits = (value: string | null | undefined) => {
  let digits = stripToDigits(value);

  if (!digits) {
    return "";
  }

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (
    digits.startsWith(BRAZIL_COUNTRY_CODE) &&
    digits.length > BR_PHONE_LENGTH_11
  ) {
    return digits.slice(2);
  }

  return digits;
};

export const getBrPhoneDigitsFromInput = (value: string | null | undefined) => {
  const digits = getBrLocalPhoneDigits(value);

  if (!digits) {
    return "";
  }

  return digits.slice(0, BR_PHONE_LENGTH_11);
};

export const formatPhoneBRInput = (value: string | null | undefined) => {
  const digits = getBrPhoneDigitsFromInput(value);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const formatPhoneBRDisplay = (e164OrDigits: string | null | undefined) => {
  const digits = getBrLocalPhoneDigits(e164OrDigits);

  if (digits.length === BR_PHONE_LENGTH_11) {
    return `(${digits.slice(0, BR_DDD_LENGTH)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === BR_PHONE_LENGTH_10) {
    return `(${digits.slice(0, BR_DDD_LENGTH)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return "";
};

export const parsePhoneListToDigits = (value: string) => {
  return value
    .split(PHONE_LIST_SEPARATOR_REGEX)
    .map((phone) => getBrPhoneDigitsFromInput(phone))
    .filter((phone) => phone.length > 0);
};

export const formatPhoneListBRInput = (value: string) => {
  return value
    .split(PHONE_LIST_SEPARATOR_CAPTURE_REGEX)
    .map((segment) => {
      if (segment === ",") {
        return ", ";
      }

      if (segment === ";") {
        return "; ";
      }

      if (segment === "\n") {
        return "\n";
      }

      return formatPhoneBRInput(segment);
    })
    .join("");
};

export const toE164BR = (input: string) => {
  return normalizePhoneToE164(input);
};
