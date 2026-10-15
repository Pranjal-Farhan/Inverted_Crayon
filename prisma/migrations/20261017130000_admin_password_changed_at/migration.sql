-- When an admin/staff account's password was last changed; older login sessions stop working.
-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);
