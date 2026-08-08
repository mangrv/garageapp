CREATE TABLE "CarDocument" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "carId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'other',
  "label" TEXT,
  "expiresAt" DATETIME,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarDocument_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CarDocument_carId_idx" ON "CarDocument"("carId");
