-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM (
  'user_signed_up',
  'user_signed_in',
  'project_created',
  'project_updated',
  'project_deleted',
  'environment_created',
  'environment_updated',
  'environment_deleted',
  'deployment_started',
  'deployment_completed',
  'deployment_failed',
  'deployment_rolled_back',
  'deployment_aborted',
  'variable_created',
  'variable_updated',
  'variable_deleted',
  'domain_added',
  'domain_removed',
  'github_installation_added',
  'github_installation_removed',
  'resource_provisioned',
  'resource_deleted'
);

-- CreateTable
CREATE TABLE "Activity" (
  "id" TEXT NOT NULL,
  "type" "ActivityType" NOT NULL,
  "actorId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_actorId_idx" ON "Activity"("actorId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- Create a function that raises an exception on modification
CREATE OR REPLACE FUNCTION prevent_activity_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Activity logs are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to block UPDATE
DROP TRIGGER IF EXISTS enforce_activity_log_no_update ON "Activity";
CREATE TRIGGER enforce_activity_log_no_update
BEFORE UPDATE ON "Activity"
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_log_modification();

-- Attach trigger to block DELETE
DROP TRIGGER IF EXISTS enforce_activity_log_no_delete ON "Activity";
CREATE TRIGGER enforce_activity_log_no_delete
BEFORE DELETE ON "Activity"
FOR EACH ROW
EXECUTE FUNCTION prevent_activity_log_modification();
