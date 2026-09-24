-- CreateEnum
CREATE TYPE "SmsType" AS ENUM ('ORDER_CONFIRMED_PAID', 'ORDER_CONFIRMED_COD', 'ORDER_CONFIRMED_PARTIAL');

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "SmsType" NOT NULL,
    "relatedOrderId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsLog_to_idx" ON "SmsLog"("to");

-- CreateIndex
CREATE INDEX "SmsLog_type_idx" ON "SmsLog"("type");
