ALTER TYPE "LeaveRequestType" ADD VALUE IF NOT EXISTS 'ANNUAL';

CREATE TABLE "employee_leave_usage" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days_count" INTEGER NOT NULL DEFAULT 1,
    "type" "LeaveRequestType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "reason" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "employee_leave_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_leave_usage_employee_id_leave_type_id_start_date_key"
ON "employee_leave_usage"("employee_id", "leave_type_id", "start_date");

CREATE INDEX "employee_leave_usage_employee_id_start_date_end_date_idx"
ON "employee_leave_usage"("employee_id", "start_date", "end_date");

ALTER TABLE "employee_leave_usage"
ADD CONSTRAINT "employee_leave_usage_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_leave_usage"
ADD CONSTRAINT "employee_leave_usage_leave_type_id_fkey"
FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
