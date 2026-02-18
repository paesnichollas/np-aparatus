import type { NotificationJobType } from "@/generated/prisma/client";
import { getBookingStartDate } from "@/lib/booking-calculations";
import { BOOKING_TIMEZONE } from "@/lib/booking-time";
import { formatCurrency } from "@/lib/utils";

interface NotificationBookingPayload {
  user: {
    name: string;
    phone: string | null;
  };
  barbershop: {
    name: string;
    phones: string[];
  };
  barber: {
    name: string;
  } | null;
  service: {
    name: string;
  };
  services: Array<{
    service: {
      name: string;
    };
  }>;
  totalPriceInCents: number | null;
  startAt: Date | null;
  date: Date;
}

const getTimeZone = () => {
  return process.env.APP_TIMEZONE?.trim() || BOOKING_TIMEZONE;
};

const formatBookingDateTime = (date: Date) => {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: getTimeZone(),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getBookingServiceNames = (booking: NotificationBookingPayload) => {
  if (booking.services.length > 0) {
    return booking.services.map((bookingService) => bookingService.service.name).join(", ");
  }

  return booking.service.name;
};

const getContactPhonesLabel = (phones: string[]) => {
  if (phones.length === 0) {
    return "telefone indisponivel";
  }

  return phones.join(" / ");
};

const getBookingTotalLabel = (totalPriceInCents: number | null) => {
  if (typeof totalPriceInCents !== "number") {
    return "valor indisponivel";
  }

  return formatCurrency(totalPriceInCents);
};

const getReminderInstruction = (phones: string[]) => {
  return `Para reagendar ou cancelar, fale com a barbearia: ${getContactPhonesLabel(phones)}.`;
};

const getBookingDate = (booking: NotificationBookingPayload) => {
  return getBookingStartDate({
    startAt: booking.startAt,
    date: booking.date,
  });
};

export const buildNotificationContentVariables = ({
  type,
  booking,
}: {
  type: NotificationJobType;
  booking: NotificationBookingPayload;
}): Record<string, string> => {
  const bookingDate = getBookingDate(booking);
  const formattedDate = formatBookingDateTime(bookingDate);
  const servicesLabel = getBookingServiceNames(booking);
  const barberName = booking.barber?.name ?? "Nao informado";
  const totalLabel = getBookingTotalLabel(booking.totalPriceInCents);
  const phonesLabel = getContactPhonesLabel(booking.barbershop.phones);
  const reminderInstruction = getReminderInstruction(booking.barbershop.phones);

  if (type === "BOOKING_CONFIRM") {
    return {
      "1": booking.user.name,
      "2": booking.barbershop.name,
      "3": formattedDate,
      "4": servicesLabel,
      "5": barberName,
      "6": totalLabel,
      "7": phonesLabel,
      "8": reminderInstruction,
    };
  }

  return {
    "1": booking.user.name,
    "2": booking.barbershop.name,
    "3": formattedDate,
    "4": servicesLabel,
    "5": phonesLabel,
    "6": reminderInstruction,
  };
};

export const buildNotificationTextBody = ({
  type,
  booking,
}: {
  type: NotificationJobType;
  booking: NotificationBookingPayload;
}) => {
  const bookingDate = getBookingDate(booking);
  const formattedDate = formatBookingDateTime(bookingDate);
  const servicesLabel = getBookingServiceNames(booking);
  const barberName = booking.barber?.name ?? "Nao informado";
  const totalLabel = getBookingTotalLabel(booking.totalPriceInCents);
  const reminderInstruction = getReminderInstruction(booking.barbershop.phones);

  if (type === "BOOKING_CONFIRM") {
    return [
      `Reserva confirmada na ${booking.barbershop.name}.`,
      `Data: ${formattedDate}.`,
      `Servicos: ${servicesLabel}.`,
      `Barbeiro: ${barberName}.`,
      `Total: ${totalLabel}.`,
      reminderInstruction,
    ].join("\n");
  }

  return [
    `Lembrete da sua reserva na ${booking.barbershop.name}.`,
    `Data: ${formattedDate}.`,
    `Servicos: ${servicesLabel}.`,
    reminderInstruction,
  ].join("\n");
};
