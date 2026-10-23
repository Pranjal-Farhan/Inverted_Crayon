-- Finance rebuild + inventory ledger.
--
--  * Expense categories become real records (created by an admin before use) — the categories the
--    existing expenses already used are carried over so nothing is orphaned.
--  * "Investments" (stock shipments) are removed. Their shipment costs (freight, customs) were
--    already counted against profit, so each becomes an ordinary expense under "Stock shipment
--    costs"; the goods themselves were never an expense (they are the Buying Cost when sold).
--  * Manually recorded sales become real orders (Order.source = RECORDED) so they have the same
--    statuses, the same stock handling and a page under Orders. Their ids and numbers are kept.
--  * Every variant gets an OPENING stock movement, so from here on the movement history always adds
--    up to the stock count; and the database refuses a negative stock count outright.
--  * Nagad is no longer a payment method: rows that used it become "Other".

-- ---------------------------------------------------------------- new types and tables
CREATE TYPE "OrderSource" AS ENUM ('ONLINE', 'RECORDED');
CREATE TYPE "StockReason" AS ENUM ('OPENING', 'ORDER_PLACED', 'ORDER_RESTORED', 'RESTOCK', 'CORRECTION', 'VARIANT_REMOVED');

CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "variantId" TEXT,
    "productTitle" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "qtyAfter" INTEGER NOT NULL,
    "reason" "StockReason" NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "note" TEXT,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------- order columns
ALTER TABLE "Order" ADD COLUMN "recordedBy" TEXT,
ADD COLUMN "recordedMethod" "FinanceMethod",
ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'ONLINE';
CREATE INDEX "Order_source_idx" ON "Order"("source");
ALTER TABLE "OrderItem" ADD COLUMN "unitCost" DECIMAL(12,2);

-- ---------------------------------------------------------------- Nagad -> Other (old enum still in place)
UPDATE "Expense" SET "method" = 'OTHER' WHERE "method"::text = 'NAGAD';
UPDATE "ManualSale" SET "method" = 'OTHER' WHERE "method"::text = 'NAGAD';
UPDATE "Investment" SET "method" = 'OTHER' WHERE "method"::text = 'NAGAD';

-- ---------------------------------------------------------------- shipment costs of investments become expenses
INSERT INTO "Expense" ("id", "date", "amount", "category", "title", "paidTo", "method", "ownerId", "notes", "createdByEmail", "createdAt", "updatedAt")
SELECT 'mig' || substr(md5(i."id"), 1, 22),
       i."date",
       i."shipmentCost",
       'Stock shipment costs',
       'Shipment costs' || COALESCE(' — ' || NULLIF(i."description", ''), COALESCE(' — ' || NULLIF(i."supplierName", ''), '')),
       NULLIF(i."supplierName", ''),
       i."method",
       i."ownerId",
       'Carried over from a stock shipment recorded under Investments (freight, customs and similar).',
       i."createdByEmail",
       i."createdAt",
       CURRENT_TIMESTAMP
FROM "Investment" i
WHERE i."legacyCapital" = false AND i."shipmentCost" > 0;

-- ---------------------------------------------------------------- expense categories
INSERT INTO "ExpenseCategory" ("id", "name")
SELECT 'ecat' || substr(md5(c."category"), 1, 20), c."category"
FROM (SELECT DISTINCT "category" FROM "Expense") c;

ALTER TABLE "Expense" ADD COLUMN "categoryId" TEXT;
UPDATE "Expense" e SET "categoryId" = c."id" FROM "ExpenseCategory" c WHERE c."name" = e."category";
ALTER TABLE "Expense" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Expense" DROP COLUMN "category";
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- category names are unique whatever their capitalisation ("Rent" and "rent" are one category)
CREATE UNIQUE INDEX "ExpenseCategory_name_lower_key" ON "ExpenseCategory"(lower("name"));

-- ---------------------------------------------------------------- manual sales -> recorded orders
INSERT INTO "Order" ("id", "number", "email", "phone", "status", "subtotal", "shippingCost", "discountAmount", "total",
                     "paymentMethod", "paymentStatus", "shippingZone", "shippingFullName", "shippingPhone", "shippingLine1",
                     "shippingArea", "shippingDistrict", "shippingPostcode", "internalNotes", "deliveredAt", "cashCollectedAt",
                     "source", "recordedMethod", "recordedBy", "createdAt", "updatedAt")
