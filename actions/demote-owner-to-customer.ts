"use server";

import {
  OwnerAssignmentError,
  demoteOwnerToCustomerByAdmin,
} from "@/data/owner-assignment";
import { protectedActionClient } from "@/lib/action-client";
import { revalidatePath } from "next/cache";
import { returnValidationErrors } from "next-safe-action";
import { z } from "zod";

const inputSchema = z.object({
  userId: z.uuid(),
});

export const demoteOwnerToCustomer = protectedActionClient
  .inputSchema(inputSchema)
  .action(async ({ parsedInput: { userId }, ctx: { user } }) => {
    try {
      const result = await demoteOwnerToCustomerByAdmin({
        actorUserId: user.id,
        userId,
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
  });
