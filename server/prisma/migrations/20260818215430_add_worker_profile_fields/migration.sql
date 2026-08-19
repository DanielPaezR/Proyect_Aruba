-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "overtimeHourlyRate" DECIMAL(10,2),
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workDaysPerWeek" INTEGER,
ADD COLUMN     "workScheduleNote" TEXT;
