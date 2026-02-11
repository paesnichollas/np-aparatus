"use server";

import { protectedActionClient } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  barbershopId: z.uuid(),
  stripeEnabled: z.boolean(),
});

export const updateBarbershopStripeEnabled = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { barbershopId, stripeEnabled }, ctx: { user } }) => {
    const barbershop = await prisma.barbershop.findFirst({
      where: {
        id: barbershopId,
        ownerId: user.id,
      },
      select: {
        id: true,
      },
    });

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

    revalidatePath("/owner");

    return {
      success: true,
      stripeEnabled,
    };
  });

