-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('HERRAMIENTA', 'MATERIAL');

-- CreateEnum
CREATE TYPE "MaterialRequestStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ENTREGADA');

-- CreateEnum
CREATE TYPE "ToolIncidentType" AS ENUM ('DANIO', 'PERDIDA');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MERCADERISTA';

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventoryItemType" NOT NULL,
    "unit" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_assignments" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "condition" TEXT,

    CONSTRAINT "tool_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requests" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "itemId" TEXT,
    "itemNameFreeText" TEXT,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_incident_reports" (
    "id" TEXT NOT NULL,
    "toolAssignmentId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "type" "ToolIncidentType" NOT NULL,
    "description" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "tool_incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_assignments_itemId_idx" ON "tool_assignments"("itemId");

-- CreateIndex
CREATE INDEX "tool_assignments_userId_idx" ON "tool_assignments"("userId");

-- CreateIndex
CREATE INDEX "material_requests_requestedById_idx" ON "material_requests"("requestedById");

-- CreateIndex
CREATE INDEX "material_requests_itemId_idx" ON "material_requests"("itemId");

-- CreateIndex
CREATE INDEX "material_requests_status_idx" ON "material_requests"("status");

-- CreateIndex
CREATE INDEX "tool_incident_reports_toolAssignmentId_idx" ON "tool_incident_reports"("toolAssignmentId");

-- AddForeignKey
ALTER TABLE "tool_assignments" ADD CONSTRAINT "tool_assignments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_assignments" ADD CONSTRAINT "tool_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_incident_reports" ADD CONSTRAINT "tool_incident_reports_toolAssignmentId_fkey" FOREIGN KEY ("toolAssignmentId") REFERENCES "tool_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_incident_reports" ADD CONSTRAINT "tool_incident_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
