import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const adminCards = [
  {
    href: "/admin/barbershops",
    title: "Barbearias",
    description:
      "Listagem global, detalhes e edicao dos campos principais das barbearias.",
  },
  {
    href: "/admin/owners",
    title: "Owners e usuarios",
    description:
      "Controle de papeis e vinculacao de ownership por barbearia.",
  },
  {
    href: "/admin/bookings",
    title: "Reservas",
    description: "Consulta de reservas com filtros por barbearia, periodo e status.",
  },
];

const AdminPage = async () => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard administrativo</h2>

      <div className="grid gap-4 md:grid-cols-3">
        {adminCards.map((card) => (
          <Card key={card.href}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={card.href}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                Abrir pagina
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminPage;
