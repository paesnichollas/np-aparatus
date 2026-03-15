"use server";

import { getOwnerBarbershopContextForMutation } from "@/data/barbershops";
import { protectedActionClient } from "@/lib/action-client";
import { revalidateOwnerBarbershopCache } from "@/lib/cache-invalidation";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.uuid(),
  stripeEnabled: z.boolean(),
});

export const updateBarbershopStripeEnabled = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { barbershopId, stripeEnabled }, ctx: { user } }) => {
    const barbershop = await getOwnerBarbershopContextForMutation(
      barbershopId,
      user.id,
    );

    if (!barbershop) {
      returnValidationErrors(inputSchema, {
        _errors: ["Barbearia não encontrada ou sem permissão de edição."],
      });
    }

    await prisma.barbershop.update({
      where: {
        id: barbershopId,
      },
      data: {
        stripeEnabled,
      },
    });

    revalidateOwnerBarbershopCache({
      barbershopId: barbershop.id,
      slug: barbershop.slug,
      publicSlug: barbershop.publicSlug,
    });

    return {
      success: true,
      stripeEnabled,
    };
  });

