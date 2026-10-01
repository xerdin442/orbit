/*
  Warnings:

  - The `status` column on the `Domain` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Resource` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `type` on the `Resource` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('postgres', 'mysql', 'redis', 'mongo', 'clickhouse');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('provisioning', 'ready', 'unhealthy', 'failed');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('pending', 'active', 'error');

-- AlterTable
ALTER TABLE "Domain" DROP COLUMN "status",
ADD COLUMN     "status" "DomainStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Resource" DROP COLUMN "type",
ADD COLUMN     "type" "ResourceType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ResourceStatus" NOT NULL DEFAULT 'provisioning';
