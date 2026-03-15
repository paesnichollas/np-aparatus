"use server";

import { adminDeleteBarbershopSafely } from "@/data/admin/barbershops";
import { adminActionClient } from "@/lib/action-client";
import { getActionErrorMessageFromError } from "@/lib/action-errors";
import { revalidateAdminBarbershopSurfaces } from "@/lib/cache-invalidation";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.uuid(),
});

export const adminDeleteBarbershopAction = adminActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { barbershopId } }) => {
    try {
      const deletedBarbershop = await adminDeleteBarbershopSafely(barbershopId);

      revalidateAdminBarbershopSurfaces({
        barbershopId: deletedBarbershop.id,
        slug: deletedBarbershop.slug,
        publicSlug: deletedBarbershop.publicSlug,
      });

      return deletedBarbershop;
    } catch (error) {
      returnValidationErrors(inputSchema, {
        _errors: [getActionErrorMessageFromError(error, "Falha ao excluir barbearia.")],
      });
    }
  });
