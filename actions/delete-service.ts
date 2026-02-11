"use server";

import { protectedActionClient } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  serviceId: z.uuid(),
});

export const deleteService = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { serviceId }, ctx: { user } }) => {
    const service = await prisma.barbershopService.findFirst({
      where: {
        id: serviceId,
        deletedAt: null,
        barbershop: {
          ownerId: user.id,
        },
      },
      select: {
        id: true,
        barbershop: {
          select: {
            id: true,
            slug: true,
          },
        },
      },
    });

    if (!service) {
      returnValidationErrors(inputSchema, {
        _errors: ["Serviço não encontrado ou sem permissão de remoção."],
      });
    }

    await prisma.barbershopService.update({
      where: {
        id: service.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    revalidatePath("/owner");
    revalidatePath(`/b/${service.barbershop.slug}`);
    revalidatePath(`/barbershops/${service.barbershop.id}`);

    return {
      success: true,
      serviceId: service.id,
    };
  });

