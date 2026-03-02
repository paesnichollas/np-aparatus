-- AlterTable
ALTER TABLE "WaitlistEntry"
ADD COLUMN "requestedPaymentMethod" "PaymentMethod" NOT NULL DEFAULT 'IN_PERSON';
