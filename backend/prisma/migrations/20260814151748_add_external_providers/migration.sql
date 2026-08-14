-- CreateEnum
CREATE TYPE "ExternalProvider" AS ENUM ('railway', 'vercel');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'external_connection_added';
ALTER TYPE "ActivityType" ADD VALUE 'external_connection_removed';
ALTER TYPE "ActivityType" ADD VALUE 'railway_project_imported';
ALTER TYPE "ActivityType" ADD VALUE 'vercel_project_imported';

-- CreateTable
CREATE TABLE "ExternalConnection" (
    "id" TEXT NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ExternalConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalConnection_userId_idx" ON "ExternalConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalConnection_userId_provider_key" ON "ExternalConnection"("userId", "provider");

-- AddForeignKey
ALTER TABLE "ExternalConnection" ADD CONSTRAINT "ExternalConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
