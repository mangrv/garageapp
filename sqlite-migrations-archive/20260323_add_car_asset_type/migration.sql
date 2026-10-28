-- Add support for non-car assets (trailers, mowers, equipment)
ALTER TABLE "Car" ADD COLUMN "assetType" TEXT NOT NULL DEFAULT 'vehicle';
