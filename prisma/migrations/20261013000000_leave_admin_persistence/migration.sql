DO $$
BEGIN
    CREATE TYPE "LeaveCategory" AS ENUM ('ANNUAL', 'MEDICAL', 'CASUAL', 'EMERGENCY', 'SPECIAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF to_regclass('public."LeaveType"') IS NULL AND to_regclass('public.leave_types') IS NOT NULL THEN
        ALTER TABLE "leave_types" RENAME TO "LeaveType";
    END IF;
    IF to_regclass('public."LeaveCategoryMaster"') IS NULL
       AND to_regclass('public."LeaveCategoryDefinition"') IS NOT NULL THEN
        ALTER TABLE "LeaveCategoryDefinition" RENAME TO "LeaveCategoryMaster";
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'LeaveType' AND column_name = 'days_allowed'
    ) THEN
        ALTER TABLE "LeaveType" RENAME COLUMN "days_allowed" TO "days";
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'LeaveType' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE "LeaveType" RENAME COLUMN "created_at" TO "createdAt";
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'LeaveType' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE "LeaveType" RENAME COLUMN "updated_at" TO "updatedAt";
    END IF;
END $$;

DO $$
BEGIN
    CREATE TYPE "EmployeeCategory" AS ENUM ('STUDENT', 'TEACHING_STAFF', 'NON_TEACHING_STAFF');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "LeaveType"
ADD COLUMN IF NOT EXISTS "applicableTo" "EmployeeCategory"[] NOT NULL DEFAULT ARRAY['STUDENT'::"EmployeeCategory"];

ALTER TABLE "LeaveType"
ADD COLUMN IF NOT EXISTS "category" "LeaveCategory";

DO $$
BEGIN
    IF (
        SELECT udt_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'LeaveType' AND column_name = 'status'
    ) <> 'LeaveStatus' THEN
        ALTER TABLE "LeaveType" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "LeaveType"
        ALTER COLUMN "status" TYPE "LeaveStatus"
        USING UPPER("status"::text)::"LeaveStatus";
        ALTER TABLE "LeaveType" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
    END IF;
END $$;

ALTER TABLE "LeaveCategoryMaster"
ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "blocked_leaves" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blocked_leaves_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "leave_credits" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "category" "LeaveCategory" NOT NULL,
    "days" INTEGER NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "leave_type_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leave_credits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_notifications" (
    "id" SERIAL NOT NULL,
    "employee_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_leave_balances" (
    "employee_id" TEXT NOT NULL,
    "category" "LeaveCategory" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "employee_leave_balances_pkey" PRIMARY KEY ("employee_id", "category")
);

CREATE INDEX IF NOT EXISTS "leave_credits_employee_id_category_created_at_idx"
ON "leave_credits"("employee_id", "category", "created_at");
CREATE INDEX IF NOT EXISTS "employee_notifications_employee_id_is_read_created_at_idx"
ON "employee_notifications"("employee_id", "is_read", "created_at");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blocked_leaves_employee_id_fkey') THEN
        ALTER TABLE "blocked_leaves"
        ADD CONSTRAINT "blocked_leaves_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_credits_employee_id_fkey') THEN
        ALTER TABLE "leave_credits"
        ADD CONSTRAINT "leave_credits_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_credits_leave_type_id_fkey') THEN
        ALTER TABLE "leave_credits"
        ADD CONSTRAINT "leave_credits_leave_type_id_fkey"
        FOREIGN KEY ("leave_type_id") REFERENCES "LeaveType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_notifications_employee_id_fkey') THEN
        ALTER TABLE "employee_notifications"
        ADD CONSTRAINT "employee_notifications_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_leave_balances_employee_id_fkey') THEN
        ALTER TABLE "employee_leave_balances"
        ADD CONSTRAINT "employee_leave_balances_employee_id_fkey"
        FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
