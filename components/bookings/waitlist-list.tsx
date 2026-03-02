import { WaitlistEntryWithRelations } from "@/data/waitlist";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";

interface WaitlistListProps {
  entries: WaitlistEntryWithRelations[];
  emptyMessage: string;
}

const getStatusLabel = (status: WaitlistEntryWithRelations["status"]) => {
  if (status === "ACTIVE") {
    return "ATIVA";
  }

  if (status === "FULFILLED") {
    return "CONTEMPLADA";
  }

  if (status === "CANCELED") {
    return "CANCELADO";
  }

  return "EXPIRADA";
};

const getStatusVariant = (
  status: WaitlistEntryWithRelations["status"],
): "default" | "secondary" | "destructive" => {
  if (status === "FULFILLED") {
    return "default";
  }

  if (status === "CANCELED") {
    return "destructive";
  }

  return "secondary";
};

const WaitlistList = ({ entries, emptyMessage }: WaitlistListProps) => {
  if (entries.length === 0) {
    return (
      <p data-testid="waitlist-empty-state" className="text-muted-foreground text-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div data-testid="waitlist-list" className="flex flex-col gap-3">
      {entries.map((entry) => (
        <Card key={entry.id} data-testid={`waitlist-entry-${entry.id}`}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <p data-testid="waitlist-entry-barbershop-name" className="text-sm font-semibold">
                  {entry.barbershop.name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {format(entry.dateDay, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <Badge
                data-testid={`waitlist-entry-status-${entry.status.toLowerCase()}`}
                variant={getStatusVariant(entry.status)}
              >
                {getStatusLabel(entry.status)}
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-sm">Servico: {entry.service.name}</p>
              <p className="text-sm">Barbeiro: {entry.barber.name}</p>
            </div>

            {entry.status === "FULFILLED" && entry.fulfilledBookingId ? (
              <div className="flex flex-wrap items-center gap-3">
                {entry.fulfilledBooking?.paymentMethod === "STRIPE" &&
                entry.fulfilledBooking.paymentStatus === "PENDING" ? (
                  <Link
                    href={`/api/bookings/${encodeURIComponent(entry.fulfilledBookingId)}/checkout`}
                    className="text-primary text-xs font-medium underline"
                    prefetch={false}
                  >
                    Pagar agora
                  </Link>
                ) : null}
                <Link
                  href={`/bookings?bookingId=${encodeURIComponent(entry.fulfilledBookingId)}`}
                  className="text-primary text-xs font-medium underline"
                >
                  Ver agendamento criado
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default WaitlistList;
