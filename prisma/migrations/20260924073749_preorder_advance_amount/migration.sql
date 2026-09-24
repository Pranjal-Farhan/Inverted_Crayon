-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "preorderAdvanceAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "preorderAdvanceAmount" DECIMAL(10,2);
