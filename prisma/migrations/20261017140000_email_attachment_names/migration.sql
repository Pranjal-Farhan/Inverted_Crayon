-- Names of the files attached to each outbox email (the PDF receipt).
-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "attachmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
