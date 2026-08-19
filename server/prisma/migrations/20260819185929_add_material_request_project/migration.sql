-- AlterTable
ALTER TABLE "material_requests" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "material_requests_projectId_idx" ON "material_requests"("projectId");

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
