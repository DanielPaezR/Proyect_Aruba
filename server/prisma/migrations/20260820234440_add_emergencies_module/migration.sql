-- CreateEnum
CREATE TYPE "EmergencyPriority" AS ENUM ('MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('REPORTADA', 'ASIGNADA', 'EN_PROGRESO', 'RESUELTA');

-- AlterEnum
ALTER TYPE "Feature" ADD VALUE 'EMERGENCIAS';

-- CreateTable
CREATE TABLE "emergencies" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "locationMapsUrl" TEXT,
    "priority" "EmergencyPriority" NOT NULL DEFAULT 'ALTA',
    "status" "EmergencyStatus" NOT NULL DEFAULT 'REPORTADA',
    "reportedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "emergencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_assignments" (
    "id" TEXT NOT NULL,
    "emergencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emergencies_status_idx" ON "emergencies"("status");

-- CreateIndex
CREATE INDEX "emergencies_projectId_idx" ON "emergencies"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_assignments_emergencyId_userId_key" ON "emergency_assignments"("emergencyId", "userId");

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_assignments" ADD CONSTRAINT "emergency_assignments_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "emergencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_assignments" ADD CONSTRAINT "emergency_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
