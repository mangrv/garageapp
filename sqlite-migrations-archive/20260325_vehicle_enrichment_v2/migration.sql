-- VehicleExternalData: raw API responses per provider
CREATE TABLE "VehicleExternalData" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "carId"            TEXT NOT NULL,
    "provider"         TEXT NOT NULL,
    "recordType"       TEXT NOT NULL,
    "rawJson"          TEXT NOT NULL,
    "normalizedStatus" TEXT NOT NULL DEFAULT 'raw',
    "fetchedAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleExternalData_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE
);

-- VehicleRecall: normalized recall records
CREATE TABLE "VehicleRecall" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "carId"          TEXT NOT NULL,
    "campaignNumber" TEXT NOT NULL,
    "component"      TEXT NOT NULL,
    "summary"        TEXT,
    "recallDate"     TEXT,
    "isOpen"         BOOLEAN NOT NULL DEFAULT true,
    "consequence"    TEXT,
    "remedy"         TEXT,
    "sourceProvider" TEXT NOT NULL DEFAULT 'nhtsa',
    "lastCheckedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleRecall_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "VehicleRecall_carId_campaignNumber_key" ON "VehicleRecall"("carId", "campaignNumber");

-- VehicleMarketValue: market value records from providers
CREATE TABLE "VehicleMarketValue" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "carId"          TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL,
    "valueLow"       REAL,
    "valueAvg"       REAL,
    "valueHigh"      REAL,
    "currency"       TEXT NOT NULL DEFAULT 'USD',
    "mileageUsed"    INTEGER,
    "zipUsed"        TEXT,
    "fetchedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawJson"        TEXT,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleMarketValue_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE
);

-- VehicleEstimate: computed estimate with per-component breakdown
CREATE TABLE "VehicleEstimate" (
    "id"                    TEXT NOT NULL PRIMARY KEY,
    "carId"                 TEXT NOT NULL UNIQUE,
    "marketBaseline"        REAL,
    "marketSource"          TEXT,
    "garageEstimate"        REAL,
    "maintenanceAdjustment" REAL NOT NULL DEFAULT 0,
    "repairAdjustment"      REAL NOT NULL DEFAULT 0,
    "conditionAdjustment"   REAL NOT NULL DEFAULT 0,
    "mileageAdjustment"     REAL NOT NULL DEFAULT 0,
    "recallAdjustment"      REAL NOT NULL DEFAULT 0,
    "modAdjustment"         REAL NOT NULL DEFAULT 0,
    "adjustmentDetailJson"  TEXT,
    "confidenceScore"       INTEGER NOT NULL DEFAULT 0,
    "confidence"            TEXT NOT NULL DEFAULT 'low',
    "confidenceReason"      TEXT,
    "conditionScore"        INTEGER,
    "conditionNotes"        TEXT,
    "version"               INTEGER NOT NULL DEFAULT 1,
    "generatedAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleEstimate_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE
);

-- VehicleEstimateSnapshot: value history
CREATE TABLE "VehicleEstimateSnapshot" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "carId"          TEXT NOT NULL,
    "garageEstimate" REAL,
    "marketBaseline" REAL,
    "confidence"     TEXT,
    "triggerSource"  TEXT NOT NULL DEFAULT 'manual',
    "generatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleEstimateSnapshot_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE
);
