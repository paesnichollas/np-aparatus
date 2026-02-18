"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { adminSetBarbershopActiveAction } from "@/actions/admin-set-barbershop-active";
import { Button } from "@/components/ui/button";

interface BarbershopStatusToggleProps {
  barbershopId: string;
  isActive: boolean;
}

const getValidationErrorMessage = (validationErrors: unknown) => {
  const getFirstErrorFromNode = (value: unknown): string | null => {
    if (!value || typeof value !== "object") {
      return null;
    }

    const errors = (value as { _errors?: unknown })._errors;

    if (Array.isArray(errors)) {
      const firstStringError = errors.find(
        (errorItem): errorItem is string =>
          typeof errorItem === "string" && errorItem.trim().length > 0,
      );

      if (firstStringError) {
        return firstStringError;
      }
    }

    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      const nestedError = getFirstErrorFromNode(nestedValue);

      if (nestedError) {
        return nestedError;
      }
    }

    return null;
  };

  return getFirstErrorFromNode(validationErrors);
};

const BarbershopStatusToggle = ({
  barbershopId,
  isActive,
}: BarbershopStatusToggleProps) => {
  const router = useRouter();
  const { executeAsync, isPending } = useAction(adminSetBarbershopActiveAction);

  const handleToggle = async () => {
    const result = await executeAsync({
      barbershopId,
      isActive: !isActive,
    });

    const validationError = getValidationErrorMessage(result.validationErrors);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (result.serverError || !result.data) {
      toast.error("Falha ao atualizar status da barbearia.");
      return;
    }

    toast.success(result.data.isActive ? "Barbearia ativada." : "Barbearia desativada.");
    router.refresh();
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={isActive ? "destructive" : "outline"}
      disabled={isPending}
      onClick={handleToggle}
    >
      {isPending ? "Salvando..." : isActive ? "Desativar" : "Ativar"}
    </Button>
  );
};

export default BarbershopStatusToggle;
