-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'slack_installation_added';
ALTER TYPE "ActivityType" ADD VALUE 'slack_installation_removed';

-- CreateTable
CREATE TABLE "SlackInstallation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT,
    "enterpriseId" TEXT,
    "botUserId" TEXT,
    "botId" TEXT,
    "appId" TEXT,
    "scopes" TEXT[],
    "botToken" TEXT NOT NULL,
    "installerSlackUserId" TEXT,
    "raw" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlackInstallation_userId_key" ON "SlackInstallation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackInstallation_teamId_key" ON "SlackInstallation"("teamId");

-- CreateIndex
CREATE INDEX "SlackInstallation_teamId_idx" ON "SlackInstallation"("teamId");

-- CreateIndex
CREATE INDEX "SlackInstallation_userId_idx" ON "SlackInstallation"("userId");

-- AddForeignKey
ALTER TABLE "SlackInstallation" ADD CONSTRAINT "SlackInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
