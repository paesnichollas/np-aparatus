import { createOtpDisabledResponse } from "../shared-otp-disabled";

export const runtime = "nodejs";

export async function POST() {
  return createOtpDisabledResponse(
    "[phone-verification] OTP disabled: start endpoint called.",
  );
}
