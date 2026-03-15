import { prisma } from "@/lib/prisma";
import { revalidateBookingSurfaces } from "@/lib/cache-invalidation";
import { scheduleBookingNotificationJobs } from "@/lib/notifications/notification-jobs";
import {
  BOOKING_SLOT_BUFFER_MINUTES,
  getBookingMinuteOfDay,
  isBookingDateTimeAtOrBeforeNowWithBuffer,
} from "@/lib/booking-time";
import {
  ACTIVE_BOOKING_PAYMENT_WHERE,
  resolveInitialPaymentState,
  UNPAID_PAYMENT_STATUS,
} from "@/lib/booking-payment";
import {
  calculateBookingTotals,
  checkTimeSlotCollision,
  deduplicateServiceIds,
  getDayWindow,
  hasInvalidServiceData,
} from "@/lib/booking-mutation-helpers";
import type { PaymentMethod } from "@/generated/prisma/client";

export type BookingCreationCustomerInput = {
  barbershopId: string;
  serviceId: string;
  barberId: string;
  date: Date;
  userId: string;
};

export type BookingCreationCheckoutInput = {
  barbershopId: string;
  barberId: string;
  serviceIds: string[];
  startAt: Date;
  userId: string;
  stripeEnabled: boolean;
  paymentMethod?: PaymentMethod;
  stripeSessionId?: string;
};

export type BookingCreationOwnerInput = {
  barbershopId: string;
  barberId: string;
  serviceIds: string[];
  date: Date;
  clientUserId: string;
};

type ServiceForTotals = {
  id: string;
  name: string;
  priceInCents: number;
  durationInMinutes: number;
};

type ValidationResult =
  | { ok: true; services: ServiceForTotals[]; totalDurationMinutes: number; totalPriceInCents: number }
  | { ok: false; error: string };

async function validateAndResolveCustomerInput(
  input: BookingCreationCustomerInput,
): Promise<ValidationResult> {
  const { barbershopId, serviceId, barberId, date } = input;

  if (isBookingDateTimeAtOrBeforeNowWithBuffer(date, BOOKING_SLOT_BUFFER_MINUTES)) {
    return {
      ok: false,
      error:
        "Data e horário selecionados já passaram ou estão muito próximos do horário atual.",
    };
  }

  const [service, barber, barbershop] = await Promise.all([
    prisma.barbershopService.findFirst({
      where: { id: serviceId, barbershopId, deletedAt: null },
      select: {
        id: true,
        name: true,
        priceInCents: true,
        durationInMinutes: true,
        barbershop: { select: { isActive: true } },
      },
    }),
    prisma.barber.findFirst({
      where: { id: barberId, barbershopId },
      select: { id: true },
    }),
    prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { isActive: true },
    }),
  ]);

  if (!service) {
    return { ok: false, error: "Serviço não encontrado. Por favor, selecione outro serviço." };
  }

  if (hasInvalidServiceData(service)) {
    return {
      ok: false,
      error:
        "Este serviço está temporariamente indisponível para agendamento. Tente novamente mais tarde.",
    };
  }

  const barbershopData = service.barbershop ?? barbershop;
  if (!barbershopData?.isActive) {
    return { ok: false, error: "Barbearia indisponível para agendamentos." };
  }

  if (!barber) {
    return { ok: false, error: "Barbeiro não encontrado para esta barbearia." };
  }

  const services = [service];
  const { totalDurationMinutes, totalPriceInCents } = calculateBookingTotals(services);

  if (totalDurationMinutes <= 0) {
    return { ok: false, error: "Não foi possível calcular a duração total do agendamento." };
  }

  return {
    ok: true,
    services,
    totalDurationMinutes,
    totalPriceInCents,
  };
}

export type CheckoutValidationError = { ok: false; error: string };

export type CheckoutValidationOk = {
  ok: true;
  services: ServiceForTotals[];
  totalDurationMinutes: number;
  totalPriceInCents: number;
  barbershopId: string;
  barberId: string;
  barbershopName: string;
  barberName: string;
  barbershopPhone: string | null;
  stripeEnabled: boolean;
};

