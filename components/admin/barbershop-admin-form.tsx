"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { adminUpdateBarbershopAction } from "@/actions/admin-update-barbershop";
import BarbershopStatusToggle from "@/components/admin/barbershop-status-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface BarbershopAdminFormProps {
  barbershop: {
    id: string;
    name: string;
    phones: string[];
    exclusiveBarber: boolean;
    stripeEnabled: boolean;
    isActive: boolean;
    publicSlug: string;
    ownerId: string | null;
    plan: "BASIC" | "PRO";
    whatsappProvider: "NONE" | "TWILIO";
    whatsappFrom: string | null;
    whatsappEnabled: boolean;
    owner: {
      id: string;
      name: string;
      email: string;
      role: "CUSTOMER" | "OWNER" | "ADMIN";
    } | null;
  };
}

const parsePhonesInput = (value: string) => {
  return value
    .split(/[\n,;]+/)
    .map((phone) => phone.trim())
    .filter(Boolean);
};

const formatPhonesInput = (phones: string[]) => phones.join(", ");

const getValidationError = (validationErrors: unknown) => {
  if (!validationErrors || typeof validationErrors !== "object") {
    return null;
  }

  const errors = (validationErrors as { _errors?: unknown })._errors;

  if (!Array.isArray(errors)) {
    return null;
  }

  return typeof errors[0] === "string" ? errors[0] : null;
};

const BarbershopAdminForm = ({ barbershop }: BarbershopAdminFormProps) => {
  const router = useRouter();
  const [name, setName] = useState(barbershop.name);
  const [phonesText, setPhonesText] = useState(formatPhonesInput(barbershop.phones));
  const [exclusiveBarber, setExclusiveBarber] = useState(barbershop.exclusiveBarber);
  const [stripeEnabled, setStripeEnabled] = useState(barbershop.stripeEnabled);
  const [ownerIdInput, setOwnerIdInput] = useState(barbershop.ownerId ?? "");
  const [plan, setPlan] = useState<"BASIC" | "PRO">(barbershop.plan);
  const [whatsappProvider, setWhatsappProvider] = useState<"NONE" | "TWILIO">(
    barbershop.whatsappProvider,
  );
  const [whatsappFrom, setWhatsappFrom] = useState(barbershop.whatsappFrom ?? "");
  const [whatsappEnabled, setWhatsappEnabled] = useState(barbershop.whatsappEnabled);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const { executeAsync, isPending } = useAction(adminUpdateBarbershopAction);

  const currentOwnerLabel = useMemo(() => {
    if (!barbershop.owner) {
      return "Sem owner";
    }

    return `${barbershop.owner.name} (${barbershop.owner.email})`;
  }, [barbershop.owner]);

  const isSubmitting = isPending || isSavingPlan;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedPhones = parsePhonesInput(phonesText);

    if (parsedPhones.length === 0) {
      toast.error("Informe pelo menos um telefone.");
      return;
    }

    const result = await executeAsync({
      barbershopId: barbershop.id,
      name: name.trim(),
      phones: parsedPhones,
      exclusiveBarber,
      stripeEnabled,
      ownerId: ownerIdInput.trim().length > 0 ? ownerIdInput.trim() : null,
    });

    const validationError = getValidationError(result.validationErrors);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (result.serverError || !result.data) {
      toast.error("Falha ao atualizar barbearia.");
      return;
    }

    setIsSavingPlan(true);

    try {
      const response = await fetch(`/api/admin/barbershops/${barbershop.id}/plan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan,
          whatsappProvider: plan === "PRO" ? whatsappProvider : "NONE",
          whatsappFrom: plan === "PRO" ? whatsappFrom.trim() || null : null,
          whatsappEnabled: plan === "PRO" ? whatsappEnabled : false,
        }),
      });

      if (!response.ok) {
        const responseBody = (await response.json().catch(() => null)) as
          | {
              error?: string;
            }
          | null;

        toast.error(responseBody?.error ?? "Falha ao atualizar configuracoes de plano.");
        return;
      }

      toast.success("Barbearia atualizada com sucesso.");
      router.refresh();
    } finally {
      setIsSavingPlan(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label>Status</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={barbershop.isActive ? "secondary" : "destructive"}>
            {barbershop.isActive ? "Ativa" : "Inativa"}
          </Badge>
          <BarbershopStatusToggle
            barbershopId={barbershop.id}
            isActive={barbershop.isActive}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-barbershop-name">Nome</Label>
        <Input
          id="admin-barbershop-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-barbershop-phones">Telefones</Label>
        <Input
          id="admin-barbershop-phones"
          value={phonesText}
          onChange={(event) => setPhonesText(event.target.value)}
          disabled={isSubmitting}
        />
        <p className="text-muted-foreground text-xs">
          Separe por virgula, ponto e virgula ou quebra de linha.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-barbershop-owner-id">Owner ID</Label>
        <Input
          id="admin-barbershop-owner-id"
          value={ownerIdInput}
          onChange={(event) => setOwnerIdInput(event.target.value)}
          disabled={isSubmitting}
          placeholder="UUID do owner (vazio remove owner)"
        />
        <p className="text-muted-foreground text-xs">Owner atual: {currentOwnerLabel}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-barbershop-public-slug">Public slug (readonly)</Label>
        <Input id="admin-barbershop-public-slug" value={barbershop.publicSlug} readOnly disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="admin-barbershop-plan">Plano</Label>
        <select
          id="admin-barbershop-plan"
          value={plan}
          onChange={(event) => {
            const selectedPlan = event.target.value === "PRO" ? "PRO" : "BASIC";
            setPlan(selectedPlan);

            if (selectedPlan === "BASIC") {
              setWhatsappProvider("NONE");
              setWhatsappEnabled(false);
            } else if (whatsappProvider === "NONE") {
              setWhatsappProvider("TWILIO");
            }
          }}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          disabled={isSubmitting}
        >
          <option value="BASIC">BASIC</option>
          <option value="PRO">PRO</option>
        </select>
      </div>

      {plan === "PRO" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="admin-whatsapp-provider">WhatsApp provider</Label>
            <select
              id="admin-whatsapp-provider"
              value={whatsappProvider}
              onChange={(event) =>
                setWhatsappProvider(event.target.value === "TWILIO" ? "TWILIO" : "NONE")
              }
              className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              disabled={isSubmitting}
            >
              <option value="NONE">NONE</option>
              <option value="TWILIO">TWILIO</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-whatsapp-from">WhatsApp from</Label>
            <Input
              id="admin-whatsapp-from"
              value={whatsappFrom}
              onChange={(event) => setWhatsappFrom(event.target.value)}
              disabled={isSubmitting}
              placeholder="whatsapp:+14155238886"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="admin-whatsapp-enabled"
              checked={whatsappEnabled}
              onCheckedChange={setWhatsappEnabled}
              disabled={isSubmitting}
            />
            <Label htmlFor="admin-whatsapp-enabled">whatsappEnabled</Label>
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="admin-barbershop-exclusive-barber"
            checked={exclusiveBarber}
            onCheckedChange={setExclusiveBarber}
            disabled={isSubmitting}
          />
          <Label htmlFor="admin-barbershop-exclusive-barber">exclusiveBarber</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="admin-barbershop-stripe-enabled"
            checked={stripeEnabled}
            onCheckedChange={setStripeEnabled}
            disabled={isSubmitting}
          />
          <Label htmlFor="admin-barbershop-stripe-enabled">stripeEnabled</Label>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar alteracoes"}
      </Button>
    </form>
  );
};

export default BarbershopAdminForm;
