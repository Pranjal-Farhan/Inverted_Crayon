-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('GLOBAL', 'PRODUCT');

-- AlterTable
ALTER TABLE "Discount" ADD COLUMN     "maxDiscountAmount" DECIMAL(10,2),
ADD COLUMN     "scope" "CouponScope" NOT NULL DEFAULT 'GLOBAL';

-- CreateTable
CREATE TABLE "DiscountRedemption" (
    "id" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CouponProducts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CouponProducts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscountRedemption_orderId_key" ON "DiscountRedemption"("orderId");

-- CreateIndex
CREATE INDEX "DiscountRedemption_discountId_createdAt_idx" ON "DiscountRedemption"("discountId", "createdAt");

-- CreateIndex
CREATE INDEX "_CouponProducts_B_index" ON "_CouponProducts"("B");

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRedemption" ADD CONSTRAINT "DiscountRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponProducts" ADD CONSTRAINT "_CouponProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponProducts" ADD CONSTRAINT "_CouponProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the usage ledger from orders that already used a coupon, so the Discounts page isn't
-- blank for history. Deterministic ids (no extension needed, safe to re-run). Orders auto-cancelled
-- after a failed payment are skipped: restockAndCancelOrder already gave that use back.
INSERT INTO "DiscountRedemption" ("id", "discountId", "orderId", "amount", "createdAt")
SELECT 'bf_' || md5(o."id" || d."id"), d."id", o."id", o."discountAmount", o."createdAt"
FROM "Order" o
JOIN "Discount" d ON d."code" = o."discountCode"
WHERE o."discountCode" IS NOT NULL
  AND NOT (o."status" = 'CANCELLED' AND o."paymentStatus" = 'FAILED')
ON CONFLICT ("orderId") DO NOTHING;
