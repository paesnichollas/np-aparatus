import BarbershopDetails from "@/components/barbershop-details";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { getBarbershopBySlug } from "@/data/barbershops";
import { notFound } from "next/navigation";

const BarbershopBySlugPage = async ({ params }: PageProps<"/b/[slug]">) => {
  const { slug } = await params;
  const barbershop = await getBarbershopBySlug(slug);

  if (!barbershop) {
    notFound();
  }

  return (
    <div>
      <Header
        logoUrl={barbershop.logoUrl}
        homeHref={`/b/${barbershop.slug}`}
        showDirectoryLinks={false}
      />
      <BarbershopDetails barbershop={barbershop} showBackButton={false} />
      <Footer />
    </div>
  );
};

export default BarbershopBySlugPage;
