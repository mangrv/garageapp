-- Add car fields to Project
ALTER TABLE "Project" ADD COLUMN "year" INTEGER;
ALTER TABLE "Project" ADD COLUMN "make" TEXT;
ALTER TABLE "Project" ADD COLUMN "model" TEXT;
ALTER TABLE "Project" ADD COLUMN "trim" TEXT;
ALTER TABLE "Project" ADD COLUMN "color" TEXT;

-- Create Comment table
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create Photo table
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
