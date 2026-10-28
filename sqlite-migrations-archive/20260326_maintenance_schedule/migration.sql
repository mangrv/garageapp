CREATE TABLE "MaintenanceScheduleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "notes" TEXT,
    "intervalMiles" INTEGER,
    "intervalMonths" INTEGER,
    "lastDoneMiles" INTEGER,
    "lastDoneDate" DATETIME,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceScheduleItem_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MaintenanceScheduleItem_carId_idx" ON "MaintenanceScheduleItem"("carId");
