CREATE TABLE "maternity_leaves" (
    "employee_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "no_of_days" INTEGER NOT NULL,
    "remarks" TEXT NOT NULL,

    CONSTRAINT "maternity_leaves_pkey" PRIMARY KEY ("employee_id"),
    CONSTRAINT "maternity_leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE
);