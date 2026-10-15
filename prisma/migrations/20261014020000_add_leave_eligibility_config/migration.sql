CREATE TABLE IF NOT EXISTS "leave_eligibilities" (
    "id" SERIAL NOT NULL,
    "eligibility_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "employee_type" TEXT NOT NULL,
    "employment_type" TEXT NOT NULL,
    "management_stream" TEXT NOT NULL DEFAULT '',
    "leave_group" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leave_eligibilities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leave_eligibilities_status_idx" ON "leave_eligibilities"("status");