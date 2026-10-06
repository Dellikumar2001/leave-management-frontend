CREATE TABLE "employees" (
    "employee_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "department" TEXT NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("employee_id")
);

CREATE TABLE "employee_leave_eligibilities" (
    "employee_id" TEXT NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "is_eligible" BOOLEAN NOT NULL DEFAULT true,
    "days_allowed" INTEGER NOT NULL DEFAULT 0,
    "leave_balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "employee_leave_eligibilities_pkey" PRIMARY KEY ("employee_id", "leave_type_id"),
    CONSTRAINT "employee_leave_eligibilities_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_leave_eligibilities_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "employee_leave_eligibilities_leave_type_id_idx" ON "employee_leave_eligibilities"("leave_type_id");

INSERT INTO "employees" ("employee_id", "name", "stream", "department") VALUES
    ('EMP-001', 'Anandh', 'SFS', 'Computer Science'),
    ('EMP-002', 'Arjun', 'AIDED', 'Commerce'),
    ('EMP-003', 'Diya Menon', 'SFS', 'English'),
    ('EMP-004', 'cenkatesh', 'AIDED', 'Mathematics'),
    ('EMP-005', 'Kavya', 'SFS', 'Physics'),
    ('EMP-006', 'Rohan Das', 'AIDED', 'Computer Science'),
    ('EMP-007', 'Sneha Thomas', 'SFS', 'Commerce'),
    ('EMP-008', 'Vikram', 'AIDED', 'English');

INSERT INTO "employee_leave_eligibilities" ("employee_id", "leave_type_id", "is_eligible", "days_allowed", "leave_balance")
SELECT
    "employees"."employee_id",
    "leave_types"."id",
    UPPER("leave_types"."status") = 'ACTIVE',
    CASE WHEN UPPER("leave_types"."status") = 'ACTIVE' THEN "leave_types"."days_allowed" ELSE 0 END,
    0
FROM "employees"
CROSS JOIN "leave_types";