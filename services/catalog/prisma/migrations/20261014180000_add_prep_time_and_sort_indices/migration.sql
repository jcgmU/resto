-- AlterTable
ALTER TABLE "Product" ADD COLUMN "prepTimeMinutes" INTEGER;

-- CreateIndex
CREATE INDEX "Category_tenantId_sortOrder_idx" ON "Category"("tenantId", "sortOrder");

-- CreateIndex
CREATE INDEX "Product_tenantId_sortOrder_idx" ON "Product"("tenantId", "sortOrder");
