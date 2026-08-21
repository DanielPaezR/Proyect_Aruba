-- CreateTable
CREATE TABLE "agenda_event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agenda_event_participants_eventId_userId_key" ON "agenda_event_participants"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "agenda_event_participants" ADD CONSTRAINT "agenda_event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "agenda_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_event_participants" ADD CONSTRAINT "agenda_event_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
