import BarbershopDetails from "@/components/barbershop-details";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { Button } from "@/components/ui/button";
import { getBarbershopBySlug } from "@/data/barbershops";
import { notFound } from "next/navigation";
import Link from "next/link";

const BarbershopBySlugPage = async ({ params }: PageProps<"/b/[slug]">) => {
  const { slug } = await params;
  const barbershop = await getBarbershopBySlug(slug);

  if (!barbershop) {
    notFound();
  }

  return (
    <div>
      <Header homeHref="/home" />
      <BarbershopDetails barbershop={barbershop} showBackButton={false} />
      <Footer />
    </div>
  );
};

export default BarbershopBySlugPage;
