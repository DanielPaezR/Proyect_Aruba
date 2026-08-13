-- CreateEnum
CREATE TYPE "ProjectSector" AS ENUM ('ORANJESTAD', 'SAN_NICOLAS', 'NOORD', 'SANTA_CRUZ', 'PARADERA', 'SAVANETA', 'OTRO');

-- CreateEnum
CREATE TYPE "ProjectPropertyType" AS ENUM ('RESIDENCIAL', 'COMERCIAL', 'INDUSTRIAL');

-- CreateEnum
CREATE TYPE "ProjectWorkType" AS ENUM ('INSTALACION_NUEVA', 'REMODELACION', 'MANTENIMIENTO', 'REPARACION_EMERGENCIA', 'INSPECCION');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "accessNotes" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "electricalPlansUrl" TEXT,
ADD COLUMN     "ownerEmail" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ownerPhone" TEXT,
ADD COLUMN     "priority" "ProjectPriority" DEFAULT 'MEDIA',
ADD COLUMN     "propertyType" "ProjectPropertyType",
ADD COLUMN     "sector" "ProjectSector",
ADD COLUMN     "workType" "ProjectWorkType";
