-- New message types (brand notification emails; registration + shipped SMS), the customer's
-- cancellation-request fields on Order, and removal of the abandoned-bag reminder's table.
-- Everything is additive except the DropTable at the end: the AbandonedCheckout rows were only
-- ever captured emails + cart snapshots for the reminder feature that no longer exists.
-- (Adding several enum values in one migration needs PostgreSQL 12+.)


-- AlterEnum

ALTER TYPE "EmailType" ADD VALUE 'ADMIN_CONTACT_MESSAGE';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_NEW_ORDER';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_NEW_PREORDER';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_ORDER_UPDATE';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_CANCELLATION_REQUEST';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_ACCOUNT_REGISTERED';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_LOGIN_LOCKOUT';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_ORDER_DELIVERED';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_RETURN_REQUEST';
ALTER TYPE "EmailType" ADD VALUE 'ADMIN_NOTIFY_ME';

-- AlterEnum

ALTER TYPE "SmsType" ADD VALUE 'ACCOUNT_REGISTERED';
ALTER TYPE "SmsType" ADD VALUE 'ORDER_SHIPPED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancellationRequestedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "AbandonedCheckout";

