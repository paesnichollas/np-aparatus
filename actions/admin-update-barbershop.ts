"use server";

import {
  type AdminBarbershopActionErrorCode,
  adminUpdateBarbershop,
  logAdminBarbershopError,
  toAdminBarbershopActionErrorPayload,
} from "@/data/admin/barbershops";
import { adminActionClient } from "@/lib/action-client";
import { revalidatePublicBarbershopCache } from "@/lib/cache-invalidation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const inputSchema = z.object({
  barbershopId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(1000),
  imageUrl: z.union([z.string().trim().max(500), z.null()]).optional(),
  logoUrl: z.union([z.string().trim().max(500), z.null()]).optional(),
  phones: z.array(z.string().trim().min(8).max(30)).min(1).max(6),
  slug: z.string().trim().min(3).max(80).regex(slugRegex),
  exclusiveBarber: z.boolean(),
  stripeEnabled: z.boolean(),
  ownerId: z.union([z.string().trim().min(1, "OwnerID invalido."), z.null()]).optional(),
  plan: z.enum(["BASIC", "PRO"]),
  whatsappProvider: z.enum(["NONE", "TWILIO"]),
  whatsappFrom: z.union([z.string().trim().max(60), z.null()]).optional(),
  whatsappEnabled: z.boolean(),
});

type AdminUpdateBarbershopActionSuccess = {
  ok: true;
  data: Awaited<ReturnType<typeof adminUpdateBarbershop>>;
};

type AdminUpdateBarbershopActionFailure = {
  ok: false;
  message: string;
  code?: AdminBarbershopActionErrorCode;
  field?: string;
};

type AdminUpdateBarbershopActionResult =
  | AdminUpdateBarbershopActionSuccess
  | AdminUpdateBarbershopActionFailure;

export const adminUpdateBarbershopAction = adminActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput }): Promise<AdminUpdateBarbershopActionResult> => {
    try {
      const updatedBarbershop = await adminUpdateBarbershop(parsedInput);

      revalidatePath("/admin");
      revalidatePath("/admin/barbershops");
      revalidatePath(`/admin/barbershops/${updatedBarbershop.id}`);
      revalidatePath("/admin/owners");
      revalidatePath("/owner");
      revalidatePath("/owner/reports");
      revalidatePublicBarbershopCache({
        barbershopId: updatedBarbershop.id,
        slug: updatedBarbershop.slug,
        previousSlug: updatedBarbershop.previousSlug,
        publicSlug: updatedBarbershop.publicSlug,
      });

      return {
        ok: true,
        data: updatedBarbershop,
      };
    } catch (error) {
      logAdminBarbershopError("update", error);

      const mappedError = toAdminBarbershopActionErrorPayload(
        error,
        "Falha ao atualizar barbearia.",
      );

      return {
        ok: false,
        message: mappedError.message,
        code: mappedError.code,
        field: mappedError.field,
      };
    }
  });
