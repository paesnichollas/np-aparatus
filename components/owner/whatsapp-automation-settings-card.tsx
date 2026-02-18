"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface WhatsAppAutomationSettingsCardProps {
  plan: "BASIC" | "PRO";
  initialSettings: {
    sendBookingConfirmation: boolean;
    sendReminder24h: boolean;
    sendReminder1h: boolean;
  } | null;
}

const DEFAULT_SETTINGS = {
  sendBookingConfirmation: true,
  sendReminder24h: true,
  sendReminder1h: true,
};

const WhatsAppAutomationSettingsCard = ({
  plan,
  initialSettings,
}: WhatsAppAutomationSettingsCardProps) => {
  const [settings, setSettings] = useState({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });
  const [isPending, setIsPending] = useState(false);

  const updateSettings = async (nextSettings: Partial<typeof settings>) => {
    const previousSettings = settings;
    const optimisticSettings = {
      ...settings,
      ...nextSettings,
    };

    setSettings(optimisticSettings);
    setIsPending(true);

    try {
      const response = await fetch("/api/owner/barbershop/whatsapp-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextSettings),
      });

      if (!response.ok) {
        setSettings(previousSettings);

        const responseBody = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;

        if (responseBody?.code === "FEATURE_NOT_AVAILABLE") {
          toast.error("Recurso disponivel somente no plano PRO.");
          return;
        }

        toast.error(
          responseBody?.error ??
            "Falha ao atualizar configuracoes do WhatsApp.",
        );
        return;
      }

      toast.success("Configuracoes de WhatsApp atualizadas.");
    } finally {
      setIsPending(false);
    }
  };

  if (plan !== "PRO") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Automatico (Plano PRO)</CardTitle>
          <CardDescription>
            Este recurso esta disponivel apenas para barbearias no plano PRO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/chat">Falar com suporte para upgrade</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Automatico</CardTitle>
        <CardDescription>
          Controle os tipos de mensagens automaticas enviadas para seus
          clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="send-booking-confirmation"
            className="text-sm font-medium"
          >
            Confirmação da reserva
          </label>
          <Switch
            id="send-booking-confirmation"
            checked={settings.sendBookingConfirmation}
            onCheckedChange={(checked) => {
              void updateSettings({ sendBookingConfirmation: checked });
            }}
            disabled={isPending}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="send-reminder-24h" className="text-sm font-medium">
            Lembrete 24h antes
          </label>
          <Switch
            id="send-reminder-24h"
            checked={settings.sendReminder24h}
            onCheckedChange={(checked) => {
              void updateSettings({ sendReminder24h: checked });
            }}
            disabled={isPending}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="send-reminder-1h" className="text-sm font-medium">
            Lembrete 1h antes
          </label>
          <Switch
            id="send-reminder-1h"
            checked={settings.sendReminder1h}
            onCheckedChange={(checked) => {
              void updateSettings({ sendReminder1h: checked });
            }}
            disabled={isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppAutomationSettingsCard;
