import {
  type AdminBookingStatusFilter,
  adminListBookings,
} from "@/data/admin/bookings";
import { adminListBarbershopOptions } from "@/data/admin/barbershops";
import {
  buildPaginationHref,
  parseDateParam,
  parseFilterParam,
  parsePageParam,
  parseStringParam,
} from "@/lib/search-params";
import { AdminListPageFrame } from "@/components/admin/admin-list-page-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AdminBookingsPageProps {
  searchParams: Promise<{
    barbershopId?: string | string[];
    status?: string | string[];
    startDate?: string | string[];
    endDate?: string | string[];
    page?: string | string[];
  }>;
}

const statusValues = new Set<AdminBookingStatusFilter>([
  "ALL",
  "UPCOMING",
  "PAST",
  "CANCELLED",
  "FAILED",
]);

const getBookingStatusLabel = ({
  cancelledAt,
  date,
  paymentStatus,
}: {
  cancelledAt: Date | null;
  date: Date;
  paymentStatus: string;
}) => {
  if (cancelledAt) {
    return "Cancelado";
  }

  if (paymentStatus === "FAILED") {
    return "Falha";
  }

  if (date < new Date()) {
    return "Passado";
  }

  return "Próximo";
};

const AdminBookingsPage = async ({ searchParams }: AdminBookingsPageProps) => {
  const resolvedSearchParams = await searchParams;
  const barbershopId = parseStringParam(resolvedSearchParams.barbershopId);
  const status = parseFilterParam(
    resolvedSearchParams.status,
    statusValues,
    "ALL",
  ) as AdminBookingStatusFilter;
  const startDate = parseDateParam(resolvedSearchParams.startDate);
  const endDate = parseDateParam(resolvedSearchParams.endDate);
  const page = parsePageParam(resolvedSearchParams.page);

  const paginationParams: Record<string, string | number | undefined> = {
    barbershopId: barbershopId || undefined,
    status: status !== "ALL" ? status : undefined,
    startDate: parseStringParam(resolvedSearchParams.startDate) || undefined,
    endDate: parseStringParam(resolvedSearchParams.endDate) || undefined,
  };

  const [bookingsResult, barbershopOptions] = await Promise.all([
    adminListBookings({
      barbershopId: barbershopId || undefined,
      status,
      startDate,
      endDate,
      page,
    }),
    adminListBarbershopOptions(),
  ]);

  const createPageHref = (nextPage: number) =>
    buildPaginationHref("/admin/bookings", paginationParams, nextPage);

  return (
    <AdminListPageFrame
      title="Agendamentos"
      description="Lista global de agendamentos com filtros por barbearia, período e status."
      filterForm={
        <>
          <select
              name="barbershopId"
              defaultValue={barbershopId}
              className="bg-background border-input h-9 rounded-md border px-3 text-sm"
            >
              <option value="">Todas as barbearias</option>
              {barbershopOptions.map((barbershop) => (
                <option key={barbershop.id} value={barbershop.id}>
                  {barbershop.name}
                </option>
              ))}
            </select>

            <select
              name="status"
              defaultValue={status}
              className="bg-background border-input h-9 rounded-md border px-3 text-sm"
            >
              <option value="ALL">Todos os status</option>
              <option value="UPCOMING">UPCOMING</option>
              <option value="PAST">PAST</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="FAILED">FAILED</option>
            </select>

            <Input
              type="date"
              name="startDate"
              defaultValue={parseStringParam(resolvedSearchParams.startDate)}
              className="w-full md:max-w-44"
            />
            <Input
              type="date"
              name="endDate"
              defaultValue={parseStringParam(resolvedSearchParams.endDate)}
              className="w-full md:max-w-44"
            />

          <Button type="submit">Filtrar</Button>
        </>
      }
      pagination={{
        page: bookingsResult.page,
        totalPages: bookingsResult.totalPages,
        totalCount: bookingsResult.totalCount,
        createPageHref,
      }}
    >
      <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Barbearia</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingsResult.items.length > 0 ? (
                bookingsResult.items.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      {booking.date.toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell>{booking.barbershop.name}</TableCell>
                    <TableCell>{booking.user.name}</TableCell>
                    <TableCell>{booking.service.name}</TableCell>
                    <TableCell>
                      {getBookingStatusLabel({
                        cancelledAt: booking.cancelledAt,
                        date: booking.date,
                        paymentStatus: booking.paymentStatus,
                      })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-sm">
                    Nenhum agendamento encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
    </AdminListPageFrame>
  );
};

export default AdminBookingsPage;
