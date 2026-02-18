-- Mark all users with a stored phone as verified after OTP deactivation.
UPDATE "user"
SET
  "phoneVerified" = true,
  "phoneVerifiedAt" = COALESCE("phoneVerifiedAt", NOW())
WHERE "phone" IS NOT NULL
  AND "phoneVerified" = false;
