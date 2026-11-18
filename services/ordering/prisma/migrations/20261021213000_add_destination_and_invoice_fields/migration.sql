-- AlterTable
ALTER TABLE "Order" ADD COLUMN "kitchenStatus" "OrderStatus",
ADD COLUMN "barStatus" "OrderStatus";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "destination" TEXT NOT NULL DEFAULT 'kitchen';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "invoiceStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "invoiceRef" TEXT,
ADD COLUMN "invoiceError" TEXT;
