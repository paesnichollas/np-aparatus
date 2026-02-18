-- CreateEnum
CREATE TYPE "BarbershopPlan" AS ENUM ('BASIC', 'PRO');

-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('NONE', 'TWILIO');

-- CreateEnum
CREATE TYPE "NotificationJobType" AS ENUM ('BOOKING_CONFIRM', 'REMINDER_24H', 'REMINDER_1H');

-- CreateEnum
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELED');

-- AlterTable
ALTER TABLE "Barbershop"
ADD COLUMN "plan" "BarbershopPlan" NOT NULL DEFAULT 'BASIC',
ADD COLUMN "whatsappProvider" "WhatsAppProvider" NOT NULL DEFAULT 'NONE',
ADD COLUMN "whatsappFrom" TEXT,
ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BarbershopWhatsAppSettings" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "sendBookingConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "sendReminder24h" BOOLEAN NOT NULL DEFAULT true,
    "sendReminder1h" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarbershopWhatsAppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "NotificationJobType" NOT NULL,
    "scheduledAt" TIMESTAMPTZ NOT NULL,
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMPTZ,
    "canceledAt" TIMESTAMPTZ,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarbershopWhatsAppSettings_barbershopId_key" ON "BarbershopWhatsAppSettings"("barbershopId");

-- CreateIndex
CREATE INDEX "NotificationJob_status_scheduledAt_idx" ON "NotificationJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "NotificationJob_bookingId_idx" ON "NotificationJob"("bookingId");

-- CreateIndex
CREATE INDEX "NotificationJob_barbershopId_idx" ON "NotificationJob"("barbershopId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_bookingId_type_key" ON "NotificationJob"("bookingId", "type");

-- AddForeignKey
ALTER TABLE "BarbershopWhatsAppSettings" ADD CONSTRAINT "BarbershopWhatsAppSettings_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
