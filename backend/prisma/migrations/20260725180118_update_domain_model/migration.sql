/*
  Warnings:

  - The values [error] on the enum `DomainStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `sslEnabled` on the `Domain` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DomainType" AS ENUM ('managed', 'custom');

-- AlterEnum
BEGIN;
CREATE TYPE "DomainStatus_new" AS ENUM ('pending', 'verifying', 'active', 'failed');
ALTER TABLE "public"."Domain" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Domain" ALTER COLUMN "status" TYPE "DomainStatus_new" USING ("status"::text::"DomainStatus_new");
ALTER TYPE "DomainStatus" RENAME TO "DomainStatus_old";
ALTER TYPE "DomainStatus_new" RENAME TO "DomainStatus";
DROP TYPE "public"."DomainStatus_old";
ALTER TABLE "Domain" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- AlterTable
ALTER TABLE "Domain" DROP COLUMN "sslEnabled",
ADD COLUMN     "type" "DomainType" NOT NULL DEFAULT 'managed',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
