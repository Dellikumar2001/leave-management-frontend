ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "gender" TEXT;

UPDATE "employees"
SET "gender" = 'Unknown'
WHERE "gender" IS NULL;

ALTER TABLE "employees"
ALTER COLUMN "gender" SET NOT NULL;