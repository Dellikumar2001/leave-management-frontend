ALTER TABLE "employee_approvers"
  ALTER COLUMN "first_level_approver" DROP NOT NULL,
  ALTER COLUMN "final_level_approver" DROP NOT NULL;

ALTER TABLE "employee_approvers"
  ADD COLUMN IF NOT EXISTS "backup_officer" TEXT;
