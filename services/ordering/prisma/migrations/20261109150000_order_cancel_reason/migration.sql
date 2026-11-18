-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cancelReason" TEXT;

-- AlterTable
ALTER TABLE "OrderStatusEvent" ADD COLUMN "reason" TEXT;
