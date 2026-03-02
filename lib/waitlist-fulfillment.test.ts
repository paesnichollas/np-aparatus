import { describe, expect, it } from "vitest";

import {
  fulfillWaitlistInTransaction,
  resolveReleasedDurationMinutes,
  type ReleasedSlotInput,
} from "@/lib/waitlist-fulfillment";

const baseInput: ReleasedSlotInput = {
  sourceBookingId: "booking-source",
  barbershopId: "barbershop-1",
  barberId: "barber-1",
  serviceId: "service-1",
  releasedStartAt: new Date("2026-03-15T12:00:00.000Z"),
  releasedDurationMinutes: 30,
};

describe("waitlist-fulfillment", () => {
  it("resolveReleasedDurationMinutes keeps explicit valid duration", () => {
    const duration = resolveReleasedDurationMinutes({
      releasedStartAt: new Date("2026-03-15T12:00:00.000Z"),
      releasedEndAt: new Date("2026-03-15T12:45:00.000Z"),
      releasedDurationMinutes: 30,
    });

    expect(duration).toBe(30);
  });

  it("resolveReleasedDurationMinutes calculates from endAt when needed", () => {
    const duration = resolveReleasedDurationMinutes({
      releasedStartAt: new Date("2026-03-15T12:00:00.000Z"),
      releasedEndAt: new Date("2026-03-15T12:45:00.000Z"),
      releasedDurationMinutes: null,
    });

    expect(duration).toBe(45);
  });

  it("fulfillWaitlistInTransaction skips slot without barber", async () => {
    const result = await fulfillWaitlistInTransaction(
      {
        waitlistEntry: {} as never,
        barbershopService: {} as never,
        booking: {} as never,
        barbershop: {} as never,
      },
      {
        ...baseInput,
        barberId: null,
      },
      {
        scheduleBookingNotificationJobs: async () => undefined,
      },
    );

    expect(result).toEqual({
      fulfilled: false,
      fulfilledEntryId: null,
      fulfilledBookingId: null,
      expiredEntriesCount: 0,
      skippedReason: "missing-barber",
    });
  });

  it("fulfillWaitlistInTransaction expires incompatible entry before finishing", async () => {
    const findFirstCalls: Array<unknown> = [];
    const updateManyCalls: Array<unknown> = [];
    let findFirstAttempt = 0;

    const result = await fulfillWaitlistInTransaction(
      {
        waitlistEntry: {
          findFirst: async (args: unknown) => {
            findFirstCalls.push(args);
            findFirstAttempt += 1;

            if (findFirstAttempt === 1) {
              return {
                id: "entry-1",
                userId: "user-1",
                requestedPaymentMethod: "IN_PERSON",
              };
            }

            return null;
          },
          updateMany: async (args: unknown) => {
            updateManyCalls.push(args);
            return {
              count: 1,
            };
          },
        } as never,
        barbershopService: {
          findFirst: async () => {
            return {
              durationInMinutes: 40,
              priceInCents: 3500,
            };
          },
        } as never,
        booking: {} as never,
        barbershop: {
          findUnique: async () => ({
            stripeEnabled: false,
          }),
        } as never,
      },
      baseInput,
      {
        scheduleBookingNotificationJobs: async () => undefined,
      },
    );

    expect(findFirstCalls.length).toBe(2);
    expect(updateManyCalls.length).toBe(1);
    expect(result).toEqual({
      fulfilled: false,
      fulfilledEntryId: null,
      fulfilledBookingId: null,
      expiredEntriesCount: 1,
      skippedReason: "no-active-entry",
    });
  });

  it("fulfillWaitlistInTransaction fulfills the first active entry", async () => {
    const updateManyCalls: Array<unknown> = [];
    const updateCalls: Array<unknown> = [];
    const bookingCreateCalls: Array<unknown> = [];
    const scheduledBookings: string[] = [];

    const result = await fulfillWaitlistInTransaction(
      {
        waitlistEntry: {
          findFirst: async () => {
            return {
              id: "entry-1",
              userId: "user-1",
              requestedPaymentMethod: "IN_PERSON",
            };
          },
          updateMany: async (args: unknown) => {
            updateManyCalls.push(args);
            return {
              count: 1,
            };
          },
          update: async (args: unknown) => {
            updateCalls.push(args);
            return {
              id: "entry-1",
            };
          },
        } as never,
        barbershopService: {
          findFirst: async () => {
            return {
              durationInMinutes: 30,
              priceInCents: 4200,
            };
          },
        } as never,
        booking: {
          create: async (args: unknown) => {
            bookingCreateCalls.push(args);
            return {
              id: "booking-fulfilled-1",
            };
          },
        } as never,
        barbershop: {
          findUnique: async () => ({
            stripeEnabled: false,
          }),
        } as never,
      },
      baseInput,
      {
        scheduleBookingNotificationJobs: async (bookingId) => {
          scheduledBookings.push(bookingId);
        },
      },
    );

    expect(updateManyCalls.length).toBe(1);
    expect(updateCalls.length).toBe(1);
    expect(bookingCreateCalls.length).toBe(1);
    expect(bookingCreateCalls[0]).toMatchObject({
      data: {
        paymentMethod: "IN_PERSON",
        paymentStatus: "PENDING",
      },
    });
    expect(scheduledBookings).toEqual(["booking-fulfilled-1"]);
    expect(result).toEqual({
      fulfilled: true,
      fulfilledEntryId: "entry-1",
      fulfilledBookingId: "booking-fulfilled-1",
      expiredEntriesCount: 0,
      skippedReason: null,
    });
  });

  it("fulfillWaitlistInTransaction keeps stripe method as pending when requested", async () => {
    const bookingCreateCalls: Array<unknown> = [];

    await fulfillWaitlistInTransaction(
      {
        waitlistEntry: {
          findFirst: async () => {
            return {
              id: "entry-stripe-1",
              userId: "user-1",
              requestedPaymentMethod: "STRIPE",
            };
          },
          updateMany: async () => ({ count: 1 }),
          update: async () => ({ id: "entry-stripe-1" }),
        } as never,
        barbershopService: {
          findFirst: async () => {
            return {
              durationInMinutes: 30,
              priceInCents: 5000,
            };
          },
        } as never,
        booking: {
          create: async (args: unknown) => {
            bookingCreateCalls.push(args);
            return {
              id: "booking-stripe-1",
            };
          },
        } as never,
        barbershop: {
          findUnique: async () => ({
            stripeEnabled: true,
          }),
        } as never,
      },
      baseInput,
      {
        scheduleBookingNotificationJobs: async () => undefined,
      },
    );

    expect(bookingCreateCalls.length).toBe(1);
    expect(bookingCreateCalls[0]).toMatchObject({
      data: {
        paymentMethod: "STRIPE",
        paymentStatus: "PENDING",
      },
    });
  });
});
