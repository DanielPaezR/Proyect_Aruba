-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGEN', 'VIDEO');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "referenceMediaType" "MediaType";

-- AlterTable
ALTER TABLE "evidences" ADD COLUMN     "mediaType" "MediaType";
