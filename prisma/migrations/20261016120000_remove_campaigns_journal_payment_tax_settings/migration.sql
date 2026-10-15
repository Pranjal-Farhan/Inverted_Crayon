-- Campaigns and the journal are removed from the product entirely.
-- DropTable
DROP TABLE "Campaign";

-- DropTable
DROP TABLE "Post";

-- DropEnum
DROP TYPE "PostStatus";

-- Settings rows and CMS content that only the removed features used. (shipping_rates is kept:
-- it is still the standard per-zone delivery rate a product with no charge of its own falls back to.)
DELETE FROM "StoreSetting" WHERE "key" IN ('payment_gateways', 'tax_settings');
DELETE FROM "ContentBlock" WHERE "key" = 'journal_page';
