-- Keep the existing student/request tables and use the application's leave_types table.
CREATE TYPE "LeaveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "LeaveGroup" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveGroupItem" (
    "id" SERIAL NOT NULL,
    "leaveGroupId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveGroupItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveGroup_code_key" ON "LeaveGroup"("code");
CREATE UNIQUE INDEX "LeaveGroupItem_leaveGroupId_leaveTypeId_key" ON "LeaveGroupItem"("leaveGroupId", "leaveTypeId");

ALTER TABLE "LeaveGroupItem"
    ADD CONSTRAINT "LeaveGroupItem_leaveGroupId_fkey"
    FOREIGN KEY ("leaveGroupId") REFERENCES "LeaveGroup"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveGroupItem"
    ADD CONSTRAINT "LeaveGroupItem_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "leave_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
