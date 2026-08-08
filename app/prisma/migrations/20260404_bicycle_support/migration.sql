-- Add bicycle support: bikeType, frameSize, wheelSize fields to Car
ALTER TABLE "Car" ADD COLUMN "bikeType" TEXT;
ALTER TABLE "Car" ADD COLUMN "frameSize" TEXT;
ALTER TABLE "Car" ADD COLUMN "wheelSize" TEXT;
