-- Add extended fields to ServiceRecord for CSV import
ALTER TABLE "ServiceRecord" ADD COLUMN "serviceType"    TEXT;
ALTER TABLE "ServiceRecord" ADD COLUMN "details"        TEXT;
ALTER TABLE "ServiceRecord" ADD COLUMN "partsUsed"      TEXT;
ALTER TABLE "ServiceRecord" ADD COLUMN "cost"           REAL;
ALTER TABLE "ServiceRecord" ADD COLUMN "nextServiceDue" TEXT;
ALTER TABLE "ServiceRecord" ADD COLUMN "duration"       TEXT;
ALTER TABLE "ServiceRecord" ADD COLUMN "partsSource"    TEXT;
