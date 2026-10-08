ALTER TABLE "employee_leave_eligibilities"
ADD COLUMN "joining_date" DATE NOT NULL
DEFAULT (DATE '2026-01-01' + FLOOR(RANDOM() * 364)::INTEGER);
