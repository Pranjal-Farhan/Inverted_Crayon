-- CreateEnum
CREATE TYPE "FinanceMethod" AS ENUM ('CASH', 'BKASH', 'NAGAD', 'BANK', 'CARD', 'OTHER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "paidTo" TEXT,
    "method" "FinanceMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "description" TEXT,
    "method" "FinanceMethod" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualSale" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerAddress" TEXT,
    "method" "FinanceMethod" NOT NULL DEFAULT 'CASH',
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "variantId" TEXT,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ManualSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Investment_date_idx" ON "Investment"("date");

-- CreateIndex
CREATE INDEX "Investment_ownerId_idx" ON "Investment"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualSale_number_key" ON "ManualSale"("number");

-- CreateIndex
CREATE INDEX "ManualSale_date_idx" ON "ManualSale"("date");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "StockOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualSaleItem" ADD CONSTRAINT "ManualSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "ManualSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualSaleItem" ADD CONSTRAINT "ManualSaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: orders already delivered get a delivery date (the last time they changed is the best
-- record there is) so they land in the right month of the finance reports.
UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED' AND "deliveredAt" IS NULL;
