/*
  Warnings:

  - The values [provisioning] on the enum `BuildStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BuildStatus_new" AS ENUM ('pending', 'cloning', 'building', 'deploying', 'ready', 'failed', 'aborted');
ALTER TABLE "public"."Deployment" ALTER COLUMN "buildStatus" DROP DEFAULT;
ALTER TABLE "Deployment" ALTER COLUMN "buildStatus" TYPE "BuildStatus_new" USING ("buildStatus"::text::"BuildStatus_new");
ALTER TYPE "BuildStatus" RENAME TO "BuildStatus_old";
ALTER TYPE "BuildStatus_new" RENAME TO "BuildStatus";
DROP TYPE "public"."BuildStatus_old";
ALTER TABLE "Deployment" ALTER COLUMN "buildStatus" SET DEFAULT 'pending';
COMMIT;
