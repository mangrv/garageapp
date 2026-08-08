-- AlterTable: add clonedFromId, clonedFromTitle to Job
ALTER TABLE "Job" ADD COLUMN "clonedFromId" TEXT;
ALTER TABLE "Job" ADD COLUMN "clonedFromTitle" TEXT;

-- CreateIndex
CREATE INDEX "Job_clonedFromId_idx" ON "Job"("clonedFromId");
