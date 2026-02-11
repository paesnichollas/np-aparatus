"use server";

import { cookies } from "next/headers";

import { linkCustomerToBarbershop } from "@/data/customer-barbershops";
import { protectedActionClient } from "@/lib/action-client";
import {
  BARBERSHOP_CONTEXT_COOKIE_NAME,
  BARBERSHOP_INTENT_COOKIE_NAME,
  parseBarbershopIntentCookie,
} from "@/lib/barbershop-context";

export const linkCustomerToBarbershopFromCookie = protectedActionClient.action(
  async ({ ctx: { user } }) => {
    const cookieStore = await cookies();
    const barbershopIntentCookie = cookieStore.get(
      BARBERSHOP_INTENT_COOKIE_NAME,
    )?.value;
    const parsedBarbershopIntent = parseBarbershopIntentCookie(
      barbershopIntentCookie,
    );

    if (barbershopIntentCookie && !parsedBarbershopIntent) {
      cookieStore.delete(BARBERSHOP_INTENT_COOKIE_NAME);
    }

    const barbershopIdFromContextCookie =
      cookieStore.get(BARBERSHOP_CONTEXT_COOKIE_NAME)?.value?.trim() ?? null;
    const barbershopIdToLink =
      parsedBarbershopIntent?.barbershopId ?? barbershopIdFromContextCookie;

    if (!barbershopIdToLink) {
      return {
        linked: false as const,
        barbershopId: null,
      };
    }

    const linkResult = await linkCustomerToBarbershop({
      userId: user.id,
      barbershopId: barbershopIdToLink,
    });

    if (parsedBarbershopIntent) {
      cookieStore.delete(BARBERSHOP_INTENT_COOKIE_NAME);
    }

    return linkResult;
  },
);
