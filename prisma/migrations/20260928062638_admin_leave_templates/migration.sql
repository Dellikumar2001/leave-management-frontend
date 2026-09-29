/*
  Warnings:

  - You are about to drop the `Department` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExtensionActivityPosition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Student` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentLeaveRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "LeaveCategory" AS ENUM ('ANNUAL', 'MEDICAL', 'CASUAL', 'EMERGENCY', 'SPECIAL');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmployeeCategory" AS ENUM ('STUDENT', 'TEACHING_STAFF', 'NON_TEACHING_STAFF');

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_headId_fkey";

-- DropForeignKey
ALTER TABLE "ExtensionActivityPosition" DROP CONSTRAINT "ExtensionActivityPosition_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_userId_fkey";

-- DropForeignKey
ALTER TABLE "StudentLeaveRequest" DROP CONSTRAINT "StudentLeaveRequest_reviewedBy_fkey";

-- DropForeignKey
ALTER TABLE "StudentLeaveRequest" DROP CONSTRAINT "StudentLeaveRequest_studentId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_departmentId_fkey";

-- DropTable
DROP TABLE "Department";

-- DropTable
DROP TABLE "ExtensionActivityPosition";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "Student";

-- DropTable
DROP TABLE "StudentLeaveRequest";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "LeaveRequestStatus";

-- DropEnum
DROP TYPE "LeaveRequestType";

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "LeaveCategory" NOT NULL,
    "days" INTEGER NOT NULL,
    "description" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'ACTIVE',
    "applicableTo" "EmployeeCategory"[] DEFAULT ARRAY['STUDENT']::"EmployeeCategory"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "LeaveGroupItem" (
    "id" SERIAL NOT NULL,
    "leaveGroupId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveGroupItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveGroup_code_key" ON "LeaveGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveGroupItem_leaveGroupId_leaveTypeId_key" ON "LeaveGroupItem"("leaveGroupId", "leaveTypeId");

-- AddForeignKey
ALTER TABLE "LeaveGroupItem" ADD CONSTRAINT "LeaveGroupItem_leaveGroupId_fkey" FOREIGN KEY ("leaveGroupId") REFERENCES "LeaveGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveGroupItem" ADD CONSTRAINT "LeaveGroupItem_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
