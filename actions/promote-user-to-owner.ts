"use server";

import {
  OwnerAssignmentError,
  promoteUserToOwnerByAdmin,
} from "@/data/owner-assignment";
import { protectedActionClient } from "@/lib/action-client";
import { revalidatePath } from "next/cache";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  userId: z.uuid(),
  barbershopId: z.uuid().optional(),
  allowTransfer: z.boolean().optional(),
});

export const promoteUserToOwner = protectedActionClient
  .inputSchema(inputSchema)
  .action(
    async ({
      parsedInput: { userId, barbershopId, allowTransfer },
      ctx: { user },
    }) => {
      try {
        const result = await promoteUserToOwnerByAdmin({
          actorUserId: user.id,
          userId,
          barbershopId,
          allowTransfer: allowTransfer ?? false,
        });

        revalidatePath("/admin");

        return result;
      } catch (error) {
        if (error instanceof OwnerAssignmentError) {
          returnValidationErrors(inputSchema, {
            _errors: [error.message],
          });
        }

        throw error;
      }
    },
  );
