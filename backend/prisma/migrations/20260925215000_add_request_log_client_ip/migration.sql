-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN     "clientIp" TEXT;

-- CreateIndex
CREATE INDEX "RequestLog_clientIp_timestamp_idx" ON "RequestLog"("clientIp", "timestamp");

