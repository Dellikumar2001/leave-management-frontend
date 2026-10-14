DO $$
BEGIN
    IF to_regclass('"LeaveType"') IS NOT NULL
       AND to_regclass('leave_types') IS NULL THEN
        ALTER TABLE "LeaveType" RENAME TO leave_types;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('leave_types') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'leave_types'
             AND column_name = 'days'
       )
       AND NOT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'leave_types'
             AND column_name = 'days_allowed'
       ) THEN
        ALTER TABLE leave_types RENAME COLUMN days TO days_allowed;
    END IF;
END $$;

ALTER TABLE IF EXISTS leave_types
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE IF EXISTS leave_types
    ALTER COLUMN status TYPE TEXT USING status::text;

ALTER TABLE IF EXISTS leave_types
    ALTER COLUMN status SET DEFAULT 'ACTIVE';

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Approved';
