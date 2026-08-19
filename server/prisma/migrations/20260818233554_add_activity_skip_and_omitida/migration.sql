-- AlterEnum
ALTER TYPE "ActivityStatus" ADD VALUE 'OMITIDA';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "skipReason" TEXT,
ADD COLUMN     "skippedAt" TIMESTAMP(3),
ADD COLUMN     "skippedById" TEXT;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_skippedById_fkey" FOREIGN KEY ("skippedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