export async function validateAndResolveCheckoutInput(
  input: BookingCreationCheckoutInput,
): Promise<CheckoutValidationError | CheckoutValidationOk> {
  const { barbershopId, barberId, serviceIds, startAt } = input;

  if (isBookingDateTimeAtOrBeforeNowWithBuffer(startAt, BOOKING_SLOT_BUFFER_MINUTES)) {
    return {
      ok: false,
      error:
        "Data e horário selecionados já passaram ou estão muito próximos do horário atual.",
    };
  }

  const uniqueServiceIds = deduplicateServiceIds(serviceIds);
  if (uniqueServiceIds.length === 0) {
    return { ok: false, error: "Selecione pelo menos um serviço." };
  }

  const [barbershop, barber, services] = await Promise.all([
    prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        id: true,
        name: true,
        isActive: true,
        stripeEnabled: true,
        phones: true,
        owner: { select: { phone: true } },
      },
    }),
    prisma.barber.findFirst({
      where: { id: barberId, barbershopId },
      select: { id: true, name: true },
    }),
    prisma.barbershopService.findMany({
      where: { id: { in: uniqueServiceIds }, barbershopId, deletedAt: null },
      select: {
        id: true,
        name: true,
        priceInCents: true,
        durationInMinutes: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!barbershop || !barber) {
    return { ok: false, error: "Barbearia ou barbeiro não encontrado." };
  }

  if (!barbershop.isActive) {
    return { ok: false, error: "Barbearia indisponível para agendamentos." };
  }

  if (services.length !== uniqueServiceIds.length) {
    return { ok: false, error: "Um ou mais serviços selecionados não estão disponíveis." };
  }

  if (services.some((s) => hasInvalidServiceData(s))) {
    return {
      ok: false,
      error: "Um ou mais serviços estão temporariamente indisponíveis para agendamento.",
    };
  }

  const { totalDurationMinutes, totalPriceInCents } = calculateBookingTotals(services);
  if (totalDurationMinutes <= 0) {
    return { ok: false, error: "Não foi possível calcular a duração total do agendamento." };
  }

  const ownerPhone = barbershop.owner?.phone?.trim() ?? null;
  const primaryBarbershopPhone =
    ownerPhone ??
    barbershop.phones
      .map((p) => p.trim())
      .find((p) => p.length > 0) ??
    null;

  return {
    ok: true,
    services,
    totalDurationMinutes,
    totalPriceInCents,
    barbershopId: barbershop.id,
    barberId: barber.id,
    barbershopName: barbershop.name,
    barberName: barber.name,
    barbershopPhone: primaryBarbershopPhone,
    stripeEnabled: barbershop.stripeEnabled,
  };
}

async function validateAndResolveOwnerInput(
  input: BookingCreationOwnerInput,
): Promise<ValidationResult> {
  const { barbershopId, barberId, serviceIds, date, clientUserId } = input;

  if (isBookingDateTimeAtOrBeforeNowWithBuffer(date, BOOKING_SLOT_BUFFER_MINUTES)) {
    return {
      ok: false,
      error:
        "Data e horário selecionados já passaram ou estão muito próximos do horário atual.",
    };
  }

  const uniqueServiceIds = deduplicateServiceIds(serviceIds);
  if (uniqueServiceIds.length === 0) {
    return { ok: false, error: "Selecione ao menos um serviço." };
  }

  const [clientUser, clientHistoryBooking, barber, services, barbershop] = await Promise.all([
    prisma.user.findUnique({
      where: { id: clientUserId },
      select: { id: true },
    }),
    prisma.booking.findFirst({
      where: { barbershopId, userId: clientUserId },
      select: { id: true },
    }),
    prisma.barber.findFirst({
      where: { id: barberId, barbershopId },
      select: { id: true },
    }),
    prisma.barbershopService.findMany({
      where: { id: { in: uniqueServiceIds }, barbershopId, deletedAt: null },
      select: {
        id: true,
        name: true,
        priceInCents: true,
        durationInMinutes: true,
      },
    }),
    prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { id: true },
    }),
  ]);

  if (!barbershop) return { ok: false, error: "Barbearia não encontrada." };
  if (!clientUser) return { ok: false, error: "Cliente não encontrado." };
  if (!clientHistoryBooking) {
    return {
      ok: false,
      error: "Selecione um cliente que já tenha atendido nesta barbearia.",
    };
  }
  if (!barber) return { ok: false, error: "Barbeiro não encontrado para esta barbearia." };
  if (services.length !== uniqueServiceIds.length) {
    return { ok: false, error: "Um ou mais serviços selecionados não estão disponíveis." };
  }
  if (services.some((s) => hasInvalidServiceData(s))) {
    return {
      ok: false,
      error: "Um ou mais serviços estão temporariamente indisponíveis para agendamento.",
    };
  }

  const { totalDurationMinutes, totalPriceInCents } = calculateBookingTotals(services);
  if (totalDurationMinutes <= 0) {
    return { ok: false, error: "Não foi possível calcular a duração total do agendamento." };
  }

  return {
    ok: true,
    services,
    totalDurationMinutes,
    totalPriceInCents,
  };
}

