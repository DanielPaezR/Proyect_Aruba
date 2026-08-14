-- CreateTable
CREATE TABLE "geofence_proximity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geofence_proximity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "geofence_proximity_logs_userId_detectedAt_idx" ON "geofence_proximity_logs"("userId", "detectedAt");

-- AddForeignKey
ALTER TABLE "geofence_proximity_logs" ADD CONSTRAINT "geofence_proximity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
