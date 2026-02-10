import { getBarbershopById } from "@/data/barbershops";
import { notFound, redirect } from "next/navigation";

const BarbershopPage = async ({ params }: PageProps<"/barbershops/[id]">) => {
  const { id } = await params;
  const barbershop = await getBarbershopById(id);

  if (!barbershop) {
    notFound();
  }

  redirect(`/b/${barbershop.slug}`);
};

export default BarbershopPage;
