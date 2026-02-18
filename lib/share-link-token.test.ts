import assert from "node:assert/strict";
import test from "node:test";

import {
  createShareLinkToken,
  verifyShareLinkToken,
} from "@/lib/share-link-token";

const withShareLinkSecret = async (callback: () => void | Promise<void>) => {
  const previousShareSecret = process.env.SHARE_LINK_TOKEN_SECRET;
  const previousBetterAuthSecret = process.env.BETTER_AUTH_SECRET;

  process.env.SHARE_LINK_TOKEN_SECRET = "test-share-link-secret";
  process.env.BETTER_AUTH_SECRET = "";

  try {
    await callback();
  } finally {
    process.env.SHARE_LINK_TOKEN_SECRET = previousShareSecret;
    process.env.BETTER_AUTH_SECRET = previousBetterAuthSecret;
  }
};

test("createShareLinkToken generates verifiable token", async () => {
  await withShareLinkSecret(() => {
    const token = createShareLinkToken({
      barbershopId: "barbershop-1",
      publicSlug: "barber-a",
      ttlInSeconds: 60,
      now: 1_000,
    });

    const verification = verifyShareLinkToken({
      token,
      expectedBarbershopId: "barbershop-1",
      expectedPublicSlug: "barber-a",
      now: 1_500,
    });

    assert.equal(verification.valid, true);

    if (verification.valid) {
      assert.equal(verification.payload.barbershopId, "barbershop-1");
      assert.equal(verification.payload.publicSlug, "barber-a");
    }
  });
});

test("verifyShareLinkToken rejects expired token", async () => {
  await withShareLinkSecret(() => {
    const token = createShareLinkToken({
      barbershopId: "barbershop-1",
      publicSlug: "barber-a",
      ttlInSeconds: 1,
      now: 1_000,
    });

    const verification = verifyShareLinkToken({
      token,
      now: 3_000,
    });

    assert.deepEqual(verification, {
      valid: false,
      reason: "expired-token",
    });
  });
});

test("verifyShareLinkToken rejects tampered token", async () => {
  await withShareLinkSecret(() => {
    const token = createShareLinkToken({
      barbershopId: "barbershop-1",
      publicSlug: "barber-a",
      ttlInSeconds: 60,
      now: 1_000,
    });
    const tamperedToken = `${token}x`;

    const verification = verifyShareLinkToken({
      token: tamperedToken,
      now: 1_500,
    });

    assert.deepEqual(verification, {
      valid: false,
      reason: "invalid-signature",
    });
  });
});

test("verifyShareLinkToken rejects slug mismatch", async () => {
  await withShareLinkSecret(() => {
    const token = createShareLinkToken({
      barbershopId: "barbershop-1",
      publicSlug: "barber-a",
      ttlInSeconds: 60,
      now: 1_000,
    });

    const verification = verifyShareLinkToken({
      token,
      expectedPublicSlug: "barber-b",
      now: 1_500,
    });

    assert.deepEqual(verification, {
      valid: false,
      reason: "slug-mismatch",
    });
  });
});

