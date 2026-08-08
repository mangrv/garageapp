-- CreateTable: Job (from Project) — safe to re-run
CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "carId" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "shareToken" TEXT,
    "toolsJson" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Job_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy data from Project to Job (only rows not already copied)
INSERT OR IGNORE INTO "Job" (id, userId, title, carId, notes, status, shareToken, toolsJson, startedAt, completedAt, createdAt, updatedAt)
SELECT id, userId, title, carId, notes, status, shareToken, toolsJson, startedAt, completedAt, createdAt, updatedAt
FROM "Project"
WHERE NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='Project') = 0;

-- CreateTable: JobAttachment — safe to re-run
CREATE TABLE IF NOT EXISTS "JobAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "vendor" TEXT,
    "amount" REAL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobAttachment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex: Job shareToken unique (ignore if exists)
CREATE UNIQUE INDEX IF NOT EXISTS "Job_shareToken_key" ON "Job"("shareToken");

-- Rename Phase.projectId -> Phase.jobId (only if column still named projectId)
ALTER TABLE "Phase" RENAME COLUMN "projectId" TO "jobId";

-- Rename ServiceRecord.projectId -> ServiceRecord.jobId
ALTER TABLE "ServiceRecord" RENAME COLUMN "projectId" TO "jobId";

-- Rename AIConversation.projectId -> AIConversation.jobId
ALTER TABLE "AIConversation" RENAME COLUMN "projectId" TO "jobId";

-- Drop old Project table
DROP TABLE IF EXISTS "Project";
