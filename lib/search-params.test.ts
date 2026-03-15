import { describe, expect, it } from "vitest";

import {
  buildPaginationHref,
  parseDateParam,
  parseFilterParam,
  parseNullableStringParam,
  parsePageParam,
  parseStringParam,
} from "./search-params";

describe("search-params", () => {
  describe("parseStringParam", () => {
    it("returns empty string for undefined", () => {
      expect(parseStringParam(undefined)).toBe("");
    });

    it("returns first element for array", () => {
      expect(parseStringParam(["a", "b"])).toBe("a");
    });

    it("returns string as-is", () => {
      expect(parseStringParam("hello")).toBe("hello");
    });
  });

  describe("parseNullableStringParam", () => {
    it("returns null for empty or whitespace", () => {
      expect(parseNullableStringParam("")).toBeNull();
      expect(parseNullableStringParam("   ")).toBeNull();
    });

    it("returns trimmed string for non-empty", () => {
      expect(parseNullableStringParam("  hello  ")).toBe("hello");
    });
  });

  describe("parsePageParam", () => {
    it("returns 1 for invalid values", () => {
      expect(parsePageParam(undefined)).toBe(1);
      expect(parsePageParam("")).toBe(1);
      expect(parsePageParam("abc")).toBe(1);
      expect(parsePageParam("0")).toBe(1);
      expect(parsePageParam("-1")).toBe(1);
    });

    it("returns parsed page for valid values", () => {
      expect(parsePageParam("1")).toBe(1);
      expect(parsePageParam("5")).toBe(5);
      expect(parsePageParam("42")).toBe(42);
    });

    it("floors decimal values", () => {
      expect(parsePageParam("2.7")).toBe(2);
    });
  });

  describe("parseDateParam", () => {
    it("returns null for invalid values", () => {
      expect(parseDateParam(undefined)).toBeNull();
      expect(parseDateParam("")).toBeNull();
      expect(parseDateParam("invalid")).toBeNull();
    });

    it("returns Date for valid ISO string", () => {
      const result = parseDateParam("2024-01-15");
      expect(result).toBeInstanceOf(Date);
      expect(Number.isFinite(result?.getTime())).toBe(true);
    });
  });

  describe("parseFilterParam", () => {
    const allowed = new Set(["A", "B", "C"]);

    it("returns fallback for invalid value", () => {
      expect(parseFilterParam(undefined, allowed, "A")).toBe("A");
      expect(parseFilterParam("X", allowed, "B")).toBe("B");
    });

    it("returns normalized value for allowed values", () => {
      expect(parseFilterParam("a", allowed, "A")).toBe("A");
      expect(parseFilterParam("B", allowed, "A")).toBe("B");
    });
  });

  describe("buildPaginationHref", () => {
    it("returns base path when page 1 and no params", () => {
      expect(buildPaginationHref("/admin/bookings", {}, 1)).toBe(
        "/admin/bookings",
      );
    });

    it("adds page param when page > 1", () => {
      expect(buildPaginationHref("/admin/bookings", {}, 2)).toBe(
        "/admin/bookings?page=2",
      );
    });

    it("preserves other params", () => {
      expect(
        buildPaginationHref("/admin/bookings", {
          barbershopId: "x",
          status: "UPCOMING",
        }, 3),
      ).toBe("/admin/bookings?barbershopId=x&status=UPCOMING&page=3");
    });

    it("omits undefined and empty params", () => {
      expect(
        buildPaginationHref("/admin/bookings", {
          barbershopId: undefined,
          status: "",
        }, 1),
      ).toBe("/admin/bookings");
    });
  });
});
