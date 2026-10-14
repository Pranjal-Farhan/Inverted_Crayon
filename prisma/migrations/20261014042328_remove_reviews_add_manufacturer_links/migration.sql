-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_productId_fkey";

-- DropTable
DROP TABLE "Review";

-- DropEnum
DROP TYPE "ReviewStatus";

-- CreateTable
CREATE TABLE "ManufacturerLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCurrentVendor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManufacturerLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManufacturerLink_productId_position_idx" ON "ManufacturerLink"("productId", "position");

-- AddForeignKey
ALTER TABLE "ManufacturerLink" ADD CONSTRAINT "ManufacturerLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
