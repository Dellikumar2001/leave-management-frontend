ALTER TABLE "employees"
    ADD COLUMN IF NOT EXISTS "designation" TEXT,
    ADD COLUMN IF NOT EXISTS "mobile_number" TEXT,
    ADD COLUMN IF NOT EXISTS "work_email" TEXT;

CREATE TABLE IF NOT EXISTS "employee_leave_applications" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_count" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Approved',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "employee_leave_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_leave_applications_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_leave_applications_leave_type_id_fkey"
        FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "employee_leave_applications_employee_id_start_date_end_date_idx"
    ON "employee_leave_applications"("employee_id", "start_date", "end_date");
