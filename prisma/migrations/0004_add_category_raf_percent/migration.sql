-- Add missing RAF percentage column for category allocation logic
ALTER TABLE "Category"
ADD COLUMN IF NOT EXISTS "rafPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
