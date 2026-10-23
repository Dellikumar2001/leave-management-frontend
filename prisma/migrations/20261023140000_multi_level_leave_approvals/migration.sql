ALTER TABLE "employee_approvers"
  ADD COLUMN IF NOT EXISTS "second_level_approver" TEXT;

ALTER TABLE "employee_leave_applications"
  ADD COLUMN IF NOT EXISTS "current_approval_level" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "employee_leave_applications"
  ALTER COLUMN "status" SET DEFAULT 'Pending';

CREATE TABLE IF NOT EXISTS "employee_leave_approvals" (
  "id" SERIAL NOT NULL,
  "application_id" INTEGER NOT NULL,
  "level" INTEGER NOT NULL,
  "approver" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "is_backup" BOOLEAN NOT NULL DEFAULT false,
  "remarks" TEXT,
  "action_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_leave_approvals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_leave_approvals_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "employee_leave_applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_leave_approvals_application_id_level_key"
  ON "employee_leave_approvals"("application_id", "level");
CREATE INDEX IF NOT EXISTS "employee_leave_applications_status_current_approval_level_idx"
  ON "employee_leave_applications"("status", "current_approval_level");