-- Add isPrivate flag to CarPhoto
ALTER TABLE "CarPhoto" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- Add isPrivate flag to CarDocument
ALTER TABLE "CarDocument" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- Auto-mark sensitive document types as private
UPDATE "CarDocument" SET "isPrivate" = true WHERE "type" IN ('registration', 'title', 'financing', 'insurance', 'loan', 'warranty_doc', 'lien');
