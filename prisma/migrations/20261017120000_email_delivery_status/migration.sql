-- What became of each outbox email: recorded only, handed to the provider, or refused by it.
-- Existing rows were all recorded before any provider was connected, so they default to LOGGED.
-- CreateEnum
CREATE TYPE "EmailDelivery" AS ENUM ('LOGGED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "delivery" "EmailDelivery" NOT NULL DEFAULT 'LOGGED',
ADD COLUMN     "deliveryError" TEXT;
