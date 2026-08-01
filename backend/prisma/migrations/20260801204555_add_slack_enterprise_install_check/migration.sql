-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'slack_token_revoked';

-- AlterTable
ALTER TABLE "SlackInstallation" ADD COLUMN     "isEnterpriseInstall" BOOLEAN NOT NULL DEFAULT false;
