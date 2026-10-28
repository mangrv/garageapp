-- Add accessLevel to Invite (view | full), defaults to view
ALTER TABLE "Invite" ADD COLUMN "accessLevel" TEXT NOT NULL DEFAULT 'view';
