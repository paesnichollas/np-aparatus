DO $$
BEGIN
  IF EXISTS (
    SELECT "ownerId"
    FROM "Barbershop"
    WHERE "ownerId" IS NOT NULL
    GROUP BY "ownerId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Nao foi possivel aplicar ownership 1:1: existem usuarios donos de multiplas barbearias.';
  END IF;
END $$;

ALTER TABLE "user"
ADD COLUMN "barbershopId" TEXT;

UPDATE "user" AS "u"
SET "barbershopId" = "b"."id"
FROM "Barbershop" AS "b"
WHERE "b"."ownerId" = "u"."id"
  AND ("u"."barbershopId" IS NULL OR "u"."barbershopId" <> "b"."id");

CREATE INDEX "user_barbershopId_idx" ON "user"("barbershopId");

ALTER TABLE "user"
ADD CONSTRAINT "user_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Barbershop_ownerId_idx";

CREATE UNIQUE INDEX "Barbershop_ownerId_key" ON "Barbershop"("ownerId");
