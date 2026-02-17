import { getBarbershopById } from "@/data/barbershops";
import { notFound, redirect } from "next/navigation";

interface BarbershopPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const BarbershopPage = async ({
  params,
  searchParams,
}: BarbershopPageProps) => {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const barbershop = await getBarbershopById(id);

  if (!barbershop) {
    notFound();
  }

  const nextSearchParams = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      nextSearchParams.set(key, value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        nextSearchParams.append(key, entry);
      });
    }
  });

  const destinationPath = barbershop.exclusiveBarber
    ? `/exclusive/${barbershop.id}`
    : `/b/${barbershop.slug}`;
  const destinationSearch = nextSearchParams.toString();
  const destinationUrl = destinationSearch
    ? `${destinationPath}?${destinationSearch}`
    : destinationPath;

  redirect(destinationUrl);
};

export default BarbershopPage;
