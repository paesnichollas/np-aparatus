import {
  getBookingDayBounds,
  getBookingMinuteOfDay,
} from "@/lib/booking-time";
import {
  calculateBookingTotals,
  getBookingDurationMinutes,
  getBookingStartDate,
} from "@/lib/booking-calculations";
import { hasMinuteIntervalOverlap } from "@/lib/booking-interval";

export type ServiceForValidation = {
  name: string;
  priceInCents: number;
  durationInMinutes: number;
};

export const hasInvalidServiceData = (service: ServiceForValidation) => {
  if (service.name.trim().length === 0) {
    return true;
  }

  if (!Number.isInteger(service.priceInCents) || service.priceInCents < 0) {
    return true;
  }

  if (
    !Number.isInteger(service.durationInMinutes) ||
    service.durationInMinutes < 5
  ) {
    return true;
  }

  return false;
};

export const deduplicateServiceIds = (serviceIds: string[]) =>
  Array.from(new Set(serviceIds));

export const getDayWindow = (date: Date) => {
  const { start, endExclusive } = getBookingDayBounds(date);
  return { start, endExclusive };
};

export type BookingConflictRecord = {
  startAt: Date | null;
  totalDurationMinutes: number | null;
  date: Date;
  service: { durationInMinutes: number } | null;
};

export const checkTimeSlotCollision = (
  startMinuteOfDay: number,
  durationMinutes: number,
  existingBookings: BookingConflictRecord[],
) => {
  const occupiedIntervals = existingBookings.map((booking) => {
    const startMinute = getBookingMinuteOfDay(getBookingStartDate(booking));
    const durationInMinutes = getBookingDurationMinutes(booking);
    return {
      startMinute,
      endMinute: startMinute + durationInMinutes,
    };
  });

  return hasMinuteIntervalOverlap(
    startMinuteOfDay,
    durationMinutes,
    occupiedIntervals,
  );
};

export { calculateBookingTotals, getBookingDurationMinutes, getBookingStartDate };
