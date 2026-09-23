-- CreateEnum
CREATE TYPE "FreeDeliveryScope" AS ENUM ('NONE', 'INSIDE_DHAKA', 'NATIONWIDE');

-- AlterEnum: drop NAGAD (no native DROP VALUE in Postgres, so recreate the enum).
-- Existing NAGAD orders are remapped to SSLCOMMERZ first so the type cast below doesn't fail.
BEGIN;
UPDATE "Order" SET "paymentMethod" = 'SSLCOMMERZ' WHERE "paymentMethod" = 'NAGAD';
CREATE TYPE "PaymentMethod_new" AS ENUM ('BKASH', 'SSLCOMMERZ', 'COD');
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "facebookId" TEXT,
ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "facebookId" TEXT,
ADD COLUMN     "googleId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "advanceAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "advancePercent" INTEGER,
ADD COLUMN     "balanceCollected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "balanceDue" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentTransactionId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "freeDelivery" "FreeDeliveryScope" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_googleId_key" ON "AdminUser"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_facebookId_key" ON "AdminUser"("facebookId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_googleId_key" ON "Customer"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_facebookId_key" ON "Customer"("facebookId");
