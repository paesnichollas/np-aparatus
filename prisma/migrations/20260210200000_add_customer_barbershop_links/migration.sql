ALTER TABLE "user"
ADD COLUMN "phone" TEXT,
ADD COLUMN "currentBarbershopId" TEXT;

CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");
CREATE INDEX "user_currentBarbershopId_idx" ON "user"("currentBarbershopId");

ALTER TABLE "user"
ADD CONSTRAINT "user_currentBarbershopId_fkey"
FOREIGN KEY ("currentBarbershopId") REFERENCES "Barbershop"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CustomerBarbershop" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerBarbershop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerBarbershop_customerId_barbershopId_key" ON "CustomerBarbershop"("customerId", "barbershopId");
CREATE INDEX "CustomerBarbershop_customerId_idx" ON "CustomerBarbershop"("customerId");
CREATE INDEX "CustomerBarbershop_barbershopId_idx" ON "CustomerBarbershop"("barbershopId");

ALTER TABLE "CustomerBarbershop"
ADD CONSTRAINT "CustomerBarbershop_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerBarbershop"
ADD CONSTRAINT "CustomerBarbershop_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
