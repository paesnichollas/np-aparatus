"use server";

import { protectedActionClient } from "@/lib/action-client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const inputSchema = z.object({
  barbershopId: z.uuid(),
  slug: z.string().trim().min(3).max(60).regex(slugRegex),
  logoUrl: z.string().trim().max(500),
  showInDirectory: z.boolean(),
});

export const updateBarbershopBranding = protectedActionClient
  .inputSchema(inputSchema)
  .action(
    async ({
      parsedInput: { barbershopId, slug, logoUrl, showInDirectory },
      ctx: { user },
    }) => {
      const barbershop = await prisma.barbershop.findFirst({
        where: {
          id: barbershopId,
          ownerId: user.id,
        },
        select: {
          id: true,
          slug: true,
        },
      });

      if (!barbershop) {
        returnValidationErrors(inputSchema, {
          _errors: ["Barbearia não encontrada ou sem permissão de edição."],
        });
      }

      const existingBarbershopWithSlug = await prisma.barbershop.findFirst({
        where: {
          slug,
          NOT: {
            id: barbershopId,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingBarbershopWithSlug) {
        returnValidationErrors(inputSchema, {
          _errors: ["Slug já está em uso por outra barbearia."],
        });
      }

      const normalizedLogoUrl = logoUrl.trim();

      if (normalizedLogoUrl.length > 0) {
        let parsedLogoUrl: URL;

        try {
          parsedLogoUrl = new URL(normalizedLogoUrl);
        } catch {
          returnValidationErrors(inputSchema, {
            _errors: ["Informe uma URL de logo válida."],
          });
        }

        if (
          parsedLogoUrl.protocol !== "https:" &&
          parsedLogoUrl.protocol !== "http:"
        ) {
          returnValidationErrors(inputSchema, {
            _errors: ["A URL da logo deve iniciar com http:// ou https://."],
          });
        }
      }

      const updatedBarbershop = await prisma.barbershop.update({
        where: {
          id: barbershopId,
        },
        data: {
          slug,
          logoUrl: normalizedLogoUrl || null,
          showInDirectory,
        },
        select: {
          slug: true,
          logoUrl: true,
          showInDirectory: true,
        },
      });

      revalidatePath("/");
      revalidatePath("/barbershops");
      revalidatePath("/admin");
      revalidatePath(`/b/${barbershop.slug}`);
      revalidatePath(`/b/${updatedBarbershop.slug}`);

      return {
        success: true,
        slug: updatedBarbershop.slug,
        logoUrl: updatedBarbershop.logoUrl,
        showInDirectory: updatedBarbershop.showInDirectory,
      };
    },
  );
