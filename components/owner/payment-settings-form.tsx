"use client";

import { updateBarbershopStripeEnabled } from "@/actions/update-barbershop-stripe-enabled";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";

type PaymentSettingsFormProps = {
  barbershopId: string;
  stripeEnabled: boolean;
};

const PaymentSettingsForm = ({
  barbershopId,
  stripeEnabled,
}: PaymentSettingsFormProps) => {
  const [isStripeEnabled, setIsStripeEnabled] = useState(stripeEnabled);
  const { executeAsync: executeUpdateStripeEnabled, isPending } = useAction(
    updateBarbershopStripeEnabled,
  );

  const handleCheckedChange = async (checked: boolean) => {
    const previousValue = isStripeEnabled;
    setIsStripeEnabled(checked);

    const result = await executeUpdateStripeEnabled({
      barbershopId,
      stripeEnabled: checked,
    });

    if (result.validationErrors) {
      setIsStripeEnabled(previousValue);
      toast.error(result.validationErrors._errors?.[0] ?? "Dados inválidos.");
      return;
    }

    if (result.serverError) {
      setIsStripeEnabled(previousValue);
      toast.error("Erro ao atualizar método de pagamento. Tente novamente.");
      return;
    }

    if (checked) {
      toast.success("Pagamento via Stripe ativado.");
      return;
    }

    toast.success("Pagamento via Stripe desativado. As reservas serão confirmadas diretamente.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagamento</CardTitle>
        <CardDescription>
          Defina se o cliente precisa pagar no Stripe ou se a reserva será criada
          diretamente para pagamento presencial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="stripe-enabled-switch" className="text-sm font-medium">
            Pagamento via Stripe
          </label>
          <Switch
            id="stripe-enabled-switch"
            checked={isStripeEnabled}
            onCheckedChange={handleCheckedChange}
            disabled={isPending}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSettingsForm;
