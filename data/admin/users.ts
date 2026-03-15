import "server-only";

import { type Prisma, type UserRole } from "@/generated/prisma/client";
import {
  normalizePage,
  normalizePageSize,
  normalizeRequiredId,
  normalizeSearch,
} from "@/data/admin/shared";
import { demoteOwnerToCustomerByAdmin, promoteUserToOwnerByAdmin } from "@/data/owner-assignment";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";

interface AdminListUsersInput {
  role?: UserRole | "ALL";
  search?: string;
  page?: number;
  pageSize?: number;
}

export const adminListUsers = async (input: AdminListUsersInput = {}) => {
  await requireAdmin({ onUnauthorized: "throw" });

  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize, 50, 12);
  const search = normalizeSearch(input.search);
  const roleFilter = input.role && input.role !== "ALL" ? input.role : null;

  const where: Prisma.UserWhereInput = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [totalCount, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        barbershopId: true,
        ownedBarbershop: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    }),
  ]);

  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
};

interface AdminUpdateUserRoleInput {
  userId: string;
  role: UserRole;
}

const ensureCanChangeFromAdminRole = async ({
  targetUserId,
  targetRole,
  actorUserId,
}: {
  targetUserId: string;
  targetRole: UserRole;
  actorUserId: string;
}) => {
  if (targetRole === "ADMIN") {
    return;
  }

  if (targetUserId === actorUserId) {
    throw new Error("Não é permitido remover seu próprio papel de ADMIN.");
  }

  const adminCount = await prisma.user.count({
    where: {
      role: "ADMIN",
    },
  });

  if (adminCount <= 1) {
    throw new Error("Não é permitido remover o último ADMIN do sistema.");
  }
};

export const adminUpdateUserRole = async ({
  userId,
  role,
}: AdminUpdateUserRoleInput) => {
  const adminUser = await requireAdmin({ onUnauthorized: "throw" });

  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error("Usuário inválido.");
  }

  if (role === "OWNER") {
    throw new Error(
      "Use a promoção com barbearia para mover um usuário para OWNER.",
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: {
      id: normalizedUserId,
    },
    select: {
      id: true,
      role: true,
      barbershopId: true,
      ownedBarbershop: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!targetUser) {
    throw new Error("Usuário não encontrado.");
  }

  if (targetUser.role === "ADMIN") {
    await ensureCanChangeFromAdminRole({
      targetUserId: targetUser.id,
      targetRole: role,
      actorUserId: adminUser.id,
    });
  }

  if (targetUser.role === "OWNER" && role === "CUSTOMER") {
    const demotion = await demoteOwnerToCustomerByAdmin({
      actorUserId: adminUser.id,
      userId: targetUser.id,
    });

    const updatedUser = await prisma.user.findUnique({
      where: {
        id: demotion.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        barbershopId: true,
        ownedBarbershop: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!updatedUser) {
      throw new Error("Falha ao buscar usuário atualizado.");
    }

    return updatedUser;
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    if (targetUser.ownedBarbershop && role === "CUSTOMER") {
      await tx.barbershop.updateMany({
        where: {
          id: targetUser.ownedBarbershop.id,
        },
        data: {
          ownerId: null,
        },
      });
    }

    return tx.user.update({
      where: {
        id: targetUser.id,
      },
      data: {
        role,
        ...(role === "CUSTOMER" ? { barbershopId: null } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        barbershopId: true,
        ownedBarbershop: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });
  });

  return updatedUser;
};

interface AdminPromoteToOwnerAndAssignBarbershopInput {
  userId: string;
  barbershopId: string;
  allowTransfer?: boolean;
}

export const adminPromoteToOwnerAndAssignBarbershop = async ({
  userId,
  barbershopId,
  allowTransfer = true,
}: AdminPromoteToOwnerAndAssignBarbershopInput) => {
  const adminUser = await requireAdmin({ onUnauthorized: "throw" });

  const normalizedUserId = userId.trim();
  const normalizedBarbershopId = barbershopId.trim();

  if (!normalizedUserId || !normalizedBarbershopId) {
    throw new Error("Usuário e barbearia são obrigatórios.");
  }

  return promoteUserToOwnerByAdmin({
    actorUserId: adminUser.id,
    userId: normalizedUserId,
    barbershopId: normalizedBarbershopId,
    allowTransfer,
  });
};

interface AdminSetBarbershopAccessInput {
  actorUserId: string;
  barbershopId: string;
  isActive: boolean;
}

const getBarbershopContextForRevalidation = async (
  tx: Prisma.TransactionClient,
  barbershopId: string,
) => {
  const barbershop = await tx.barbershop.findUnique({
    where: {
      id: barbershopId,
    },
    select: {
      id: true,
      slug: true,
      publicSlug: true,
    },
  });

  if (!barbershop) {
    throw new Error("Barbearia não encontrada.");
  }

  return barbershop;
};

export const adminSetBarbershopAccess = async ({
  actorUserId,
  barbershopId,
  isActive,
}: AdminSetBarbershopAccessInput) => {
  const adminUser = await requireAdmin({ onUnauthorized: "throw" });

  const normalizedActorUserId = normalizeRequiredId(
    actorUserId,
    "Administrador inválido.",
  );
  const normalizedBarbershopId = normalizeRequiredId(
    barbershopId,
    "Barbearia inválida.",
  );

  if (adminUser.id !== normalizedActorUserId) {
    throw new Error("Administrador inválido.");
  }

  return prisma.$transaction(async (tx) => {
    const barbershop = await getBarbershopContextForRevalidation(
      tx,
      normalizedBarbershopId,
    );

    await tx.barbershop.updateMany({
      where: {
        id: barbershop.id,
      },
      data: {
        isActive,
      },
    });

    return {
      barbershopId: barbershop.id,
      barbershopSlug: barbershop.slug,
      barbershopPublicSlug: barbershop.publicSlug,
      barbershopIsActive: isActive,
      affectedUsersCount: 0,
      revokedSessionsCount: 0,
    };
  });
};
