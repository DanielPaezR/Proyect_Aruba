-- CreateEnum
CREATE TYPE "AgendaEventType" AS ENUM ('REUNION', 'PENDIENTE', 'OTRO');

-- CreateTable
CREATE TABLE "agenda_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "type" "AgendaEventType" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_events_startAt_idx" ON "agenda_events"("startAt");

-- AddForeignKey
ALTER TABLE "agenda_events" ADD CONSTRAINT "agenda_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