SELECT m."id",
       m."number",
       COALESCE(m."customerEmail", ''),
       COALESCE(m."customerPhone", ''),
       CASE WHEN m."paid" THEN 'DELIVERED'::"OrderStatus" ELSE 'PENDING'::"OrderStatus" END,
       m."total" - m."deliveryCharge" + m."discount",
       m."deliveryCharge",
       m."discount",
       m."total",
       'COD'::"PaymentMethod",
       CASE WHEN m."paid" THEN 'PAID'::"PaymentStatus" ELSE 'PENDING'::"PaymentStatus" END,
       'INSIDE_DHAKA'::"ShippingZone",
       m."customerName",
       COALESCE(m."customerPhone", ''),
       COALESCE(m."customerAddress", ''),
       '', '', '',
       m."notes",
       CASE WHEN m."paid" THEN m."date" END,
       CASE WHEN m."paid" THEN m."date" END,
       'RECORDED'::"OrderSource",
       m."method",
       m."createdByEmail",
       m."date",
       m."updatedAt"
FROM "ManualSale" m;

-- A line keeps its link to the variant only if it actually took stock (so cancelling the order can
-- only ever put back what was taken); the product link stays either way, for the buying cost.
INSERT INTO "OrderItem" ("id", "orderId", "productId", "variantId", "productTitleSnapshot", "variantLabelSnapshot",
                         "qty", "unitPrice", "lineTotal", "isPreorder", "unitCost")
SELECT 'mig' || substr(md5(i."id"), 1, 22),
       i."saleId",
       v."productId",
       CASE WHEN i."stockDeducted" THEN i."variantId" END,
       i."description",
       COALESCE(v."size" || ' / ' || v."color", ''),
       i."qty",
       i."unitPrice",
       i."qty" * i."unitPrice",
       false,
       i."unitCost"
FROM "ManualSaleItem" i
LEFT JOIN "Variant" v ON v."id" = i."variantId";

-- ---------------------------------------------------------------- drop the old tables
DROP TABLE "InvestmentItem";
DROP TABLE "Investment";
DROP TABLE "ManualSaleItem";
DROP TABLE "ManualSale";

-- ---------------------------------------------------------------- remove Nagad from the enum
BEGIN;
CREATE TYPE "FinanceMethod_new" AS ENUM ('CASH', 'BKASH', 'BANK', 'CARD', 'OTHER');
ALTER TABLE "Expense" ALTER COLUMN "method" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "recordedMethod" TYPE "FinanceMethod_new" USING ("recordedMethod"::text::"FinanceMethod_new");
ALTER TABLE "Expense" ALTER COLUMN "method" TYPE "FinanceMethod_new" USING ("method"::text::"FinanceMethod_new");
ALTER TYPE "FinanceMethod" RENAME TO "FinanceMethod_old";
ALTER TYPE "FinanceMethod_new" RENAME TO "FinanceMethod";
DROP TYPE "public"."FinanceMethod_old";
ALTER TABLE "Expense" ALTER COLUMN "method" SET DEFAULT 'CASH';
COMMIT;

-- ---------------------------------------------------------------- stock: opening ledger + never negative
UPDATE "Variant" SET "stockQty" = 0 WHERE "stockQty" < 0;

INSERT INTO "StockMovement" ("id", "variantId", "productTitle", "variantLabel", "sku", "delta", "qtyAfter", "reason", "note")
SELECT 'open' || substr(md5(v."id"), 1, 21), v."id", p."title", v."size" || ' / ' || v."color", v."sku",
       v."stockQty", v."stockQty", 'OPENING'::"StockReason", 'Stock count carried over when stock tracking began'
FROM "Variant" v
JOIN "Product" p ON p."id" = v."productId"
WHERE v."stockQty" <> 0;

ALTER TABLE "Variant" ADD CONSTRAINT "Variant_stockQty_nonnegative" CHECK ("stockQty" >= 0);
