-- A Unisex product can also be listed under one chosen Men and one chosen Women subcategory.
ALTER TABLE "Product" ADD COLUMN "menCategoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN "womenCategoryId" TEXT;

ALTER TABLE "Product" ADD CONSTRAINT "Product_menCategoryId_fkey" FOREIGN KEY ("menCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_womenCategoryId_fkey" FOREIGN KEY ("womenCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
