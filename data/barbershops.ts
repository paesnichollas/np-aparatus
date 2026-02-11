import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { CONFIRMED_BOOKING_PAYMENT_WHERE } from "@/lib/booking-payment";
import { reconcilePendingBookingsForBarbershop } from "@/lib/stripe-booking-reconciliation";
import { randomUUID } from "node:crypto";

export type AdminBarbershopWithRelations = Prisma.BarbershopGetPayload<{
  include: {
    services: true;
    barbers: true;
    openingHours: true;
    bookings: {
      include: {
        barber: true;
        service: true;
        services: {
          include: {
            service: true;
          };
        };
        user: true;
      };
    };
  };
}>;

const SHARE_SLUG_MAX_GENERATION_ATTEMPTS = 10;

const BARBERSHOP_DETAILS_INCLUDE = {
  barbers: {
    orderBy: {
      name: "asc",
    },
  },
  services: {
    where: {
      deletedAt: null,
    },
    orderBy: {
      name: "asc",
    },
  },
  openingHours: {
    orderBy: {
      dayOfWeek: "asc",
    },
  },
} satisfies Prisma.BarbershopInclude;

const parseAbsoluteHttpUrl = (value: string | null | undefined) => {
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

const generateShareSlug = () => randomUUID().replace(/-/g, "");

export const getBarbershops = async () => {
  const barbershops = await prisma.barbershop.findMany({
    where: {
      exclusiveBarber: false,
    },
  });
  return barbershops;
};

export const getPopularBarbershops = async () => {
  const popularBarbershops = await prisma.barbershop.findMany({
    where: {
      exclusiveBarber: false,
    },
    orderBy: {
      name: "desc",
    },
  });
  return popularBarbershops;
};

export const getBarbershopById = async (id: string) => {
  const barbershop = await prisma.barbershop.findUnique({
    where: { id },
    include: BARBERSHOP_DETAILS_INCLUDE,
  });
  return barbershop;
};

export const getBarbershopBySlug = async (slug: string) => {
  const barbershop = await prisma.barbershop.findUnique({
    where: { slug },
    include: BARBERSHOP_DETAILS_INCLUDE,
  });
  return barbershop;
};

export const getExclusiveBarbershopByContextId = async (
  contextBarbershopId: string | null,
) => {
  const normalizedContextBarbershopId = contextBarbershopId?.trim();

  if (!normalizedContextBarbershopId) {
    return null;
  }

  const contextBarbershop = await prisma.barbershop.findUnique({
    where: {
      id: normalizedContextBarbershopId,
    },
    include: BARBERSHOP_DETAILS_INCLUDE,
  });

  if (!contextBarbershop) {
    return null;
  }

  if (!contextBarbershop.exclusiveBarber || !contextBarbershop.ownerId) {
    return null;
  }

  return contextBarbershop;
};

export const ensureBarbershopShareSlug = async (barbershopId: string) => {
  const barbershop = await prisma.barbershop.findUnique({
    where: {
      id: barbershopId,
    },
    select: {
      id: true,
      shareSlug: true,
    },
  });

  if (!barbershop) {
    throw new Error("[ensureBarbershopShareSlug] Barbershop not found.");
  }

  if (barbershop.shareSlug) {
    return barbershop.shareSlug;
  }

  for (
    let attempt = 0;
    attempt < SHARE_SLUG_MAX_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const candidateShareSlug = generateShareSlug();

    try {
      const updateResult = await prisma.barbershop.updateMany({
        where: {
          id: barbershopId,
          shareSlug: null,
        },
        data: {
          shareSlug: candidateShareSlug,
        },
      });

      if (updateResult.count === 1) {
        return candidateShareSlug;
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }

    const barbershopWithSlug = await prisma.barbershop.findUnique({
      where: {
        id: barbershopId,
      },
      select: {
        shareSlug: true,
      },
    });

    if (!barbershopWithSlug) {
      throw new Error("[ensureBarbershopShareSlug] Barbershop not found.");
    }

    if (barbershopWithSlug.shareSlug) {
      return barbershopWithSlug.shareSlug;
    }
  }

  throw new Error(
    "[ensureBarbershopShareSlug] Could not generate unique share slug.",
  );
};

export const getBarbershopShareLink = async (
  barbershopId: string,
  origin?: string | null,
) => {
  const shareSlug = await ensureBarbershopShareSlug(barbershopId);
  const baseUrl =
    parseAbsoluteHttpUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    parseAbsoluteHttpUrl(origin);

  if (!baseUrl) {
    throw new Error(
      "[getBarbershopShareLink] Invalid NEXT_PUBLIC_APP_URL and origin fallback.",
    );
  }

  return new URL(`/s/${shareSlug}`, baseUrl).toString();
};

export const getBarbershopByShareSlug = async (shareSlug: string) => {
  const normalizedShareSlug = shareSlug.trim();

  if (!normalizedShareSlug) {
    return null;
  }

  const barbershop = await prisma.barbershop.findUnique({
    where: {
      shareSlug: normalizedShareSlug,
    },
    include: BARBERSHOP_DETAILS_INCLUDE,
  });

  return barbershop;
};

export const getBarbershopsByServiceName = async (serviceName: string) => {
  const barbershops = await prisma.barbershop.findMany({
    where: {
      exclusiveBarber: false,
      services: {
        some: {
          deletedAt: null,
          name: {
            contains: serviceName,
            mode: "insensitive",
          },
        },
      },
    },
  });
  return barbershops;
};

export const getAdminBarbershopByUserId = async (userId: string) => {
  const ownedBarbershop = await prisma.barbershop.findFirst({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
    },
  });

  if (!ownedBarbershop) {
    return null;
  }

  try {
    await reconcilePendingBookingsForBarbershop(ownedBarbershop.id);
  } catch (error) {
    console.error(
      "[getAdminBarbershopByUserId] Failed to reconcile pending bookings for barbershop.",
      {
        error,
        userId,
        barbershopId: ownedBarbershop.id,
      },
    );
  }

  const barbershop = await prisma.barbershop.findUnique({
    where: {
      id: ownedBarbershop.id,
    },
    include: {
      barbers: {
        orderBy: {
          name: "asc",
        },
      },
      services: {
        where: {
          deletedAt: null,
        },
        orderBy: {
          name: "asc",
        },
      },
      openingHours: {
        orderBy: {
          dayOfWeek: "asc",
        },
      },
      bookings: {
        where: {
          OR: [
            CONFIRMED_BOOKING_PAYMENT_WHERE,
            {
              cancelledAt: {
                not: null,
              },
            },
          ],
        },
        include: {
          barber: true,
          service: true,
          services: {
            include: {
              service: true,
            },
          },
          user: true,
        },
        orderBy: {
          date: "desc",
        },
      },
    },
  });
  return barbershop;
};

export const getAdminBarbershopIdByUserId = async (userId: string) => {
  const barbershop = await prisma.barbershop.findFirst({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
    },
  });

  return barbershop;
};

export const getOwnerBarbershopByUserId = getAdminBarbershopByUserId;
export const getOwnerBarbershopIdByUserId = getAdminBarbershopIdByUserId;
