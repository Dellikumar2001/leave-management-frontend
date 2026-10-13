ALTER TABLE "employee_leave_eligibilities"
ADD COLUMN IF NOT EXISTS "credited_days" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "blocked_leaves_employee_id_date_key"
ON "blocked_leaves"("employee_id", "date");
