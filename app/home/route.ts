import {
  BARBERSHOP_CONTEXT_COOKIE_MAX_AGE_IN_SECONDS,
  BARBERSHOP_CONTEXT_COOKIE_NAME,
  BARBERSHOP_FORCE_GENERAL_HOME_COOKIE_NAME,
  BARBERSHOP_INTENT_COOKIE_NAME,
} from "@/lib/barbershop-context";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));

  response.cookies.set({
    name: BARBERSHOP_CONTEXT_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set({
    name: BARBERSHOP_INTENT_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set({
    name: BARBERSHOP_FORCE_GENERAL_HOME_COOKIE_NAME,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BARBERSHOP_CONTEXT_COOKIE_MAX_AGE_IN_SECONDS,
  });

  return response;
}

