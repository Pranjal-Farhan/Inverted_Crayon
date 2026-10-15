-- Two new customer emails: "we got your cancellation request" and "your order was cancelled".

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'ORDER_CANCELLATION_REQUESTED';
ALTER TYPE "EmailType" ADD VALUE 'ORDER_CANCELLED';
