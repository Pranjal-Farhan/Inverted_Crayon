-- Investments become stock shipments: each one records what an owner paid for a shipment (the
-- items, what each unit cost, and the shipment's own cost) and takes over from the separate stock
-- purchase records.

-- AlterTable
ALTER TABLE "Investment" ADD COLUMN     "legacyCapital" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shipmentCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "supplierName" TEXT;

-- Every investment that exists right now is the old kind — plain money an owner put in, with no
-- items. Keep it for the record, but it is no longer counted (the stock that money paid for is the
-- stock purchases, which become shipments below).
UPDATE "Investment" SET "legacyCapital" = true;

-- CreateTable
CREATE TABLE "InvestmentItem" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "productTitleSnapshot" TEXT NOT NULL,
    "variantLabelSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvestmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentItem_investmentId_idx" ON "InvestmentItem"("investmentId");

-- CreateIndex
CREATE INDEX "InvestmentItem_variantId_idx" ON "InvestmentItem"("variantId");

-- AddForeignKey
ALTER TABLE "InvestmentItem" ADD CONSTRAINT "InvestmentItem_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentItem" ADD CONSTRAINT "InvestmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentItem" ADD CONSTRAINT "InvestmentItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Each stock purchase already on record becomes a one-item shipment with no shipment cost, same
-- date, owner, supplier, quantity and cost. (Their stock was added when they were recorded, so the
-- stock counts are untouched.)
INSERT INTO "Investment" ("id", "date", "amount", "shipmentCost", "ownerId", "supplierName", "description", "method", "notes", "legacyCapital", "createdAt", "updatedAt")
SELECT 'inv_' || sp."id", sp."purchaseDate", sp."totalCost", 0, sp."ownerId", sp."supplierName", NULL, 'CASH', sp."notes", false, sp."createdAt", sp."createdAt"
FROM "StockPurchase" sp;

INSERT INTO "InvestmentItem" ("id", "investmentId", "productId", "variantId", "productTitleSnapshot", "variantLabelSnapshot", "quantity", "unitCost", "lineTotal")
SELECT 'invi_' || sp."id", 'inv_' || sp."id", sp."productId", sp."variantId", sp."productTitleSnapshot", sp."variantLabelSnapshot", sp."quantity", sp."unitCost", sp."totalCost"
FROM "StockPurchase" sp;

-- DropForeignKey
ALTER TABLE "StockPurchase" DROP CONSTRAINT "StockPurchase_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "StockPurchase" DROP CONSTRAINT "StockPurchase_productId_fkey";

-- DropForeignKey
ALTER TABLE "StockPurchase" DROP CONSTRAINT "StockPurchase_variantId_fkey";

-- DropTable
DROP TABLE "StockPurchase";
