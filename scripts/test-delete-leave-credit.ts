import { prisma } from "../lib/prisma";
import {
  executeAnnualLeaveCredit,
  deleteLeaveCredit,
  updateLeaveCredit,
  LeaveCreditNotFoundError,
  LeaveCreditConsumptionError,
} from "../lib/annual-leave-credit";

async function runTests() {
  console.log("==================================================================");
  console.log("  RUNNING COMPREHENSIVE LEAVE CREDIT DELETION & ROLLBACK TEST SUITE");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  }

  const testYear = 2031;
  const testCycle = `${testYear}-${testYear + 1}`;

  // 1. Pick or setup an employee
  const emp = await prisma.employee.findFirst({
    where: { status: "Approved" },
    select: { employeeId: true, name: true, stream: true, department: true },
  });

  if (!emp) {
    throw new Error("No approved employee found for testing.");
  }

  console.log(`Using test employee: ${emp.name} (${emp.employeeId}), Stream: ${emp.stream}`);

  // Clean up any test records for testYear
  await prisma.leaveCredit.deleteMany({
    where: { employeeId: emp.employeeId, year: testYear },
  });
  await prisma.entitlement.deleteMany({
    where: { userId: emp.employeeId, year: testYear },
  });

  // Ensure known baseline balance
  await prisma.employeeLeaveBalance.upsert({
    where: { employeeId_category: { employeeId: emp.employeeId, category: "ANNUAL" } },
    create: { employeeId: emp.employeeId, category: "ANNUAL", balance: 20 },
    update: { balance: 20 },
  });

  // -------------------------------------------------------------
  // Test 1: Credit Annual Leave to employee
  // -------------------------------------------------------------
  console.log("\n[Test 1] Crediting 7 days of annual leave...");
  const creditResult = await executeAnnualLeaveCredit({
    employee_ids: [emp.employeeId],
    category: "ANNUAL",
    days: 7,
    year: testYear,
    cycle: testCycle,
    performedBy: "Test Suite",
    allowDuplicate: true,
  });

  assert(creditResult.success && creditResult.creditedCount === 1, "Credit execution succeeded");

  // Verify credit record created
  const creditRecord = await prisma.leaveCredit.findFirst({
    where: { employeeId: emp.employeeId, year: testYear, days: 7 },
    orderBy: { id: "desc" },
  });

  assert(Boolean(creditRecord), `LeaveCredit row created with ID #${creditRecord?.id}`);
  assert(creditRecord?.days === 7, "LeaveCredit days is 7");

  // Verify employeeLeaveBalance was incremented: 20 + 7 = 27
  const balAfterCredit = await prisma.employeeLeaveBalance.findUnique({
    where: { employeeId_category: { employeeId: emp.employeeId, category: "ANNUAL" } },
  });
  assert(balAfterCredit?.balance === 27, `Category balance incremented to 27 (actual: ${balAfterCredit?.balance})`);

  // Verify Entitlement table was updated
  const entAfterCredit = await prisma.entitlement.findUnique({
    where: { userId_year: { userId: emp.employeeId, year: testYear } },
  });
  const entDataAfterCredit = (entAfterCredit?.entitlementData as any) || {};
  const leaveCode = creditResult.creditedEmployees[0]?.leaveTypeCode || "CL_S";
  const balObjAfterCredit = entDataAfterCredit.balances?.[leaveCode] || entDataAfterCredit[leaveCode];

  assert(Boolean(entAfterCredit), "Entitlement record created for test year");
  assert(balObjAfterCredit?.credited === 7, `Entitlement credited days is 7 (actual: ${balObjAfterCredit?.credited})`);
  const initialEntTotal = balObjAfterCredit?.total;
  console.log(`  ℹ️ Initial entitlement total after 7-day credit: ${initialEntTotal}`);

  // -------------------------------------------------------------
  // Test 2: Validation Guardrail - Reject deletion if balance already consumed
  // -------------------------------------------------------------
  console.log("\n[Test 2] Testing Guardrail: Deletion rejection when balance is consumed...");
  // Simulate employee consuming leaves so available balance drops to 3 days (less than the 7 days credit)
  await prisma.employeeLeaveBalance.update({
    where: { employeeId_category: { employeeId: emp.employeeId, category: "ANNUAL" } },
    data: { balance: 3 },
  });

  let guardrailTriggered = false;
  let guardrailMessage = "";
  try {
    if (creditRecord) {
      await deleteLeaveCredit(creditRecord.id, "Test Admin");
    }
  } catch (err) {
    if (err instanceof LeaveCreditConsumptionError) {
      guardrailTriggered = true;
      guardrailMessage = err.message;
    } else {
      console.error("Unexpected error type:", err);
    }
  }

  assert(guardrailTriggered, "LeaveCreditConsumptionError was thrown");
  assert(
    guardrailMessage.includes("already consumed") || guardrailMessage.includes("balance is 3"),
    `Guardrail message is descriptive: "${guardrailMessage}"`
  );

  // Verify credit record was NOT deleted
  const creditStillExists = await prisma.leaveCredit.findUnique({
    where: { id: creditRecord!.id },
  });
  assert(Boolean(creditStillExists), "LeaveCredit record remained intact after rejected deletion");

  // -------------------------------------------------------------
  // Test 3: Successful Deletion & Full State Rollback
  // -------------------------------------------------------------
  console.log("\n[Test 3] Testing Successful Deletion & Full State Rollback...");
  // Restore available balance to 27 so deletion is permitted
  await prisma.employeeLeaveBalance.update({
    where: { employeeId_category: { employeeId: emp.employeeId, category: "ANNUAL" } },
    data: { balance: 27 },
  });

  const deleteResult = await deleteLeaveCredit(creditRecord!.id, "Super Admin");

  assert(deleteResult.success, "deleteLeaveCredit returned success: true");
  assert(deleteResult.revertedDays === 7, "revertedDays is 7");
  assert(deleteResult.remainingCategoryBalance === 20, `Remaining category balance rolled back to 20 (actual: ${deleteResult.remainingCategoryBalance})`);

  // Verify LeaveCredit row was removed
  const creditDeleted = await prisma.leaveCredit.findUnique({
    where: { id: creditRecord!.id },
  });
  assert(creditDeleted === null, "LeaveCredit record deleted from database");

  // Verify employeeLeaveBalance was decremented back to 20
  const balAfterDelete = await prisma.employeeLeaveBalance.findUnique({
    where: { employeeId_category: { employeeId: emp.employeeId, category: "ANNUAL" } },
  });
  assert(balAfterDelete?.balance === 20, `Category balance decremented to 20 (actual: ${balAfterDelete?.balance})`);

  // Verify Entitlement table was rolled back
  const entAfterDelete = await prisma.entitlement.findUnique({
    where: { userId_year: { userId: emp.employeeId, year: testYear } },
  });
  const entDataAfterDelete = (entAfterDelete?.entitlementData as any) || {};
  const balObjAfterDelete = entDataAfterDelete.balances?.[leaveCode] || entDataAfterDelete[leaveCode];

  assert(balObjAfterDelete?.credited === 0, `Entitlement credited days rolled back to 0 (actual: ${balObjAfterDelete?.credited})`);
  assert(
    balObjAfterDelete?.total === (initialEntTotal - 7),
    `Entitlement total rolled back by 7 days from ${initialEntTotal} to ${initialEntTotal - 7} (actual: ${balObjAfterDelete?.total})`
  );

  // Verify Audit log was created with action REVERSAL
  const auditLog = await prisma.leaveCreditAudit.findFirst({
    where: {
      employeeId: emp.employeeId,
      year: testYear,
      action: "REVERSAL",
    },
    orderBy: { id: "desc" },
  });
  assert(Boolean(auditLog), "Audit log recorded with action 'REVERSAL'");
  assert(auditLog?.performedBy === "Super Admin", `Audit performedBy is 'Super Admin' (actual: ${auditLog?.performedBy})`);
  assert((auditLog?.metadata as any)?.reversedDays === 7, "Audit metadata recorded reversedDays: 7");

  // Verify Notification created for employee
  const notification = await prisma.employeeNotification.findFirst({
    where: {
      employeeId: emp.employeeId,
      type: "LEAVE_CREDIT_REVERSED",
    },
    orderBy: { id: "desc" },
  });
  assert(Boolean(notification), "Notification created with type 'LEAVE_CREDIT_REVERSED'");
  assert(Boolean(notification?.content.includes("7 days")), "Notification specifies 7 days revoked");

  // -------------------------------------------------------------
  // Test 4: 404 Not Found for non-existent credit ID
  // -------------------------------------------------------------
  console.log("\n[Test 4] Testing 404 Not Found for non-existent credit ID...");
  let notFoundTriggered = false;
  try {
    await deleteLeaveCredit(99999999, "Admin");
  } catch (err) {
    if (err instanceof LeaveCreditNotFoundError) {
      notFoundTriggered = true;
    }
  }
  assert(notFoundTriggered, "LeaveCreditNotFoundError correctly thrown for non-existent credit ID");

  // -------------------------------------------------------------
  // Test 5: Safe credit reduction via updateLeaveCredit
  // -------------------------------------------------------------
  console.log("\n[Test 5] Testing safe credit update/reduction...");
  // Create another credit of 10 days
  const credit2 = await prisma.leaveCredit.create({
    data: {
      employeeId: emp.employeeId,
      category: "ANNUAL",
      days: 10,
      stream: emp.stream,
      department: emp.department,
      year: testYear,
      cycle: testCycle,
    },
  });

  // Update credit from 10 days down to 6 days (delta = -4)
  const updateResult = await updateLeaveCredit(credit2.id, 6, "Admin User");
  assert(updateResult.success, "updateLeaveCredit succeeded");
  assert(updateResult.delta === -4, "Delta correctly calculated as -4");

  const updatedCreditRecord = await prisma.leaveCredit.findUnique({
    where: { id: credit2.id },
  });
  assert(updatedCreditRecord?.days === 6, `LeaveCredit days updated to 6 (actual: ${updatedCreditRecord?.days})`);

  // Clean up test records
  await deleteLeaveCredit(credit2.id, "Cleanup Admin");

  console.log("\n==================================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
