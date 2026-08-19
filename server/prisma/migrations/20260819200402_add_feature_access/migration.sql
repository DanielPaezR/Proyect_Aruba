-- CreateEnum
CREATE TYPE "Feature" AS ENUM ('USUARIOS', 'PROYECTOS', 'CLIENTES', 'INVENTARIO', 'EVIDENCIAS', 'FACTURAS');

-- CreateTable
CREATE TABLE "user_feature_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "Feature" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_feature_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_feature_access_userId_feature_key" ON "user_feature_access"("userId", "feature");

-- AddForeignKey
ALTER TABLE "user_feature_access" ADD CONSTRAINT "user_feature_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feature_access" ADD CONSTRAINT "user_feature_access_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
