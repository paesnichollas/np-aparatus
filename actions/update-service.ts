"use server";

import { getOwnerBarbershopContextByOwnerId } from "@/data/barbershops";
import { getServiceById, updateServiceById } from "@/data/services";
import { protectedActionClient } from "@/lib/action-client";
import { revalidateOwnerBarbershopCache } from "@/lib/cache-invalidation";
import { resolveServiceImageUrl } from "@/lib/default-images";
import { normalizeOptionalText } from "@/lib/string-helpers";
import { isValidImageUrl } from "@/lib/url-helpers";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  serviceId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  priceInCents: z.number().int().min(0).max(1_000_000),
  durationInMinutes: z.number().int().min(5).max(240),
});

export const updateService = protectedActionClient
  .inputSchema(inputSchema)
  .action(
    async ({
      parsedInput: {
        serviceId,
        name,
        description,
        imageUrl,
        priceInCents,
        durationInMinutes,
      },
      ctx: { user },
    }) => {
      const ownerBarbershop = await getOwnerBarbershopContextByOwnerId(user.id);

      if (!ownerBarbershop) {
        returnValidationErrors(inputSchema, {
          _errors: ["Barbearia do owner não encontrada."],
        });
      }

      const service = await getServiceById(serviceId);

      if (!service) {
        returnValidationErrors(inputSchema, {
          _errors: ["Serviço não encontrado."],
        });
      }

      if (service.barbershopId !== ownerBarbershop.id) {
        throw new Error(
          "403: Você não tem permissão para editar serviços de outra barbearia.",
        );
      }

      const normalizedName = name.trim();
      const normalizedDescription = normalizeOptionalText(description);
      const normalizedImageUrl = normalizeOptionalText(imageUrl);
      const resolvedImageUrl = resolveServiceImageUrl(
        normalizedImageUrl,
        normalizedName,
      );

      if (normalizedImageUrl && !isValidImageUrl(normalizedImageUrl)) {
        returnValidationErrors(inputSchema, {
          _errors: ["A imagem enviada é inválida."],
        });
      }

      const updatedService = await updateServiceById(service.id, {
        name: normalizedName,
        description: normalizedDescription,
        imageUrl: resolvedImageUrl,
        priceInCents,
        durationInMinutes,
      });

      revalidateOwnerBarbershopCache({
        barbershopId: service.barbershop.id,
        slug: service.barbershop.slug,
        publicSlug: service.barbershop.publicSlug,
      });

      return updatedService;
    },
  );



