import BarbersManagementCard from "@/components/owner/barbers-management-card";
import BrandingSettingsForm from "@/components/owner/branding-settings-form";
import PaymentSettingsForm from "@/components/owner/payment-settings-form";
import ScheduleSettingsForm from "@/components/owner/schedule-settings-form";
import ServicesManagementCard from "@/components/owner/services-management-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageSectionContent, PageSectionTitle } from "@/components/ui/page";
import {
  getBarbershopShareLink,
  getOwnerBarbershopByUserId,
} from "@/data/barbershops";
import { getServicesByBarbershopId } from "@/data/services";
import { getBookingStartDate } from "@/lib/booking-calculations";
import { getBookingStatus } from "@/lib/booking-status";
import { requireOwnerOrAdmin } from "@/lib/rbac";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart3,
  CalendarDays,
  MessageCircleMore,
  Phone,
  Scissors,
  UserRound,
} from "lucide-react";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";

const getStatusBadgeVariant = (
  status: ReturnType<typeof getBookingStatus>,
): "default" | "secondary" | "destructive" => {
  if (status === "cancelled") {
    return "destructive";
  }
  if (status === "finished") {
    return "secondary";
  }
  return "default";
};

const getStatusLabel = (status: ReturnType<typeof getBookingStatus>) => {
  if (status === "cancelled") {
    return "Cancelado";
  }
  if (status === "finished") {
    return "Finalizado";
  }
  return "Confirmado";
};

const getBookingTotalLabel = (totalPriceInCents: number | null) => {
  if (typeof totalPriceInCents === "number") {
    return `Total: ${formatCurrency(totalPriceInCents)}`;
  }

  return "Total indisponivel";
};

const getRequestOrigin = (requestHeaders: Headers) => {
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    return null;
  }

  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
};

