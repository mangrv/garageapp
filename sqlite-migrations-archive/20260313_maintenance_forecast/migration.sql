CREATE TABLE "MaintenanceForecast" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "carId"       TEXT NOT NULL UNIQUE,
  "items"       TEXT NOT NULL,
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL,
  CONSTRAINT "MaintenanceForecast_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
