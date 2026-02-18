"use server";

import { adminDisableBarbershopAccess } from "@/data/admin/users";
import { protectedActionClient } from "@/lib/action-client";
import { revalidatePath } from "next/cache";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.string().trim().min(1),
});

export const adminDisableBarbershopAccessAction = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    try {
      const result = await adminDisableBarbershopAccess({
        actorUserId: user.id,
        barbershopId: parsedInput.barbershopId,
      });

      revalidatePath("/admin/owners");
      revalidatePath("/admin/barbershops");
      revalidatePath("/");
      revalidatePath("/barbershops");
      revalidatePath(`/b/${result.barbershopSlug}`);
      revalidatePath(`/barbershops/${result.barbershopId}`);
      revalidatePath(`/exclusive/${result.barbershopId}`);

      return result;
    } catch (error) {
      returnValidationErrors(inputSchema, {
        _errors: [
          error instanceof Error
            ? error.message
            : "Falha ao desativar a barbearia.",
        ],
      });
    }
  });
