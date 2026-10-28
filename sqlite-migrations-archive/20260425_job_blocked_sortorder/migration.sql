-- Add sortOrder to Job for priority ordering
ALTER TABLE "Job" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
-- Note: blocked is a valid status value; no schema change needed (status is a string field)
