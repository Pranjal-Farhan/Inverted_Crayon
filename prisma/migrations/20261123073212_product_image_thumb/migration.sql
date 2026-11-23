-- CreateTable
CREATE TABLE "ProductImageThumb" (
    "imageId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImageThumb_pkey" PRIMARY KEY ("imageId")
);

-- AddForeignKey
ALTER TABLE "ProductImageThumb" ADD CONSTRAINT "ProductImageThumb_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
