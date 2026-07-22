/*
  Warnings:

  - The `trigger` column on the `Deployment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `buildStatus` column on the `Deployment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `lifecycleStatus` column on the `Deployment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `level` column on the `DeploymentLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('pending', 'cloning', 'building', 'deploying', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "LifecycleStatus" AS ENUM ('active', 'inactive', 'aborted');

-- CreateEnum
CREATE TYPE "DeploymentTrigger" AS ENUM ('manual', 'webhook', 'redeploy', 'rollback');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- AlterTable
ALTER TABLE "Deployment" DROP COLUMN "trigger",
ADD COLUMN     "trigger" "DeploymentTrigger" NOT NULL DEFAULT 'manual',
DROP COLUMN "buildStatus",
ADD COLUMN     "buildStatus" "BuildStatus" NOT NULL DEFAULT 'pending',
DROP COLUMN "lifecycleStatus",
ADD COLUMN     "lifecycleStatus" "LifecycleStatus" NOT NULL DEFAULT 'inactive';

-- AlterTable
ALTER TABLE "DeploymentLog" DROP COLUMN "level",
ADD COLUMN     "level" "LogLevel" NOT NULL DEFAULT 'INFO';
