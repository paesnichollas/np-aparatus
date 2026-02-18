import BackToTopButton from "@/components/back-to-top-button";
import ExclusiveBarbershopLanding from "@/components/exclusive-barbershop-landing";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { getBarbershopById } from "@/data/barbershops";
import { requireAuthenticatedUser } from "@/lib/rbac";
import { notFound, redirect } from "next/navigation";

interface ExclusiveBarbershopPageProps {
  params: Promise<{
    id: string;
  }>;
}

const ExclusiveBarbershopPage = async ({ params }: ExclusiveBarbershopPageProps) => {
  await requireAuthenticatedUser();

  const { id } = await params;
  const barbershop = await getBarbershopById(id);

  if (!barbershop) {
    notFound();
  }

  if (!barbershop.exclusiveBarber) {
    redirect(`/barbershops/${barbershop.id}`);
  }

  return (
    <div>
      <Header
        homeHref="/home"
        chatHref={`/chat?barbershopPublicSlug=${encodeURIComponent(barbershop.slug)}`}
      />
      <ExclusiveBarbershopLanding barbershop={barbershop} />
      <Footer />
      <BackToTopButton />
    </div>
  );
};

export default ExclusiveBarbershopPage;
