/*
  Warnings:

  - You are about to drop the column `uri` on the `RequestLog` table. All the data in the column will be lost.
  - Added the required column `path` to the `RequestLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RequestLog" DROP COLUMN "uri",
ADD COLUMN     "path" TEXT NOT NULL,
ADD COLUMN     "query" TEXT;

-- CreateIndex
CREATE INDEX "RequestLog_environmentId_path_idx" ON "RequestLog"("environmentId", "path");
