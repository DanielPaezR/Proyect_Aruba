-- CreateTable
CREATE TABLE "worker_score_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_score_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "worker_score_events_userId_createdAt_idx" ON "worker_score_events"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "worker_score_events" ADD CONSTRAINT "worker_score_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_score_events" ADD CONSTRAINT "worker_score_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
