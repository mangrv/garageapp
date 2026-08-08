-- AlterTable: add blurb fields to VinEnrichment
ALTER TABLE "VinEnrichment" ADD COLUMN "blurb" TEXT;
ALTER TABLE "VinEnrichment" ADD COLUMN "blurbGeneratedAt" DATETIME;
