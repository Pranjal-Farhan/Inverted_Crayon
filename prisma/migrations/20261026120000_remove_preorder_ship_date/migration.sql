-- The "Preorder ship date" feature is gone. ProductTag.meta only ever held { shipDate } on a
-- PREORDER tag, so the column goes with it. (The PREORDER_SHIP_UPDATE value stays in the
-- EmailType enum, marked retired in the schema: Postgres can't drop an enum value without
-- rewriting the type, and old outbox rows may still carry it.)
ALTER TABLE "ProductTag" DROP COLUMN "meta";
