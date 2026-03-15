"use client";

import { getValidationErrorMessageWithNested } from "@/lib/action-errors";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";

type ActionResult = {
  data?: unknown;
  validationErrors?: unknown;
  serverError?: unknown;
};

type HandleResultOptions = {
  fallbackMessage: string;
  successMessage: string;
  onSuccess?: () => void;
};

export const useMutationFeedback = () => {
  const router = useRouter();

  const handleResult = useCallback(
    (
      result: ActionResult,
      options: HandleResultOptions,
    ): result is ActionResult & { data: NonNullable<ActionResult["data"]> } => {
      const { fallbackMessage, successMessage, onSuccess } = options;

      const validationMessage = getValidationErrorMessageWithNested(
        result.validationErrors,
      );

      const errorMessage =
        validationMessage ??
        (result.serverError ? fallbackMessage : null);

      if (errorMessage) {
        toast.error(errorMessage);
        return false;
      }

      if (!result.data) {
        toast.error(fallbackMessage);
        return false;
      }

      toast.success(successMessage);
      onSuccess?.();
      router.refresh();
      return true;
    },
    [router],
  );

  return { handleResult };
};
