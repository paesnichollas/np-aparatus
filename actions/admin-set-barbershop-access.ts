"use server";

import { adminSetBarbershopAccess } from "@/data/admin/users";
import { adminActionClient } from "@/lib/action-client";
import { getActionErrorMessageFromError } from "@/lib/action-errors";
import { revalidatePublicBarbershopCache } from "@/lib/cache-invalidation";
import { revalidatePath } from "next/cache";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.string().trim().min(1),
  isActive: z.boolean(),
});

export const adminSetBarbershopAccessAction = adminActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { barbershopId, isActive }, ctx: { user } }) => {
    try {
      const result = await adminSetBarbershopAccess({
        actorUserId: user.id,
        barbershopId,
        isActive,
      });

      revalidatePath("/admin/owners");
      revalidatePath("/admin/barbershops");
      revalidatePath("/admin");

      revalidatePublicBarbershopCache({
        barbershopId: result.barbershopId,
        slug: result.barbershopSlug,
        publicSlug: result.barbershopPublicSlug,
      });

      return result;
    } catch (error) {
      returnValidationErrors(inputSchema, {
        _errors: [
          getActionErrorMessageFromError(
            error,
            isActive
              ? "Falha ao reativar acesso da barbearia."
              : "Falha ao desabilitar acesso da barbearia.",
          ),
        ],
      });
    }
  });
