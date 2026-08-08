CREATE TABLE "TranslationCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hash" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "translated" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TranslationCache_hash_key" ON "TranslationCache"("hash");
