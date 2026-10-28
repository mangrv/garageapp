-- Add public profile fields to User
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "publicBio" TEXT;
ALTER TABLE "User" ADD COLUMN "isPublic" INTEGER NOT NULL DEFAULT 0;

-- Unique index on username
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- Add public flag to Car
ALTER TABLE "Car" ADD COLUMN "isPublic" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Car" ADD COLUMN "publicNotes" TEXT;
