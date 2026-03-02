"use client";

import { markWaitlistFulfillmentSeen } from "@/actions/mark-waitlist-fulfillment-seen";
import { WaitlistEntryWithRelations } from "@/data/waitlist";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

interface WaitlistFulfillmentBannerProps {
  entries: WaitlistEntryWithRelations[];
}

const WaitlistFulfillmentBanner = ({ entries }: WaitlistFulfillmentBannerProps) => {
  const [visibleEntries, setVisibleEntries] = useState(entries);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const { executeAsync: executeMarkSeen } = useAction(markWaitlistFulfillmentSeen);

  const handleMarkSeen = async (entryId: string) => {
    setPendingEntryId(entryId);

    const result = await executeMarkSeen({ entryId });

    if (result.validationErrors) {
      setPendingEntryId(null);
      return toast.error(
        result.validationErrors._errors?.[0] ??
          "Não foi possível atualizar a notificação.",
      );
    }

    if (result.serverError) {
      setPendingEntryId(null);
      return toast.error("Não foi possível atualizar a notificação.");
    }

    setVisibleEntries((previousEntries) => {
      return previousEntries.filter((entry) => entry.id !== entryId);
    });
    setPendingEntryId(null);
  };

  if (visibleEntries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visibleEntries.map((entry) => (
        <Card key={entry.id} className="border-primary/40 bg-accent/40">
          <CardContent className="space-y-3 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Você ganhou uma vaga!</p>
              <p className="text-muted-foreground text-sm">
                {entry.barbershop.name} em{" "}
                {format(entry.dateDay, "dd/MM/yyyy", { locale: ptBR })}.
              </p>
              <p className="text-muted-foreground text-sm">
                Serviço: {entry.service.name} com {entry.barber.name}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {entry.fulfilledBookingId &&
              entry.fulfilledBooking?.paymentMethod === "STRIPE" &&
              entry.fulfilledBooking.paymentStatus === "PENDING" ? (
                <Button asChild size="sm">
                  <Link
                    href={`/api/bookings/${encodeURIComponent(entry.fulfilledBookingId)}/checkout`}
                    prefetch={false}
                  >
                    Pagar agora
                  </Link>
                </Button>
              ) : null}
              {entry.fulfilledBookingId ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/bookings?bookingId=${encodeURIComponent(entry.fulfilledBookingId)}`}
                  >
                    Ver agendamento
                  </Link>
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={pendingEntryId === entry.id}
                onClick={() => handleMarkSeen(entry.id)}
              >
                {pendingEntryId === entry.id ? "Salvando..." : "Entendi"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default WaitlistFulfillmentBanner;
