-- AlterTable: add AI model preferences to User
ALTER TABLE "User" ADD COLUMN "aiModel" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "User" ADD COLUMN "aiApiKey" TEXT;
