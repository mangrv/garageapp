-- Add warranty tracking fields to receipt line items
ALTER TABLE "ReceiptLineItem" ADD COLUMN "warrantyProvider" TEXT;
ALTER TABLE "ReceiptLineItem" ADD COLUMN "warrantyStart" DATETIME;
ALTER TABLE "ReceiptLineItem" ADD COLUMN "warrantyEnd" DATETIME;
ALTER TABLE "ReceiptLineItem" ADD COLUMN "warrantyNotes" TEXT;
