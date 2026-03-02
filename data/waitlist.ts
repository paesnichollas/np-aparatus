import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

const WAITLIST_ENTRY_SELECT = {
  id: true,
  dateDay: true,
  status: true,
  fulfilledBookingId: true,
  fulfilledBooking: {
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
    },
  },
  fulfilledSeenAt: true,
  createdAt: true,
  updatedAt: true,
  barbershop: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  barber: {
    select: {
      id: true,
      name: true,
    },
  },
  service: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.WaitlistEntrySelect;

export type WaitlistEntryWithRelations = Prisma.WaitlistEntryGetPayload<{
  select: typeof WAITLIST_ENTRY_SELECT;
}>;

const getAuthenticatedUser = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user ?? null;
};

export const getUserWaitlistEntries = async () => {
  const user = await getAuthenticatedUser();

  if (!user) {
    return [];
  }

  return prisma.waitlistEntry.findMany({
    where: {
      userId: user.id,
    },
    select: WAITLIST_ENTRY_SELECT,
    orderBy: [{ dateDay: "asc" }, { createdAt: "desc" }],
  });
};

export const getUserUnseenFulfilledWaitlistEntries = async () => {
  const user = await getAuthenticatedUser();

  if (!user) {
    return [];
  }

  return prisma.waitlistEntry.findMany({
    where: {
      userId: user.id,
      status: "FULFILLED",
      fulfilledSeenAt: null,
    },
    select: WAITLIST_ENTRY_SELECT,
    orderBy: [{ createdAt: "desc" }],
  });
};
