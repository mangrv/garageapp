ALTER TABLE "Car" ADD COLUMN "relationshipToUser" TEXT NOT NULL DEFAULT 'owned';
ALTER TABLE "Car" ADD COLUMN "managedOwnerName" TEXT;
ALTER TABLE "Car" ADD COLUMN "managedOwnerContact" TEXT;
ALTER TABLE "Car" ADD COLUMN "managedOwnerNotes" TEXT;
