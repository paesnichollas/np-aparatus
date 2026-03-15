"use server";

import { getOwnerBarbershopContextForMutation } from "@/data/barbershops";
import { protectedActionClient } from "@/lib/action-client";
import { revalidateOwnerBarbershopCache } from "@/lib/cache-invalidation";
import { prisma } from "@/lib/prisma";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z
  .object({
    barbershopId: z.uuid(),
    services: z
      .array(
        z.object({
          id: z.uuid(),
          durationInMinutes: z.number().int().min(5).max(240),
        }),
      )
      .min(1),
  })
  .superRefine((input, ctx) => {
    const serviceIds = new Set(input.services.map((service) => service.id));
    if (serviceIds.size !== input.services.length) {
      ctx.addIssue({
        code: "custom",
        message: "Não pode haver serviços duplicados.",
        path: ["services"],
      });
    }
  });

export const updateBarbershopServicesDuration = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { barbershopId, services }, ctx: { user } }) => {
    const barbershop = await getOwnerBarbershopContextForMutation(
      barbershopId,
      user.id,
    );

    if (!barbershop) {
      returnValidationErrors(inputSchema, {
        _errors: ["Barbearia não encontrada ou sem permissão de edição."],
      });
    }

    const requestedServiceIds = services.map((service) => service.id);
    const existingServices = await prisma.barbershopService.findMany({
      where: {
        barbershopId,
        id: {
          in: requestedServiceIds,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existingServices.length !== requestedServiceIds.length) {
      returnValidationErrors(inputSchema, {
        _errors: ["Um ou mais serviços informados são inválidos."],
      });
    }

    await prisma.$transaction(
      services.map((service) =>
        prisma.barbershopService.update({
          where: {
            id: service.id,
          },
          data: {
            durationInMinutes: service.durationInMinutes,
          },
        }),
      ),
    );

    revalidateOwnerBarbershopCache({
      barbershopId: barbershop.id,
      slug: barbershop.slug,
      publicSlug: barbershop.publicSlug,
    });

    return {
      success: true,
    };
  });

