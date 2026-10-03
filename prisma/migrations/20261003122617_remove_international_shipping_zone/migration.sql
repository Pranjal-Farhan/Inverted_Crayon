-- AlterEnum
BEGIN;
CREATE TYPE "ShippingZone_new" AS ENUM ('INSIDE_DHAKA', 'OUTSIDE_DHAKA');
ALTER TABLE "Order" ALTER COLUMN "shippingZone" TYPE "ShippingZone_new" USING ("shippingZone"::text::"ShippingZone_new");
ALTER TYPE "ShippingZone" RENAME TO "ShippingZone_old";
ALTER TYPE "ShippingZone_new" RENAME TO "ShippingZone";
DROP TYPE "ShippingZone_old";
COMMIT;
