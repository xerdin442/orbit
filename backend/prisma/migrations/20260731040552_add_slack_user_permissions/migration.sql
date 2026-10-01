/*
  Warnings:

  - Made the column `installerSlackUserId` on table `SlackInstallation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SlackInstallation" ADD COLUMN     "authorizedSlackUserIds" TEXT[],
ALTER COLUMN "installerSlackUserId" SET NOT NULL;
