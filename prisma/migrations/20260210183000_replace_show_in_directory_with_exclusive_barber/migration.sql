ALTER TABLE "Barbershop"
ADD COLUMN "exclusiveBarber" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Barbershop"
SET "exclusiveBarber" = NOT "showInDirectory";

ALTER TABLE "AppConfig"
DROP CONSTRAINT IF EXISTS "AppConfig_exclusiveBarbershopId_fkey";

DROP INDEX IF EXISTS "AppConfig_exclusiveBarbershopId_idx";

ALTER TABLE "AppConfig"
DROP COLUMN IF EXISTS "exclusiveBarbershopId";

ALTER TABLE "Barbershop"
DROP COLUMN "showInDirectory";
