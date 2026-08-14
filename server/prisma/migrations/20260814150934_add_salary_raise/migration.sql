-- CreateTable
CREATE TABLE "salary_raises" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousRate" DECIMAL(10,2),
    "newRate" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_raises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_raises_userId_createdAt_idx" ON "salary_raises"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "salary_raises" ADD CONSTRAINT "salary_raises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_raises" ADD CONSTRAINT "salary_raises_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
