import { revalidatePath, revalidateTag } from "next/cache";

import {
  barbershopByIdTag,
  barbershopByPublicSlugTag,
  barbershopBySlugTag,
  barbershopsListTag,
  popularBarbershopsTag,
} from "@/lib/cache-tags";
import { normalizeOptionalText } from "@/lib/string-helpers";

interface RevalidatePublicBarbershopCacheInput {
  barbershopId: string;
  slug?: string | null;
  previousSlug?: string | null;
  publicSlug?: string | null;
}

interface RevalidateOwnerBarbershopCacheInput {
  barbershopId: string;
  slug?: string | null;
  previousSlug?: string | null;
  publicSlug?: string | null;
}

interface RevalidateBookingSurfacesInput {
  includeHome?: boolean;
  includeOwner?: boolean;
  includeAdmin?: boolean;
}

export const revalidatePublicBarbershopCache = ({
  barbershopId,
  slug,
  previousSlug,
  publicSlug,
}: RevalidatePublicBarbershopCacheInput) => {
  const normalizedBarbershopId = barbershopId.trim();

  if (!normalizedBarbershopId) {
    return;
  }

  const normalizedSlug = normalizeOptionalText(slug);
  const normalizedPreviousSlug = normalizeOptionalText(previousSlug);
  const normalizedPublicSlug = normalizeOptionalText(publicSlug);

  revalidateTag(barbershopsListTag(), "max");
  revalidateTag(popularBarbershopsTag(), "max");
  revalidateTag(barbershopByIdTag(normalizedBarbershopId), "max");

  revalidatePath("/");
  revalidatePath("/barbershops");
  revalidatePath(`/barbershops/${normalizedBarbershopId}`);

  if (normalizedSlug) {
    revalidateTag(barbershopBySlugTag(normalizedSlug), "max");
    revalidatePath(`/b/${normalizedSlug}`);
    revalidatePath(`/e/${normalizedSlug}`);
  }

  if (normalizedPreviousSlug && normalizedPreviousSlug !== normalizedSlug) {
    revalidateTag(barbershopBySlugTag(normalizedPreviousSlug), "max");
    revalidatePath(`/b/${normalizedPreviousSlug}`);
    revalidatePath(`/e/${normalizedPreviousSlug}`);
  }

  if (normalizedPublicSlug) {
    revalidateTag(barbershopByPublicSlugTag(normalizedPublicSlug), "max");
    revalidatePath(`/s/${normalizedPublicSlug}`);
  }
};

export const revalidateOwnerBarbershopCache = ({
  barbershopId,
  slug,
  previousSlug,
  publicSlug,
}: RevalidateOwnerBarbershopCacheInput) => {
  revalidatePath("/owner");
  revalidatePublicBarbershopCache({
    barbershopId,
    slug,
    previousSlug,
    publicSlug,
  });
};

export const revalidateBookingSurfaces = ({
  includeHome = true,
  includeOwner = true,
  includeAdmin = true,
}: RevalidateBookingSurfacesInput = {}) => {
  revalidatePath("/bookings");

  if (includeHome) {
    revalidatePath("/");
  }

  if (includeOwner) {
    revalidatePath("/owner");
  }

  if (includeAdmin) {
    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
  }
};

interface RevalidateAdminBarbershopSurfacesInput {
  barbershopId: string;
  slug?: string | null;
  previousSlug?: string | null;
  publicSlug?: string | null;
}

export const revalidateAdminBarbershopSurfaces = ({
  barbershopId,
  slug,
  previousSlug,
  publicSlug,
}: RevalidateAdminBarbershopSurfacesInput) => {
  revalidatePath("/admin");
  revalidatePath("/admin/barbershops");
  revalidatePath(`/admin/barbershops/${barbershopId}`);
  revalidatePath("/admin/owners");
  revalidatePath("/owner");
  revalidatePath("/owner/reports");
  revalidatePublicBarbershopCache({
    barbershopId,
    slug,
    previousSlug,
    publicSlug,
  });
};
