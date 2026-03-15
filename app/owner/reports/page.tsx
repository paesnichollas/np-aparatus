import OwnerReportsCard from "@/components/owner/reports-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageSectionContent, PageSectionTitle } from "@/components/ui/page";
import { SHOW_CHATBOT_ENTRYPOINTS } from "@/constants/feature-flags";
import { adminListBarbershopOptions } from "@/data/admin/barbershops";
import { getOwnerBarbershopIdByUserId } from "@/data/barbershops";
import { isAdmin, requireOwnerOrAdmin } from "@/lib/rbac";
import { parseStringParam } from "@/lib/search-params";
import Link from "next/link";

interface OwnerReportsPageProps {
  searchParams: Promise<{
    barbershopId?: string | string[];
  }>;
}

const OwnerReportsPage = async ({ searchParams }: OwnerReportsPageProps) => {
  const user = await requireOwnerOrAdmin();
  const resolvedSearchParams = await searchParams;
  const requestedBarbershopId = parseStringParam(resolvedSearchParams.barbershopId);

  if (isAdmin(user.role)) {
    const barbershopOptions = await adminListBarbershopOptions();

    if (barbershopOptions.length === 0) {
      return (
        <PageSectionContent>
          <PageSectionTitle>Relatório</PageSectionTitle>
          <Card>
            <CardHeader>
              <CardTitle>Nenhuma barbearia cadastrada</CardTitle>
              <CardDescription>
                Cadastre uma barbearia para gerar relatórios no painel.
              </CardDescription>
            </CardHeader>
          </Card>
        </PageSectionContent>
      );
    }

    const hasRequestedBarbershop = barbershopOptions.some(
      (barbershop) => barbershop.id === requestedBarbershopId,
    );
    const initialBarbershopId = hasRequestedBarbershop
      ? requestedBarbershopId
      : barbershopOptions[0]?.id ?? null;

    return (
      <PageSectionContent>
        <PageSectionTitle>Relatório</PageSectionTitle>
        <OwnerReportsCard
          isAdmin
          initialBarbershopId={initialBarbershopId}
          barbershopOptions={barbershopOptions}
        />
      </PageSectionContent>
    );
  }

  const ownerBarbershop = await getOwnerBarbershopIdByUserId(user.id);
  const ownerBarbershopId = ownerBarbershop?.id ?? user.barbershopId;

  if (!ownerBarbershopId) {
    return (
      <PageSectionContent>
        <PageSectionTitle>Relatório</PageSectionTitle>
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma barbearia vinculada</CardTitle>
            <CardDescription>
              Vincule sua conta a uma barbearia para visualizar pedidos e
              faturamento.
            </CardDescription>
          </CardHeader>
          {SHOW_CHATBOT_ENTRYPOINTS ? (
            <CardContent>
              <Button asChild className="gap-2">
                <Link href="/chat">Falar com o suporte</Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      </PageSectionContent>
    );
  }

  return (
    <PageSectionContent>
      <PageSectionTitle>Relatório</PageSectionTitle>
      <OwnerReportsCard
        isAdmin={false}
        initialBarbershopId={ownerBarbershopId}
        barbershopOptions={[]}
      />
    </PageSectionContent>
  );
};

export default OwnerReportsPage;
