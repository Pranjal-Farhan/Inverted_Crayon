-- The product description becomes three sections: Mood, Build, How n when to wear.
-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "build" TEXT,
ADD COLUMN     "howToWear" TEXT,
ADD COLUMN     "mood" TEXT;

-- Every existing description carries over as the product's Mood, so nothing written so far is lost;
-- Build and How n when to wear are filled in from the product editor.
UPDATE "Product" SET "mood" = "description" WHERE "mood" IS NULL;
