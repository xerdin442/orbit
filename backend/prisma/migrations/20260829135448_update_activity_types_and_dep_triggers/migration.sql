/*
  Warnings:

  - The values [railway_project_imported,vercel_project_imported] on the enum `ActivityType` will be removed. If these variants are still used in the database, this will fail.
  - The values [webhook] on the enum `DeploymentTrigger` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ActivityType_new" AS ENUM ('user_signed_up', 'user_signed_in', 'project_created', 'project_updated', 'project_deleted', 'environment_created', 'environment_updated', 'environment_deleted', 'deployment_started', 'deployment_completed', 'deployment_failed', 'deployment_rolled_back', 'deployment_aborted', 'variable_created', 'variable_updated', 'variable_deleted', 'domain_added', 'domain_removed', 'domain_verified', 'domain_verification_retried', 'github_installation_added', 'github_installation_removed', 'github_webhook_event', 'resource_provisioned', 'resource_deleted', 'resource_data_cleared', 'slack_installation_added', 'slack_installation_removed', 'slack_token_revoked', 'external_connection_added', 'external_connection_removed');
ALTER TABLE "Activity" ALTER COLUMN "type" TYPE "ActivityType_new" USING ("type"::text::"ActivityType_new");
ALTER TYPE "ActivityType" RENAME TO "ActivityType_old";
ALTER TYPE "ActivityType_new" RENAME TO "ActivityType";
DROP TYPE "public"."ActivityType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "DeploymentTrigger_new" AS ENUM ('manual', 'github', 'redeploy', 'rollback');
ALTER TABLE "public"."Deployment" ALTER COLUMN "trigger" DROP DEFAULT;
ALTER TABLE "Deployment" ALTER COLUMN "trigger" TYPE "DeploymentTrigger_new" USING ("trigger"::text::"DeploymentTrigger_new");
ALTER TYPE "DeploymentTrigger" RENAME TO "DeploymentTrigger_old";
ALTER TYPE "DeploymentTrigger_new" RENAME TO "DeploymentTrigger";
DROP TYPE "public"."DeploymentTrigger_old";
ALTER TABLE "Deployment" ALTER COLUMN "trigger" SET DEFAULT 'manual';
COMMIT;
