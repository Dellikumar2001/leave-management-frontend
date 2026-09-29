ALTER TABLE "leave_types"
ADD COLUMN "days_allowed" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "leave_types"
DROP COLUMN "effective_date";