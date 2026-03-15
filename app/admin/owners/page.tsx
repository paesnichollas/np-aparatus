import { type UserRole } from "@/generated/prisma/client";

import { AdminListPageFrame } from "@/components/admin/admin-list-page-frame";
import OwnersManagementTable from "@/components/admin/owners-management-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminListBarbershopOptions } from "@/data/admin/barbershops";
import { adminListUsers } from "@/data/admin/users";
import {
  buildPaginationHref,
  parseFilterParam,
  parsePageParam,
  parseStringParam,
} from "@/lib/search-params";

interface AdminOwnersPageProps {
  searchParams: Promise<{
    q?: string | string[];
    role?: string | string[];
    page?: string | string[];
  }>;
}

const roleFilterValues = new Set<UserRole | "ALL">([
  "ALL",
  "CUSTOMER",
  "OWNER",
  "ADMIN",
]);

const AdminOwnersPage = async ({ searchParams }: AdminOwnersPageProps) => {
  const resolvedSearchParams = await searchParams;
  const search = parseStringParam(resolvedSearchParams.q);
  const role = parseFilterParam(
    resolvedSearchParams.role,
    roleFilterValues,
    "ALL",
  );
  const page = parsePageParam(resolvedSearchParams.page);

  const paginationParams: Record<string, string | number | undefined> = {
    q: search || undefined,
    role: role !== "ALL" ? role : undefined,
  };

  const [usersResult, barbershopOptions] = await Promise.all([
    adminListUsers({
      search,
      role,
      page,
    }),
    adminListBarbershopOptions(),
  ]);

  const createPageHref = (nextPage: number) =>
    buildPaginationHref("/admin/owners", paginationParams, nextPage);

  return (
    <AdminListPageFrame
      title="Owners e usuários"
      description="Filtre usuários por papel e controle promoções/rebaixamentos."
      filterForm={
        <>
          <Input
            name="q"
            defaultValue={search}
            placeholder="Buscar por nome ou e-mail"
            className="w-full md:max-w-sm"
          />
          <select
            name="role"
            defaultValue={role}
            className="bg-background border-input h-9 rounded-md border px-3 text-sm"
          >
            <option value="ALL">Todos os papéis</option>
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <Button type="submit">Filtrar</Button>
        </>
      }
      pagination={{
        page: usersResult.page,
        totalPages: usersResult.totalPages,
        totalCount: usersResult.totalCount,
        createPageHref,
      }}
    >
      <OwnersManagementTable
        users={usersResult.items}
        barbershopOptions={barbershopOptions}
      />
    </AdminListPageFrame>
  );
};

export default AdminOwnersPage;
