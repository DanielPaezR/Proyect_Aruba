-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MANUAL', 'AUTO_GEOFENCE');

-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN     "editReason" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT,
ADD COLUMN     "originalTimestamp" TIMESTAMP(3),
ADD COLUMN     "source" "TimeEntrySource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastKnownLatitude" DOUBLE PRECISION,
ADD COLUMN     "lastKnownLongitude" DOUBLE PRECISION,
ADD COLUMN     "lastLocationAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "officeLatitude" DOUBLE PRECISION,
    "officeLongitude" DOUBLE PRECISION,
    "officeRadiusMeters" INTEGER NOT NULL DEFAULT 125,
    "morningWindowStart" TEXT NOT NULL DEFAULT '06:30',
    "morningWindowEnd" TEXT NOT NULL DEFAULT '07:30',
    "afternoonWindowStart" TEXT NOT NULL DEFAULT '16:30',
    "afternoonWindowEnd" TEXT NOT NULL DEFAULT '18:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
