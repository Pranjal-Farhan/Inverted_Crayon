-- CreateEnum
CREATE TYPE "ProductDiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discountType" "ProductDiscountType",
ADD COLUMN     "discountValue" DECIMAL(10,2);
