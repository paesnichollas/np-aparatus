import { prisma } from "@/lib/prisma";

interface LinkCustomerToBarbershopInput {
  userId: string;
  barbershopId: string;
}

export const linkCustomerToBarbershop = async ({
  userId,
  barbershopId,
}: LinkCustomerToBarbershopInput) => {
  const normalizedUserId = userId.trim();
  const normalizedBarbershopId = barbershopId.trim();

  if (!normalizedUserId || !normalizedBarbershopId) {
    return {
      linked: false as const,
      barbershopId: null,
    };
  }

  const [user, barbershop] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: normalizedUserId,
      },
      select: {
        id: true,
      },
    }),
    prisma.barbershop.findUnique({
      where: {
        id: normalizedBarbershopId,
      },
      select: {
        id: true,
      },
    }),
  ]);

  if (!user || !barbershop) {
    return {
      linked: false as const,
      barbershopId: null,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.customerBarbershop.upsert({
      where: {
        customerId_barbershopId: {
          customerId: normalizedUserId,
          barbershopId: normalizedBarbershopId,
        },
      },
      create: {
        customerId: normalizedUserId,
        barbershopId: normalizedBarbershopId,
      },
      update: {},
    });

    await tx.user.update({
      where: {
        id: normalizedUserId,
      },
      data: {
        currentBarbershopId: normalizedBarbershopId,
      },
      select: {
        id: true,
      },
    });
  });

  return {
    linked: true as const,
    barbershopId: normalizedBarbershopId,
  };
};

export const getPreferredBarbershopIdForUser = async (userId: string) => {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      currentBarbershopId: true,
    },
  });

  if (user?.currentBarbershopId) {
    return user.currentBarbershopId;
  }

  const latestLinkedBarbershop = await prisma.customerBarbershop.findFirst({
    where: {
      customerId: normalizedUserId,
    },
    select: {
      barbershopId: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return latestLinkedBarbershop?.barbershopId ?? null;
};
