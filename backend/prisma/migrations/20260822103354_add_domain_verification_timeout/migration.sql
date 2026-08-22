-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'domain_verification_retried';

-- AlterTable
ALTER TABLE "Domain" ADD COLUMN     "verificationTimeout" TIMESTAMP(3);
