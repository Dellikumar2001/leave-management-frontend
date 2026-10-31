import { prisma } from "../lib/prisma";
import { executeAnnualLeaveCredit, resolveEmployeePolicyLeaveType } from "../lib/annual-leave-credit";

async function runTests() {
  console.log("===============================================================================");
  console.log(" RUNNING ANNUAL LEAVE CREDIT TEST SUITE");
  console.log("===============================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (details) console.error(`         Reason: ${details}`);
      process.exitCode = 1;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Unit Test: Policy Leave Type Resolution per Stream
    // -------------------------------------------------------------------------
    console.log("--- UNIT TEST: Stream-Specific Leave Type Policy Resolution ---");

    const leaveTypes = await prisma.leaveType.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, code: true, name: true, leaveGroup: true, category: true, daysAllowed: true },
    });

    const aidedEmp = { employeeId: "EMP-002", stream: "AIDED", department: "Commerce" };
    const sfsEmp = { employeeId: "EMP-001", stream: "SFS", department: "Computer Science" };

    const resolvedAided = resolveEmployeePolicyLeaveType(aidedEmp, "ANNUAL", leaveTypes);
    const resolvedSfs = resolveEmployeePolicyLeaveType(sfsEmp, "ANNUAL", leaveTypes);

    assert(
      resolvedAided !== null && (resolvedAided.code === "CL_A" || resolvedAided.code.endsWith("_A")),
      "AIDED employee resolves to CL_A leave type policy",
      `Expected code ending with _A, got: ${resolvedAided?.code}`
    );

    assert(
      resolvedSfs !== null && (resolvedSfs.code === "CL_S" || resolvedSfs.code.endsWith("_S")),
      "SFS employee resolves to CL_S leave type policy",
      `Expected code ending with _S, got: ${resolvedSfs?.code}`
    );

    // -------------------------------------------------------------------------
    // Integration Test 1: Crediting Leaves Exclusively to "AIDED" Employees
    // -------------------------------------------------------------------------
    console.log("\n--- TEST CASE 1: Crediting Leaves Exclusively to 'AIDED' Employees ---");

    const TEST_YEAR_1 = 2028; // Unique test year to guarantee isolated assertions
    const resultAided = await executeAnnualLeaveCredit({
      streams: ["AIDED"],
      departments: "ALL",
      category: "ANNUAL",
      days: 6,
      year: TEST_YEAR_1,
      cycle: `${TEST_YEAR_1}-${TEST_YEAR_1 + 1}`,
      performedBy: "TestRunner-Case1",
      allowDuplicate: true,
    });

    assert(resultAided.success === true, "Execution succeeded");
    assert(resultAided.creditedCount > 0, `Credited employees count > 0 (found ${resultAided.creditedCount})`);
    
    // Verify all credited employees belong to AIDED stream
    const nonAidedInResult = resultAided.creditedEmployees.filter((e) => e.stream.toUpperCase() !== "AIDED");
    assert(
      nonAidedInResult.length === 0,
      "Zero SFS or non-Aided employees were credited",
      `Found unexpected non-Aided employees: ${nonAidedInResult.map((e) => `${e.employeeId}(${e.stream})`).join(", ")}`
    );

    // Verify stream-specific leave type was applied (CL_A)
    const allAppliedClA = resultAided.creditedEmployees.every(
      (e) => e.leaveTypeCode === "CL_A" || e.leaveTypeCode.endsWith("_A")
    );
    assert(allAppliedClA, "All credited AIDED employees received stream-specific CL_A entitlement");

    // Verify database records: LeaveCredit and LeaveCreditAudit
    const creditRecordsCase1 = await prisma.leaveCredit.findMany({
      where: { year: TEST_YEAR_1, category: "ANNUAL" },
    });
    assert(
      creditRecordsCase1.length === resultAided.creditedCount,
      "LeaveCredit database rows match credited count"
    );
    assert(
      creditRecordsCase1.every((c) => c.stream?.toUpperCase() === "AIDED" && c.days === 6),
      "LeaveCredit database rows record stream = 'AIDED' and days = 6"
    );

    const auditRecordsCase1 = await prisma.leaveCreditAudit.findMany({
      where: { year: TEST_YEAR_1, category: "ANNUAL", performedBy: "TestRunner-Case1" },
    });
    assert(
      auditRecordsCase1.length === resultAided.creditedCount,
      "LeaveCreditAudit ledger entries recorded with stream and department context"
    );
    assert(
      auditRecordsCase1.every((a) => a.action === "CREDIT" && a.stream.toUpperCase() === "AIDED"),
      "Audit logs record action = 'CREDIT' and stream = 'AIDED'"
    );

    // -------------------------------------------------------------------------
    // Integration Test 2: Crediting Leaves Across Mixed Streams ("SFS" + "AIDED")
    // Across Multiple Departments Simultaneously
    // -------------------------------------------------------------------------
    console.log("\n--- TEST CASE 2: Mixed Streams ('SFS' + 'AIDED') Across Multiple Departments ---");

    const TEST_YEAR_2 = 2029;
    const targetDepartments = ["Computer Science", "Commerce"];

    const resultMixed = await executeAnnualLeaveCredit({
      streams: ["SFS", "AIDED"],
      departments: targetDepartments,
      category: "ANNUAL",
      days: 8,
      year: TEST_YEAR_2,
      cycle: `${TEST_YEAR_2}-${TEST_YEAR_2 + 1}`,
      performedBy: "TestRunner-Case2",
      allowDuplicate: true,
    });

    assert(resultMixed.success === true, "Execution succeeded");
    assert(resultMixed.creditedCount > 0, `Credited employees count > 0 (found ${resultMixed.creditedCount})`);

    const creditedStreams = Array.from(new Set(resultMixed.creditedEmployees.map((e) => e.stream.toUpperCase())));
    assert(
      creditedStreams.includes("SFS") && creditedStreams.includes("AIDED"),
      "Both 'SFS' and 'AIDED' streams are present in credited employees",
      `Actual streams: ${creditedStreams.join(", ")}`
    );

    const creditedDepts = Array.from(new Set(resultMixed.creditedEmployees.map((e) => e.department)));
    const invalidDepts = creditedDepts.filter((d) => !targetDepartments.includes(d));
    assert(
      invalidDepts.length === 0,
      "Only targeted departments ('Computer Science', 'Commerce') were processed",
      `Unexpected departments: ${invalidDepts.join(", ")}`
    );

    // Verify policy resolution per stream in the mixed batch:
    // SFS employees should get CL_S; AIDED employees should get CL_A
    const sfsEmployees = resultMixed.creditedEmployees.filter((e) => e.stream.toUpperCase() === "SFS");
    const aidedEmployees = resultMixed.creditedEmployees.filter((e) => e.stream.toUpperCase() === "AIDED");

    assert(
      sfsEmployees.length > 0 && sfsEmployees.every((e) => e.leaveTypeCode === "CL_S" || e.leaveTypeCode.endsWith("_S")),
      "Mixed batch correctly assigned SFS leave type policy (CL_S) to SFS employees"
    );
    assert(
      aidedEmployees.length > 0 && aidedEmployees.every((e) => e.leaveTypeCode === "CL_A" || e.leaveTypeCode.endsWith("_A")),
      "Mixed batch correctly assigned AIDED leave type policy (CL_A) to AIDED employees"
    );

    // Check audit ledger for mixed batch
    const auditRecordsCase2 = await prisma.leaveCreditAudit.findMany({
      where: { year: TEST_YEAR_2, performedBy: "TestRunner-Case2" },
    });
    assert(
      auditRecordsCase2.length === resultMixed.creditedCount,
      "LeaveCreditAudit entries match credited count for mixed streams batch"
    );

    // -------------------------------------------------------------------------
    // Test Case 3: Deduplication Protection
    // -------------------------------------------------------------------------
    console.log("\n--- TEST CASE 3: Deduplication Protection (Prevent duplicate credits on rerun) ---");

    const rerunResult = await executeAnnualLeaveCredit({
      streams: ["AIDED"],
      departments: "ALL",
      category: "ANNUAL",
      days: 6,
      year: TEST_YEAR_1,
      cycle: `${TEST_YEAR_1}-${TEST_YEAR_1 + 1}`,
      allowDuplicate: false, // Default protection
    });

    assert(
      rerunResult.creditedCount === 0,
      "Rerunning the routine with allowDuplicate: false credits 0 new leaves"
    );
    assert(
      rerunResult.skippedCount > 0,
      `All previously credited employees were skipped (skipped: ${rerunResult.skippedCount})`
    );

    // -------------------------------------------------------------------------
    // Test Case 4: Boundary Validation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST CASE 4: Boundary & Error Handling ---");

    let boundaryPassed = false;
    try {
      await executeAnnualLeaveCredit({
        streams: ["NON_EXISTENT_STREAM"],
        departments: "ALL",
        category: "ANNUAL",
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("No active employees found")) {
        boundaryPassed = true;
      }
    }
    assert(boundaryPassed, "Handles non-existent stream criteria cleanly with informative error");

    // -------------------------------------------------------------------------
    // Test Case 5: Synchronization & Calculation Integrity with Year-End Process
    // -------------------------------------------------------------------------
    console.log("\n--- TEST CASE 5: Entitlements <-> Year-End Process Data Sync & Denominator Calculation ---");

    const TEST_YEAR_SYNC = 2030;
    const testUserId = "EMP-002";
    const leaveCode = "CL_A";

    // Setup: Create pre-existing Entitlement for Year 2030 with taken = 3, eligible = 10, bf = 2, total = 9
    await prisma.entitlement.upsert({
      where: { userId_year: { userId: testUserId, year: TEST_YEAR_SYNC } },
      create: {
        userId: testUserId,
        year: TEST_YEAR_SYNC,
        entitlementData: {
          [leaveCode]: {
            eligible: 10,
            bf: 2,
            credited: 0,
            taken: 3,
            total: 9, // (10 + 2 + 0) - 3 = 9
          },
          formatted_columns: {
            [leaveCode]: "3 / 9",
          },
        },
      },
      update: {
        entitlementData: {
          [leaveCode]: {
            eligible: 10,
            bf: 2,
            credited: 0,
            taken: 3,
            total: 9,
          },
          formatted_columns: {
            [leaveCode]: "3 / 9",
          },
        },
      },
    });

    // Setup: Create matching YearEndProcess and YearEndProcessDetail with existing snapshot
    const testProcess = await prisma.yearEndProcess.create({
      data: {
        fromYear: TEST_YEAR_SYNC - 1,
        toYear: TEST_YEAR_SYNC,
        processedBy: "TestRunner-SyncTest",
        status: "COMPLETED",
        totalUsers: 1,
      },
    });

    const testDetail = await prisma.yearEndProcessDetail.create({
      data: {
        processId: testProcess.id,
        userId: testUserId,
        fromYear: TEST_YEAR_SYNC - 1,
        toYear: TEST_YEAR_SYNC,
        snapshotBefore: {},
        snapshotAfter: {
          [leaveCode]: "3 / 9", // Old taken / total string
          leave_type_columns: {
            [leaveCode]: "3 / 9",
          },
        },
        carryForwardSummary: {},
        status: "COMMITTED",
      },
    });

    // ACTION: Credit 5 additional days of Annual Leave
    const CREDIT_DAYS = 5;
    const syncCreditResult = await executeAnnualLeaveCredit({
      employee_ids: [testUserId],
      category: "ANNUAL",
      days: CREDIT_DAYS,
      year: TEST_YEAR_SYNC,
      cycle: `${TEST_YEAR_SYNC}-${TEST_YEAR_SYNC + 1}`,
      allowDuplicate: true,
      performedBy: "TestRunner-SyncAction",
    });

    assert(syncCreditResult.success === true, "Credit leave execution succeeded for sync test");

    // VERIFICATION 1: Entitlement table updated accurately without improper compounding
    const updatedEntitlement = await prisma.entitlement.findUnique({
      where: { userId_year: { userId: testUserId, year: TEST_YEAR_SYNC } },
    });
    const entData = updatedEntitlement?.entitlementData as Record<string, any>;
    const leaveBal = entData?.[leaveCode];

    // Expected: eligible (10) + bf (2) + credited (5) - taken (3) = 14
    const EXPECTED_NEW_TOTAL = (10 + 2 + CREDIT_DAYS) - 3; // 14
    assert(
      leaveBal?.credited === CREDIT_DAYS,
      `Entitlements credited days updated to ${CREDIT_DAYS}`,
      `Actual: ${leaveBal?.credited}`
    );
    assert(
      leaveBal?.total === EXPECTED_NEW_TOTAL,
      `Entitlements total recalculated to true balance (${EXPECTED_NEW_TOTAL}) without inflating`,
      `Actual: ${leaveBal?.total}, Expected: ${EXPECTED_NEW_TOTAL}`
    );

    // VERIFICATION 2: YearEndProcessDetail snapshotAfter updated to 'taken / current_year_entitlement_total'
    const updatedDetail = await prisma.yearEndProcessDetail.findUnique({
      where: { id: testDetail.id },
    });
    const updatedSnapshot = updatedDetail?.snapshotAfter as Record<string, any>;
    const updatedColString = updatedSnapshot?.[leaveCode] || updatedSnapshot?.leave_type_columns?.[leaveCode];

    const EXPECTED_FORMATTED = `3 / ${EXPECTED_NEW_TOTAL}`; // "3 / 14"
    assert(
      updatedColString === EXPECTED_FORMATTED,
      `YearEndProcessDetail formatted as taken / total matches '${EXPECTED_FORMATTED}'`,
      `Actual: '${updatedColString}', Expected: '${EXPECTED_FORMATTED}'`
    );

    // VERIFICATION 3: Preserved existing 'taken' count and denominator matches entitlement total
    const [parsedTakenStr, parsedTotalStr] = (updatedColString || "").split("/").map((s: string) => s.trim());
    assert(
      parsedTakenStr === "3",
      "Existing taken count (3) safely preserved in formatted string",
      `Actual parsed taken: '${parsedTakenStr}'`
    );
    assert(
      Number(parsedTotalStr) === leaveBal?.total,
      "Denominator in year_end_process matches entitlements.total exactly",
      `Denominator: ${parsedTotalStr}, Entitlement Total: ${leaveBal?.total}`
    );

    // Clean up test records
    console.log("\n--- Cleaning up test records ---");
    await prisma.leaveCreditAudit.deleteMany({
      where: { year: { in: [TEST_YEAR_1, TEST_YEAR_2, TEST_YEAR_SYNC] } },
    });
    await prisma.leaveCredit.deleteMany({
      where: { year: { in: [TEST_YEAR_1, TEST_YEAR_2, TEST_YEAR_SYNC] } },
    });
    await prisma.yearEndProcessDetail.deleteMany({
      where: { id: testDetail.id },
    });
    await prisma.yearEndProcess.deleteMany({
      where: { id: testProcess.id },
    });
    await prisma.entitlement.deleteMany({
      where: { year: TEST_YEAR_SYNC },
    });
    console.log("Cleaned up test data.");

    console.log("\n===============================================================================");
    console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log("===============================================================================");
  } catch (error) {
    console.error("Test execution failed with unexpected error:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void runTests();