async function checkCollision(
  barbershopId: string,
  barberId: string,
  date: Date,
  totalDurationMinutes: number,
): Promise<{ hasCollision: boolean; error?: string }> {
  const { start, endExclusive } = getDayWindow(date);

  const bookings = await prisma.booking.findMany({
    where: {
      barbershopId,
      AND: [
        { OR: [{ barberId }, { barberId: null }] },
        ACTIVE_BOOKING_PAYMENT_WHERE,
      ],
      date: { gte: start, lt: endExclusive },
      cancelledAt: null,
    },
    select: {
      startAt: true,
      totalDurationMinutes: true,
      date: true,
      service: { select: { durationInMinutes: true } },
    },
  });

  const hasCollision = checkTimeSlotCollision(
    getBookingMinuteOfDay(date),
    totalDurationMinutes,
    bookings,
  );

  if (hasCollision) {
    return { hasCollision: true, error: "Data e hora selecionadas já estão agendadas." };
  }
  return { hasCollision: false };
}

export type CreateConfirmedBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string };

export async function createCustomerBooking(
  input: BookingCreationCustomerInput,
): Promise<CreateConfirmedBookingResult> {
  const validation = await validateAndResolveCustomerInput(input);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { barbershopId, serviceId, barberId, date, userId } = input;
  const { services, totalDurationMinutes, totalPriceInCents } = validation;

  const collision = await checkCollision(
    barbershopId,
    barberId,
    date,
    totalDurationMinutes,
  );
  if (collision.hasCollision) {
    return { ok: false, error: collision.error ?? "Horário indisponível." };
  }

  const initialPaymentState = resolveInitialPaymentState({
    stripeEnabled: false,
    requestedPaymentMethod: "IN_PERSON",
    allowStripeCheckout: false,
  });

  const endAt = new Date(date.getTime() + totalDurationMinutes * 60_000);

  const booking = await prisma.booking.create({
    data: {
      serviceId,
      date: date.toISOString(),
      startAt: date.toISOString(),
      endAt: endAt.toISOString(),
      totalDurationMinutes,
      totalPriceInCents,
      userId,
      barberId,
      barbershopId,
      paymentMethod: initialPaymentState.paymentMethod,
      paymentStatus: initialPaymentState.paymentStatus,
      services: { create: { serviceId } },
    },
    select: { id: true },
  });

  await scheduleBookingNotificationJobs(booking.id);
  revalidateBookingSurfaces();

  return { ok: true, bookingId: booking.id };
}

export type CheckoutReceiptData = {
  barbershopName: string;
  barberName: string;
  barbershopPhone: string | null;
  serviceNames: string[];
  totalPriceInCents: number;
};

export type CreateCheckoutBookingResult =
  | { ok: true; bookingId: string; receipt: CheckoutReceiptData }
  | { ok: false; error: string };

export async function createCheckoutConfirmedBooking(
  input: BookingCreationCheckoutInput,
): Promise<CreateCheckoutBookingResult> {
  const validation = await validateAndResolveCheckoutInput(input);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { barbershopId, barberId, startAt, userId, stripeEnabled, paymentMethod } = input;
  const {
    services,
    totalDurationMinutes,
    totalPriceInCents,
    barbershopName,
    barberName,
    barbershopPhone,
  } = validation;
  const uniqueServiceIds = deduplicateServiceIds(input.serviceIds);
  const primaryServiceId = uniqueServiceIds[0]!;

  const collision = await checkCollision(
    barbershopId,
    barberId,
    startAt,
    totalDurationMinutes,
  );
  if (collision.hasCollision) {
    return { ok: false, error: collision.error ?? "Horário indisponível." };
  }

  const requestedPaymentMethod = paymentMethod ?? (stripeEnabled ? "STRIPE" : "IN_PERSON");
  const initialPaymentState = resolveInitialPaymentState({
    stripeEnabled,
    requestedPaymentMethod,
    allowStripeCheckout: true,
  });

  if (initialPaymentState.requiresStripeCheckout) {
    return {
      ok: false,
      error: "Este fluxo não suporta checkout Stripe. Use createCheckoutPendingBooking.",
    };
  }

  const endAt = new Date(startAt.getTime() + totalDurationMinutes * 60_000);

  const booking = await prisma.booking.create({
    data: {
      serviceId: primaryServiceId,
      date: startAt.toISOString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      totalDurationMinutes,
      totalPriceInCents,
      userId,
      barberId,
      barbershopId,
      paymentMethod: initialPaymentState.paymentMethod,
      paymentStatus: initialPaymentState.paymentStatus,
      services: {
        createMany: {
          data: uniqueServiceIds.map((serviceId) => ({ serviceId })),
        },
      },
    },
    select: { id: true },
  });

  await scheduleBookingNotificationJobs(booking.id);
  revalidateBookingSurfaces();

  return {
    ok: true,
    bookingId: booking.id,
    receipt: {
      barbershopName,
      barberName,
      barbershopPhone,
      serviceNames: services.map((service) => service.name),
      totalPriceInCents,
    },
  };
}