const OwnerPage = async () => {
  const requestHeaders = await headers();
  const user = await requireOwnerOrAdmin();

  const barbershop = await getOwnerBarbershopByUserId(user.id);

  if (!barbershop) {
    return (
      <PageSectionContent>
        <PageSectionTitle>Painel Administrativo</PageSectionTitle>
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma barbearia vinculada</CardTitle>
            <CardDescription>
              Fale com o suporte para vincular sua barbearia a sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="gap-2">
              <Link href="/chat">
                <MessageCircleMore className="size-4" />
                Falar com o suporte
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageSectionContent>
    );
  }

  const services = await getServicesByBarbershopId(barbershop.id);
  const shareLink = await getBarbershopShareLink(
    barbershop.id,
    getRequestOrigin(requestHeaders),
  );

  const now = new Date();
  const futureBookings = barbershop.bookings
    .filter((booking) => getBookingStartDate(booking) >= now)
    .sort((firstBooking, secondBooking) => {
      return (
        getBookingStartDate(firstBooking).getTime() -
        getBookingStartDate(secondBooking).getTime()
      );
    });
  const pastBookings = barbershop.bookings
    .filter((booking) => getBookingStartDate(booking) < now)
    .sort((firstBooking, secondBooking) => {
      return (
        getBookingStartDate(secondBooking).getTime() -
        getBookingStartDate(firstBooking).getTime()
      );
    });

  return (
    <>
      <PageSectionContent>
        <div className="flex items-center justify-between gap-3">
          <PageSectionTitle>Painel Administrativo</PageSectionTitle>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/owner/reports">
              <BarChart3 className="size-4" />
              Relatório
            </Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{barbershop.name}</CardTitle>
            <CardDescription>{barbershop.address}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
              <Image
                src={barbershop.imageUrl}
                alt={barbershop.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="space-y-2">
              {barbershop.phones.map((phone, index) => (
                <Badge
                  key={`${phone}-${index}`}
                  variant="secondary"
                  className="mr-2 gap-1"
                >
                  <Phone className="size-3" />
                  {phone}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageSectionContent>

      <PageSectionContent>
        <PageSectionTitle>Barbeiros</PageSectionTitle>
        <BarbersManagementCard
          barbershopId={barbershop.id}
          barbers={barbershop.barbers.map((barber) => ({
            id: barber.id,
            name: barber.name,
            imageUrl: barber.imageUrl,
          }))}
        />
      </PageSectionContent>

      <PageSectionContent>
        <PageSectionTitle>Servicos</PageSectionTitle>
        <ServicesManagementCard
          barbershopId={barbershop.id}
          services={services.map((service) => ({
            id: service.id,
            name: service.name,
            description: service.description,
            imageUrl: service.imageUrl,
            priceInCents: service.priceInCents,
            durationInMinutes: service.durationInMinutes,
          }))}
        />
      </PageSectionContent>

      <PageSectionContent>
        <PageSectionTitle>Configuracoes</PageSectionTitle>
        <BrandingSettingsForm
          barbershopId={barbershop.id}
          name={barbershop.name}
          description={barbershop.description}
          address={barbershop.address}
          phones={barbershop.phones}
          imageUrl={barbershop.imageUrl}
          slug={barbershop.slug}
          shareLink={shareLink}
        />
        <PaymentSettingsForm
          barbershopId={barbershop.id}
          stripeEnabled={barbershop.stripeEnabled}
        />
        <ScheduleSettingsForm
          barbershopId={barbershop.id}
          openingHours={barbershop.openingHours.map((openingHour) => ({
            dayOfWeek: openingHour.dayOfWeek,
            openMinute: openingHour.openMinute,
            closeMinute: openingHour.closeMinute,
            closed: openingHour.closed,
          }))}
        />
      </PageSectionContent>

      <PageSectionContent>
        <PageSectionTitle>Agendamentos futuros</PageSectionTitle>
        {futureBookings.length > 0 ? (
          <div className="space-y-3">
            {futureBookings.map((booking) => {
              const bookingStartAt = getBookingStartDate(booking);
              const status = getBookingStatus(bookingStartAt, booking.cancelledAt);
              const serviceNames =
                booking.services.length > 0
                  ? booking.services.map((bookingService) => {
                      return bookingService.service.name;
                    })
                  : [booking.service.name];
              const bookingTotalLabel = getBookingTotalLabel(
                booking.totalPriceInCents,
              );

              return (
                <Card key={booking.id}>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={getStatusBadgeVariant(status)}
                        className="capitalize"
                      >
                        {getStatusLabel(status)}
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <CalendarDays className="size-3" />
                        {format(bookingStartAt, "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Scissors className="size-4" />
                        {serviceNames.join(" + ")}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Barbeiro: {booking.barber?.name ?? "Nao informado"}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {bookingTotalLabel}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <UserRound className="size-4" />
                        {booking.user.name}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Nenhum agendamento futuro.
              </p>
            </CardContent>
          </Card>
        )}
      </PageSectionContent>

      <PageSectionContent>
        <PageSectionTitle>Agendamentos passados</PageSectionTitle>
        {pastBookings.length > 0 ? (
          <div className="space-y-3">
            {pastBookings.map((booking) => {
              const bookingStartAt = getBookingStartDate(booking);
              const status = getBookingStatus(bookingStartAt, booking.cancelledAt);
              const serviceNames =
                booking.services.length > 0
                  ? booking.services.map((bookingService) => {
                      return bookingService.service.name;
                    })
                  : [booking.service.name];
              const bookingTotalLabel = getBookingTotalLabel(
                booking.totalPriceInCents,
              );

              return (
                <Card key={booking.id}>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={getStatusBadgeVariant(status)}
                        className="capitalize"
                      >
                        {getStatusLabel(status)}
                      </Badge>
                      <Badge variant="secondary" className="gap-1">
                        <CalendarDays className="size-3" />
                        {format(bookingStartAt, "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <Scissors className="size-4" />
                        {serviceNames.join(" + ")}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Barbeiro: {booking.barber?.name ?? "Nao informado"}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {bookingTotalLabel}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <UserRound className="size-4" />
                        {booking.user.name}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Nenhum agendamento passado.
              </p>
            </CardContent>
          </Card>
        )}
      </PageSectionContent>
    </>
  );
};

export default OwnerPage;
