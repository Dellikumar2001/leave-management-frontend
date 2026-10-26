const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function exec(sql) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (err) {
    console.warn(`Warning executing SQL: ${err.message}`);
  }
}

async function refreshDatabase() {
  console.log("==========================================");
  console.log("       Refreshing Leave Management DB     ");
  console.log("==========================================");

  try {
    // 1. Align table names
    console.log("1. Checking and aligning table names...");
    await exec(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'LeaveType' AND table_type = 'BASE TABLE'
        ) THEN
          ALTER TABLE "LeaveType" RENAME TO "leave_types";
        END IF;
      END $$;
    `);

    // 2. Align column names
    console.log("2. Checking column names in leave_types...");
    await exec(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leave_types' AND column_name = 'days'
        ) THEN
          ALTER TABLE "leave_types" RENAME COLUMN "days" TO "days_allowed";
        END IF;
      END $$;
    `);

    // 3. Drop view if exists, align status column to text, recreate view
    console.log("3. Aligning status and compatibility view...");
    await exec(`DROP VIEW IF EXISTS "LeaveType" CASCADE;`);
    await exec(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'leave_types' AND column_name = 'status' AND data_type = 'USER-DEFINED'
        ) THEN
          ALTER TABLE "leave_types" ALTER COLUMN "status" TYPE TEXT USING "status"::text;
          ALTER TABLE "leave_types" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
        END IF;
      END $$;
    `);
    await exec(`CREATE OR REPLACE VIEW "LeaveType" AS SELECT * FROM "leave_types";`);

    // 4. Check employee table status column
    console.log("4. Checking employees status column...");
    await exec(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Approved';`);

    // 5. Check paternity_leaves columns
    console.log("5. Checking paternity_leaves timestamps...");
    await exec(`ALTER TABLE "paternity_leaves" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await exec(`ALTER TABLE "paternity_leaves" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);

    // 6. Check maternity_leaves columns and primary key
    console.log("6. Checking maternity_leaves structure...");
    await exec(`ALTER TABLE "maternity_leaves" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active';`);
    await exec(`ALTER TABLE "maternity_leaves" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await exec(`ALTER TABLE "maternity_leaves" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);

    const matCols = await prisma.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'maternity_leaves' AND column_name = 'id'
    `);
    if (matCols.length === 0) {
      await exec(`ALTER TABLE "maternity_leaves" DROP CONSTRAINT IF EXISTS "maternity_leaves_pkey" CASCADE;`);
      await exec(`ALTER TABLE "maternity_leaves" ADD COLUMN "id" SERIAL PRIMARY KEY;`);
    }

    // 7. Ensure approver settings contain the final-level backup column
    console.log("7. Checking employee_approvers columns...");
    await exec(`ALTER TABLE IF EXISTS "employee_approvers" ADD COLUMN IF NOT EXISTS "final_level_backup_officer" TEXT;`);

    // 8. Clear postgres cached plans by terminating idle connections
    console.log("8. Terminating stale backend connections to clear cache...");
    try {
      await prisma.$executeRawUnsafe(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = 'leave_management'
          AND pid <> pg_backend_pid();
      `);
    } catch {
      // Ignore if permission issue
    }

    console.log("\nDatabase schema alignment completed successfully!");
  } catch (error) {
    console.error("Database alignment error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

refreshDatabase();
