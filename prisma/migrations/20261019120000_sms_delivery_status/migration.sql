-- Delivery status for the SMS outbox, same idea as EmailLog.delivery: LOGGED (recorded only),
-- SENT (the gateway accepted it) or FAILED (with the reason). Existing rows stay LOGGED.

-- CreateEnum
CREATE TYPE "SmsDelivery" AS ENUM ('LOGGED', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "SmsLog" ADD COLUMN     "delivery" "SmsDelivery" NOT NULL DEFAULT 'LOGGED',
ADD COLUMN     "deliveryError" TEXT,
ADD COLUMN     "providerRef" TEXT;
