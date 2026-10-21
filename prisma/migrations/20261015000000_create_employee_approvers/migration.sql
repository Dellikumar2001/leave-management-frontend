-- CreateTable
CREATE TABLE IF NOT EXISTS "employee_approvers" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "first_level_approver" TEXT NOT NULL,
    "final_level_approver" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_approvers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "employee_approvers_employee_id_key" ON "employee_approvers"("employee_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employee_approvers_employee_id_idx" ON "employee_approvers"("employee_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employee_approvers_employee_id_fkey'
    ) THEN
        ALTER TABLE "employee_approvers" ADD CONSTRAINT "employee_approvers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
