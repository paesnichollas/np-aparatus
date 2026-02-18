import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBarbershopIntentCookie,
  serializeBarbershopIntentCookie,
} from "@/lib/barbershop-context";

test("parseBarbershopIntentCookie parses share_link payload", () => {
  const cookieValue = serializeBarbershopIntentCookie({
    entrySource: "share_link",
    barbershopId: "barbershop-1",
    shareSlug: "barber-a",
    shareToken: "token-123",
    timestamp: 1_000,
  });

  const parsedValue = parseBarbershopIntentCookie(cookieValue);

  assert.deepEqual(parsedValue, {
    entrySource: "share_link",
    barbershopId: "barbershop-1",
    shareSlug: "barber-a",
    shareToken: "token-123",
    timestamp: 1_000,
  });
});

test("parseBarbershopIntentCookie supports legacy payloads without entrySource", () => {
  const legacyPayload = encodeURIComponent(
    JSON.stringify({
      barbershopId: "barbershop-1",
      shareSlug: "barber-a",
      timestamp: 1_000,
    }),
  );

  const parsedValue = parseBarbershopIntentCookie(legacyPayload);

  assert.deepEqual(parsedValue, {
    entrySource: "unknown",
    barbershopId: "barbershop-1",
    shareSlug: "barber-a",
    shareToken: undefined,
    timestamp: 1_000,
  });
});

test("parseBarbershopIntentCookie returns null for malformed payload", () => {
  const parsedValue = parseBarbershopIntentCookie("invalid-json");

  assert.equal(parsedValue, null);
});

