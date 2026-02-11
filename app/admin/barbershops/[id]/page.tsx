import Link from "next/link";
import { notFound } from "next/navigation";

import BarbershopAdminForm from "@/components/admin/barbershop-admin-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminGetBarbershop } from "@/data/admin/barbershops";

const AdminBarbershopDetailsPage = async ({
  params,
}: PageProps<"/admin/barbershops/[id]">) => {
  const { id } = await params;
  const barbershop = await adminGetBarbershop(id);

  if (!barbershop) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Detalhes da barbearia</h2>
        <Link
          href="/admin/barbershops"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Voltar para listagem
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{barbershop.name}</CardTitle>
          <CardDescription>
            Edite os campos principais da barbearia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarbershopAdminForm barbershop={barbershop} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBarbershopDetailsPage;
