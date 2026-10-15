-- When cash on delivery was actually collected, and a way to leave an order out of the finance
-- reports. Orders already marked collected get the last time they changed as their date.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cashCollectedAt" TIMESTAMP(3),
ADD COLUMN     "excludeFromFinance" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Order" SET "cashCollectedAt" = "updatedAt" WHERE "balanceCollected" = true AND "cashCollectedAt" IS NULL;