export type CreateCheckoutPendingBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string };

export async function createCheckoutPendingBooking(
  input: BookingCreationCheckoutInput & { stripeSessionId: string },
): Promise<CreateCheckoutPendingBookingResult> {
  const validation = await validateAndResolveCheckoutInput(input);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { barbershopId, barberId, startAt, userId, stripeSessionId } = input;
  const { services, totalDurationMinutes, totalPriceInCents } = validation;
  const uniqueServiceIds = deduplicateServiceIds(input.serviceIds);
  const primaryServiceId = uniqueServiceIds[0]!;

  const collision = await checkCollision(
    barbershopId,
    barberId,
    startAt,
    totalDurationMinutes,
  );
  if (collision.hasCollision) {
    return { ok: false, error: collision.error ?? "Horário indisponível." };
  }

  const initialPaymentState = resolveInitialPaymentState({
    stripeEnabled: true,
    requestedPaymentMethod: "STRIPE",
    allowStripeCheckout: true,
  });
  const endAt = new Date(startAt.getTime() + totalDurationMinutes * 60_000);

  const booking = await prisma.booking.create({
    data: {
      stripeSessionId,
      serviceId: primaryServiceId,
      date: startAt.toISOString(),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      totalDurationMinutes,
      totalPriceInCents,
      userId,
      barberId,
      barbershopId,
      paymentMethod: initialPaymentState.paymentMethod,
      paymentStatus: initialPaymentState.paymentStatus,
      services: {
        createMany: {
          data: uniqueServiceIds.map((serviceId) => ({ serviceId })),
        },
      },
    },
    select: { id: true },
  });

  return { ok: true, bookingId: booking.id };
}

export type CreateOwnerBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string };

export async function createOwnerBooking(
  input: BookingCreationOwnerInput,
): Promise<CreateOwnerBookingResult> {
  const validation = await validateAndResolveOwnerInput(input);
  if (!validation.ok) return { ok: false, error: validation.error };

  const { barbershopId, barberId, date, clientUserId } = input;
  const { services, totalDurationMinutes, totalPriceInCents } = validation;
  const uniqueServiceIds = deduplicateServiceIds(input.serviceIds);

  const collision = await checkCollision(
    barbershopId,
    barberId,
    date,
    totalDurationMinutes,
  );
  if (collision.hasCollision) {
    return { ok: false, error: collision.error ?? "Horário indisponível para este barbeiro." };
  }

  const endAt = new Date(date.getTime() + totalDurationMinutes * 60_000);

  const booking = await prisma.booking.create({
    data: {
      serviceId: uniqueServiceIds[0]!,
      date: date.toISOString(),
      startAt: date.toISOString(),
      endAt: endAt.toISOString(),
      totalDurationMinutes,
      totalPriceInCents,
      userId: clientUserId,
      barberId,
      barbershopId,
      paymentMethod: "IN_PERSON",
      paymentStatus: UNPAID_PAYMENT_STATUS,
      services: {
        createMany: {
          data: uniqueServiceIds.map((serviceId) => ({ serviceId })),
        },
      },
    },
    select: { id: true },
  });

  try {
    await scheduleBookingNotificationJobs(booking.id);
  } catch (error) {
    console.error("[bookingCreationService] Falha ao agendar notificações.", {
      error,
      bookingId: booking.id,
    });
  }

  try {
    revalidateBookingSurfaces();
  } catch (error) {
    console.error("[bookingCreationService] Falha ao revalidar superfícies.", {
      error,
      bookingId: booking.id,
    });
  }

  return { ok: true, bookingId: booking.id };
}
