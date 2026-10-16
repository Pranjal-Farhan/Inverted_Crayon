-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "purchaseCost" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Expense_ownerId_idx" ON "Expense"("ownerId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "StockOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Finance used to work cost of goods out from the stock purchases (a weighted average per variant).
-- The purchase cost now lives on the product, so carry what was already recorded over: each product
-- starts with the average unit cost of the stock bought for it, and the admin can edit it from the
-- product page. Products with no purchases stay empty.
UPDATE "Product" p
SET "purchaseCost" = ROUND(sp."total" / sp."units", 2)
FROM (
  SELECT "productId", SUM("totalCost") AS "total", SUM("quantity") AS "units"
  FROM "StockPurchase"
  WHERE "productId" IS NOT NULL
  GROUP BY "productId"
  HAVING SUM("quantity") > 0
) sp
WHERE p."id" = sp."productId" AND p."purchaseCost" IS NULL;
