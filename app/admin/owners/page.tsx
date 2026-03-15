import { type UserRole } from "@/generated/prisma/client";

import OwnersManagementTable from "@/components/admin/owners-management-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminListBarbershopOptions } from "@/data/admin/barbershops";
import { adminListUsers } from "@/data/admin/users";
import {
  buildPaginationHref,
  parseFilterParam,
  parsePageParam,
  parseStringParam,
} from "@/lib/search-params";
import Link from "next/link";

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Owners e usuários</CardTitle>
          <CardDescription>
            Filtre usuários por papel e controle promoções/rebaixamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-wrap items-center gap-2">
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
          </form>

          <OwnersManagementTable
            users={usersResult.items}
            barbershopOptions={barbershopOptions}
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Página {usersResult.page} de {usersResult.totalPages} ({usersResult.totalCount}{" "}
              resultados)
            </p>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" disabled={usersResult.page <= 1}>
                <Link href={createPageHref(Math.max(1, usersResult.page - 1))}>
                  Anterior
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                disabled={usersResult.page >= usersResult.totalPages}
              >
                <Link
                  href={createPageHref(
                    Math.min(usersResult.totalPages, usersResult.page + 1),
                  )}
                >
                  Próximo
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOwnersPage;
