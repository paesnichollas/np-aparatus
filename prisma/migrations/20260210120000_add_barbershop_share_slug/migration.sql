-- AlterTable
ALTER TABLE "Barbershop" ADD COLUMN     "shareSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Barbershop_shareSlug_key" ON "Barbershop"("shareSlug");
