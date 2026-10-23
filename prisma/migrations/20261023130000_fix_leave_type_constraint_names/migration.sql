DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LeaveType_pkey'
      AND conrelid = 'leave_types'::regclass
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leave_types_pkey'
      AND conrelid = 'leave_types'::regclass
  ) THEN
    ALTER TABLE "leave_types"
      RENAME CONSTRAINT "LeaveType_pkey" TO "leave_types_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."LeaveType_code_key"') IS NOT NULL
    AND to_regclass('public.leave_types_code_key') IS NULL THEN
    ALTER INDEX "LeaveType_code_key" RENAME TO "leave_types_code_key";
  END IF;
END $$;
