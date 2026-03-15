import { describe, expect, it } from "vitest";

import {
  isWaitlistDateDayInPast,
  parseWaitlistDateDay,
  WAITLIST_JOIN_INPUT_SCHEMA,
  WAITLIST_STATUS_INPUT_SCHEMA,
} from "./waitlist-shared";

describe("waitlist-shared", () => {
  describe("parseWaitlistDateDay", () => {
    it("returns null for invalid date strings", () => {
      expect(parseWaitlistDateDay("")).toBeNull();
      expect(parseWaitlistDateDay("invalid")).toBeNull();
      expect(parseWaitlistDateDay("2024-13-01")).toBeNull();
      expect(parseWaitlistDateDay("2024-00-15")).toBeNull();
    });

    it("returns Date for valid YYYY-MM-DD string", () => {
      const result = parseWaitlistDateDay("2024-06-15");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(5);
      expect(result?.getDate()).toBe(15);
    });
  });

  describe("isWaitlistDateDayInPast", () => {
    it("returns true for past dates", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(isWaitlistDateDayInPast(pastDate)).toBe(true);
    });

    it("returns false for today", () => {
      const today = new Date();
      expect(isWaitlistDateDayInPast(today)).toBe(false);
    });

    it("returns false for future dates", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(isWaitlistDateDayInPast(futureDate)).toBe(false);
    });
  });

  describe("WAITLIST_JOIN_INPUT_SCHEMA", () => {
    it("parses valid join input", () => {
      const result = WAITLIST_JOIN_INPUT_SCHEMA.safeParse({
        barbershopId: "550e8400-e29b-41d4-a716-446655440000",
        barberId: "550e8400-e29b-41d4-a716-446655440001",
        serviceId: "550e8400-e29b-41d4-a716-446655440002",
        dateDay: "2024-06-15",
        paymentMethod: "STRIPE",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUIDs", () => {
      const result = WAITLIST_JOIN_INPUT_SCHEMA.safeParse({
        barbershopId: "invalid",
        barberId: "550e8400-e29b-41d4-a716-446655440001",
        serviceId: "550e8400-e29b-41d4-a716-446655440002",
        dateDay: "2024-06-15",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid date format", () => {
      const result = WAITLIST_JOIN_INPUT_SCHEMA.safeParse({
        barbershopId: "550e8400-e29b-41d4-a716-446655440000",
        barberId: "550e8400-e29b-41d4-a716-446655440001",
        serviceId: "550e8400-e29b-41d4-a716-446655440002",
        dateDay: "15/06/2024",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("WAITLIST_STATUS_INPUT_SCHEMA", () => {
    it("parses valid status input", () => {
      const result = WAITLIST_STATUS_INPUT_SCHEMA.safeParse({
        barbershopId: "550e8400-e29b-41d4-a716-446655440000",
        barberId: "550e8400-e29b-41d4-a716-446655440001",
        serviceId: "550e8400-e29b-41d4-a716-446655440002",
        dateDay: "2024-06-15",
      });
      expect(result.success).toBe(true);
    });
  });
});
