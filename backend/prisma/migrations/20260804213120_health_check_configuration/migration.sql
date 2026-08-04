-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "healthCheckPath" TEXT NOT NULL DEFAULT '/health',
ADD COLUMN     "healthCheckPort" INTEGER NOT NULL DEFAULT 3000,
ADD COLUMN     "healthCheckTimeout" INTEGER NOT NULL DEFAULT 60;
