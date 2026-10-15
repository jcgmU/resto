-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "estimatedPrepMinutes" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "operatingMode" TEXT NOT NULL DEFAULT 'hybrid';
