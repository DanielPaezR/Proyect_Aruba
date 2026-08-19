-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PunchType" ADD VALUE 'ALMUERZO_INICIO';
ALTER TYPE "PunchType" ADD VALUE 'ALMUERZO_FIN';

-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "standardDailyMinutes" INTEGER NOT NULL DEFAULT 480;

-- AlterTable
ALTER TABLE "salary_raises" ADD COLUMN     "newOvertimeRate" DECIMAL(10,2),
ADD COLUMN     "previousOvertimeRate" DECIMAL(10,2);
