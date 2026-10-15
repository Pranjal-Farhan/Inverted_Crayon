-- Facebook sign-in is gone: drop the Facebook account link on customers and admin/staff accounts
-- (Google remains). SMS sending was also switched off, but its table and types are deliberately
-- left alone — see the SmsLog note in schema.prisma.

-- DropIndex / DropColumn
DROP INDEX IF EXISTS "Customer_facebookId_key";
DROP INDEX IF EXISTS "AdminUser_facebookId_key";
ALTER TABLE "Customer" DROP COLUMN "facebookId";
ALTER TABLE "AdminUser" DROP COLUMN "facebookId";
