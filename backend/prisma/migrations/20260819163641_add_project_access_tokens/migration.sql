/*
  Warnings:

  - A unique constraint covering the columns `[secretAccessTokenHash]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `secretAccessToken` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secretAccessTokenHash` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "secretAccessToken" TEXT NOT NULL,
ADD COLUMN     "secretAccessTokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Project_secretAccessTokenHash_key" ON "Project"("secretAccessTokenHash");
