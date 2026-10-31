import type { LeaveCategory, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface AnnualLeaveCreditCriteria {
  streams?: string[] | string;
  departments?: string[] | string;
  employee_ids?: string[];
  employeeIds?: string[];
  category?: "ANNUAL" | "MEDICAL";
  days?: number;
  year?: number;
  cycle?: string;
  performedBy?: string;
  allowDuplicate?: boolean;
}

export interface CreditResultSummary {
  success: boolean;
  creditedCount: number;
  skippedCount: number;
  year: number;
  cycle: string;
  category: LeaveCategory;
  creditedEmployees: Array<{
    employeeId: string;
    name: string;
    stream: string;
    department: string;
    leaveTypeCode: string;
    creditedDays: number;
  }>;
  skippedEmployees: Array<{
    employeeId: string;
    name: string;
    stream: string;
    department: string;
    reason: string;
  }>;
  warnings?: string[];
}

/**
 * Normalizes filter arguments: turns "ALL" / "all" or empty arrays into null (meaning match all)
 */
function normalizeFilterList(input: string[] | string | undefined): string[] | null {
  if (!input) return null;
  if (typeof input === "string") {
    if (input.trim().toUpperCase() === "ALL" || input.trim() === "") return null;
    return [input.trim()];
  }
  if (Array.isArray(input)) {
    const cleaned = input
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter((s) => s.length > 0 && s.toUpperCase() !== "ALL");
    return cleaned.length > 0 ? cleaned : null;
  }
  return null;
}

/**
 * Resolves the stream-specific or department-specific LeaveType for an employee.
 * E.g., for AIDED stream: prefer CL_A (or leaveGroup containing AIDED)
 *       for SFS stream: prefer CL_S (or leaveGroup containing SFS)
 */
export function resolveEmployeePolicyLeaveType(
  employee: { employeeId: string; stream: string; department: string },
  category: LeaveCategory,
  activeLeaveTypes: Array<{
    id: number;
    code: string;
    name: string;
    leaveGroup: string;
    category: LeaveCategory | null;
    daysAllowed: number;
  }>
) {
  const streamUpper = (employee.stream || "").trim().toUpperCase();

  if (category === "ANNUAL") {
    // 1. First look for stream-specific Casual/Annual Leave
    if (streamUpper === "AIDED") {
      const aidedType = activeLeaveTypes.find(
        (lt) =>
          (lt.code.toUpperCase() === "CL_A" ||
            lt.code.toUpperCase().endsWith("_A") ||
            lt.code.toUpperCase().includes("AIDED") ||
            lt.leaveGroup.toUpperCase().includes("AIDED")) &&
          (lt.code.toUpperCase().startsWith("CL") || lt.name.toUpperCase().includes("CASUAL"))
      );
      if (aidedType) return aidedType;
    } else if (streamUpper === "SFS") {
      const sfsType = activeLeaveTypes.find(
        (lt) =>
          (lt.code.toUpperCase() === "CL_S" ||
            lt.code.toUpperCase().endsWith("_S") ||
            lt.code.toUpperCase().includes("SFS") ||
            lt.leaveGroup.toUpperCase().includes("SFS")) &&
          (lt.code.toUpperCase().startsWith("CL") || lt.name.toUpperCase().includes("CASUAL"))
      );
      if (sfsType) return sfsType;
    }

    // 2. Generic CL or Casual Leave
    const genericCl = activeLeaveTypes.find(
      (lt) => lt.code.toUpperCase() === "CL" || lt.name.toUpperCase().includes("CASUAL")
    );
    if (genericCl) return genericCl;

    // 3. Any type marked with category ANNUAL
    const annualType = activeLeaveTypes.find((lt) => lt.category === "ANNUAL");
    if (annualType) return annualType;
  } else if (category === "MEDICAL") {
    if (streamUpper === "AIDED") {
      const aidedMedical = activeLeaveTypes.find(
        (lt) =>
          (lt.code.toUpperCase() === "MDL" ||
            lt.code.toUpperCase() === "ML_A" ||
            lt.code.toUpperCase().endsWith("_A") ||
            lt.leaveGroup.toUpperCase().includes("AIDED")) &&
          (lt.name.toUpperCase().includes("MEDICAL") || lt.code.toUpperCase().startsWith("ML")) &&
          !lt.name.toUpperCase().includes("MATERNITY")
      );
      if (aidedMedical) return aidedMedical;
    } else if (streamUpper === "SFS") {
      const sfsMedical = activeLeaveTypes.find(
        (lt) =>
          (lt.code.toUpperCase() === "ML_S" ||
            lt.code.toUpperCase() === "SL_S" ||
            lt.code.toUpperCase().endsWith("_S") ||
            lt.leaveGroup.toUpperCase().includes("SFS")) &&
          (lt.name.toUpperCase().includes("MEDICAL") ||
            lt.name.toUpperCase().includes("SICK") ||
            lt.code.toUpperCase().startsWith("ML") ||
            lt.code.toUpperCase().startsWith("SL")) &&
          !lt.name.toUpperCase().includes("MATERNITY")
      );
      if (sfsMedical) return sfsMedical;
    }

    const genericMl = activeLeaveTypes.find(
      (lt) =>
        (lt.code.toUpperCase() === "ML" ||
          lt.name.toUpperCase() === "MEDICAL LEAVE" ||
          lt.name.toUpperCase().includes("MEDICAL")) &&
        !lt.name.toUpperCase().includes("MATERNITY")
    );
    if (genericMl) return genericMl;
  }

  // Fallback to first available active leave type
  return activeLeaveTypes[0] ?? null;
}

/**
 * Adjusts employee leave balances and eligibility atomically.
 */
async function applyCreditedDays(
  tx: Prisma.TransactionClient,
  employeeId: string,
  leaveTypeId: number | null,
  category: LeaveCategory,
  delta: number
) {
  if (delta === 0) return;

  // 1. Update overall category balance
  if (delta < 0) {
    const updated = await tx.employeeLeaveBalance.updateMany({
      where: { employeeId, category, balance: { gte: -delta } },
      data: { balance: { increment: delta } },
    });
    if (!updated.count) {
      throw new Error(
        `Credit reversal rejected: Employee ${employeeId} has already consumed their available balance.`
      );
    }
  } else {
    await tx.employeeLeaveBalance.upsert({
      where: { employeeId_category: { employeeId, category } },
      create: { employeeId, category, balance: delta },
      update: { balance: { increment: delta } },
    });
  }

  // 2. Update eligibility record for the specific leave type
  if (leaveTypeId !== null) {
    const eligibility = await tx.employeeLeaveEligibility.findUnique({
      where: { employeeId_leaveTypeId: { employeeId, leaveTypeId } },
      select: { daysAllowed: true, creditedDays: true, isEligible: true, leaveBalance: true },
    });

    if (eligibility) {
      const newCreditedDays = Math.max(0, eligibility.creditedDays + delta);
      await tx.employeeLeaveEligibility.update({
        where: { employeeId_leaveTypeId: { employeeId, leaveTypeId } },
        data: {
          isEligible: true,
          creditedDays: newCreditedDays,
          leaveBalance: { increment: delta },
        },
      });
    } else {
      if (delta < 0) {
        throw new Error(`Cannot reverse leave for employee ${employeeId}: No eligibility record found.`);
      }
      const leaveTypeRecord = await tx.leaveType.findUnique({
        where: { id: leaveTypeId },
        select: { daysAllowed: true },
      });
      const baseDays = leaveTypeRecord?.daysAllowed ?? 10;
      await tx.employeeLeaveEligibility.create({
        data: {
          employeeId,
          leaveTypeId,
          isEligible: true,
          daysAllowed: baseDays,
          creditedDays: delta,
          leaveBalance: delta,
        },
      });
    }
  }
}

/**
 * Synchronizes newly credited leave with the entitlements table and year_end_process records
 * inside an atomic database transaction.
 *
 * Updates:
 *  1. entitlements: credited days and recalculated total.
 *  2. year_end_process (details and records): recalculates the leave type column in
 *     'taken / current_year_entitlement_total' format without compounding historical bases.
 */
export async function syncCreditWithYearEndProcess(
  tx: Prisma.TransactionClient,
  params: {
    employeeId: string;
    leaveTypeId: number | null;
    leaveTypeCode?: string;
    category: LeaveCategory;
    daysCredited: number;
    year: number;
    cycle?: string;
  }
): Promise<{
  entitlementTotal: number;
  formattedValue: string;
  taken: number;
  yearEndProcessUpdated: boolean;
}> {
  const { employeeId, leaveTypeId, category, daysCredited, year, cycle } = params;

  // 1. Identify leave type details
  let code = params.leaveTypeCode;
  let daysAllowed = 10;
  if (!code && leaveTypeId) {
    const lt = await tx.leaveType.findUnique({
      where: { id: leaveTypeId },
      select: { code: true, daysAllowed: true },
    });
    code = lt?.code;
    daysAllowed = lt?.daysAllowed ?? 10;
  }
  const leaveCode = code || (category === "ANNUAL" ? "CL" : "ML");

  // 2. Fetch or initialize Entitlement record for (employeeId, year)
  const existingEntitlement = await tx.entitlement.findUnique({
    where: { userId_year: { userId: employeeId, year } },
  });

  let entitlementData: Record<string, any> = {};
  if (
    existingEntitlement &&
    typeof existingEntitlement.entitlementData === "object" &&
    existingEntitlement.entitlementData !== null
  ) {
    entitlementData = { ...(existingEntitlement.entitlementData as Record<string, any>) };
  } else {
    entitlementData = {
      userId: employeeId,
      year,
      status: "ACTIVE",
      lastCalculatedAt: new Date().toISOString(),
      balances: {},
    };
  }

  // Support both shapes: structured .balances[leaveCode] and flat dictionary [leaveCode]
  let currentTaken = 0;
  let currentEligible = daysAllowed;
  let currentBf = 0;
  let currentCredited = 0;

  if (entitlementData.balances && typeof entitlementData.balances === "object") {
    const targetBal = entitlementData.balances[leaveCode] || {};
    currentTaken = Number(targetBal.taken ?? 0);
    currentEligible = Number(targetBal.annualAccrual ?? targetBal.eligible ?? daysAllowed);
    currentBf = Number(targetBal.carriedForward ?? targetBal.bf ?? 0);
    currentCredited = Math.max(0, Number(targetBal.credited ?? 0) + daysCredited);

    // Current year entitlement total = max(0, eligible + carriedForward + credited - taken)
    const newTotal = Math.max(0, currentEligible + currentBf + currentCredited - currentTaken);
    const totalAvailable = Math.max(0, currentEligible + currentBf + currentCredited);

    entitlementData.balances[leaveCode] = {
      ...targetBal,
      code: leaveCode,
      annualAccrual: currentEligible,
      carriedForward: currentBf,
      credited: currentCredited,
      totalAvailable,
      taken: currentTaken,
      total: newTotal,
      remainingBalance: newTotal,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Also maintain flat dictionary mapping
  const flatItem =
    typeof entitlementData[leaveCode] === "object" && entitlementData[leaveCode] !== null
      ? { ...(entitlementData[leaveCode] as Record<string, any>) }
      : {};
  const flatTaken = Number(flatItem.taken ?? currentTaken);
  const flatEligible = Number(flatItem.eligible ?? currentEligible);
  const flatBf = Number(flatItem.bf ?? currentBf);
  const flatCredited = Math.max(0, Number(flatItem.credited ?? (currentCredited - daysCredited)) + daysCredited);
  const flatTotal = Math.max(0, flatEligible + flatBf + flatCredited - flatTaken);

  entitlementData[leaveCode] = {
    ...flatItem,
    eligible: flatEligible,
    bf: flatBf,
    credited: flatCredited,
    taken: flatTaken,
    total: flatTotal,
    updatedAt: new Date().toISOString(),
  };

  const finalEntitlementTotal = flatTotal;
  const takenCount = flatTaken;
  const formattedValue = `${takenCount} / ${finalEntitlementTotal}`;

  if (!entitlementData.formatted_columns) entitlementData.formatted_columns = {};
  entitlementData.formatted_columns[leaveCode] = formattedValue;

  // Persist into entitlements table inside transaction
  await tx.entitlement.upsert({
    where: { userId_year: { userId: employeeId, year } },
    create: {
      userId: employeeId,
      year,
      entitlementData: entitlementData as unknown as Prisma.InputJsonValue,
    },
    update: {
      entitlementData: entitlementData as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });

  // 3. Propagate to year_end_processes & year_end_process_details
  let yearEndProcessUpdated = false;

  const matchingDetails = await tx.yearEndProcessDetail.findMany({
    where: {
      userId: employeeId,
      OR: [{ toYear: year }, { fromYear: year }, { toYear: year + 1 }],
    },
  });

  for (const detail of matchingDetails) {
    if (detail.snapshotAfter && typeof detail.snapshotAfter === "object") {
      const snapAfter = { ...(detail.snapshotAfter as Record<string, any>) };

      // Safe string parsing of existing value if formatted as "taken / total"
      let parsedTaken = takenCount;
      const existingColVal = snapAfter[leaveCode] || snapAfter.leave_type_columns?.[leaveCode];
      if (typeof existingColVal === "string" && existingColVal.includes("/")) {
        const parts = existingColVal.split("/");
        const num = parseInt(parts[0].trim(), 10);
        if (!isNaN(num)) parsedTaken = num;
      }

      if (snapAfter.balances && snapAfter.balances[leaveCode]) {
        parsedTaken = Number(snapAfter.balances[leaveCode].taken ?? parsedTaken);
        const updatedCredited = Math.max(0, (snapAfter.balances[leaveCode].credited ?? 0) + daysCredited);
        const updatedTotalAvail = Math.max(
          0,
          (snapAfter.balances[leaveCode].annualAccrual ?? currentEligible) +
            (snapAfter.balances[leaveCode].carriedForward ?? 0) +
            updatedCredited
        );
        snapAfter.balances[leaveCode] = {
          ...snapAfter.balances[leaveCode],
          credited: updatedCredited,
          totalAvailable: updatedTotalAvail,
          total: finalEntitlementTotal,
          remainingBalance: finalEntitlementTotal,
        };
      }

      const updatedFormatted = `${parsedTaken} / ${finalEntitlementTotal}`;
      if (!snapAfter.leave_type_columns) snapAfter.leave_type_columns = {};
      snapAfter.leave_type_columns[leaveCode] = updatedFormatted;
      snapAfter[leaveCode] = updatedFormatted;

      await tx.yearEndProcessDetail.update({
        where: { id: detail.id },
        data: {
          snapshotAfter: snapAfter as unknown as Prisma.InputJsonValue,
        },
      });
      yearEndProcessUpdated = true;
    }
  }

  // Also update leave_year_end_records (current cycle process records)
  const currentCycleStr = cycle || `${year}-${year + 1}`;
  const matchingRecords = await tx.leaveYearEndRecord.findMany({
    where: {
      employeeId,
      OR: [
        { nextCycle: currentCycleStr },
        { currentCycle: currentCycleStr },
        ...(leaveTypeId ? [{ leaveTypeId }] : []),
      ],
    },
  });

  for (const rec of matchingRecords) {
    const isMatch = !leaveTypeId || rec.leaveTypeId === leaveTypeId || rec.leaveTypeCode === leaveCode;
    if (isMatch) {
      const recTaken = rec.leaveUsed ?? takenCount;
      const recFormatted = `${recTaken} / ${finalEntitlementTotal}`;

      const updatedSnapshot = {
        ...((rec.snapshotAfter as Record<string, any>) || {}),
        formattedValue: recFormatted,
        total: finalEntitlementTotal,
        credited: Math.max(0, Number((rec.snapshotAfter as any)?.credited ?? 0) + daysCredited),
        updatedAt: new Date().toISOString(),
      };

      await tx.leaveYearEndRecord.update({
        where: { id: rec.id },
        data: {
          entitlement: finalEntitlementTotal,
          availableBalance: finalEntitlementTotal,
          snapshotAfter: updatedSnapshot as unknown as Prisma.InputJsonValue,
        },
      });
      yearEndProcessUpdated = true;
    }
  }

  return {
    entitlementTotal: finalEntitlementTotal,
    formattedValue,
    taken: takenCount,
    yearEndProcessUpdated,
  };
}

/**
 * Core Dynamic Annual Leave Crediting Service
 * Supports any stream (AIDED, SFS, etc.), any department, or all.
 */
export async function executeAnnualLeaveCredit(
  criteria: AnnualLeaveCreditCriteria
): Promise<CreditResultSummary> {
  const category: LeaveCategory = criteria.category === "MEDICAL" ? "MEDICAL" : "ANNUAL";
  const currentYear = Number.isSafeInteger(criteria.year)
    ? Number(criteria.year)
    : new Date().getUTCFullYear();
  const currentCycle = criteria.cycle?.trim() || `${currentYear}-${currentYear + 1}`;
  const performedBy = criteria.performedBy?.trim() || "Administrator";
  const allowDuplicate = Boolean(criteria.allowDuplicate);

  const streamsFilter = normalizeFilterList(criteria.streams);
  const departmentsFilter = normalizeFilterList(criteria.departments);
  const rawEmployeeIds = criteria.employee_ids ?? criteria.employeeIds;
  const specificEmployeeIds =
    Array.isArray(rawEmployeeIds) && rawEmployeeIds.length > 0
      ? Array.from(new Set(rawEmployeeIds.map((id) => String(id).trim()).filter(Boolean)))
      : null;

  // 1. Build dynamic employee filter - NEVER hardcodes any stream
  const employeeWhere: Prisma.EmployeeWhereInput = {
    // Only active employees
    status: {
      notIn: ["Inactive", "INACTIVE", "Terminated", "Suspended"],
    },
  };

  if (specificEmployeeIds && specificEmployeeIds.length > 0) {
    employeeWhere.employeeId = { in: specificEmployeeIds };
  }
  if (streamsFilter && streamsFilter.length > 0) {
    employeeWhere.stream = { in: streamsFilter, mode: "insensitive" };
  }
  if (departmentsFilter && departmentsFilter.length > 0) {
    employeeWhere.department = { in: departmentsFilter, mode: "insensitive" };
  }

  // 2. Fetch matching employees and active leave types
  const [matchingEmployees, activeLeaveTypes] = await Promise.all([
    prisma.employee.findMany({
      where: employeeWhere,
      orderBy: [{ stream: "asc" }, { department: "asc" }, { employeeId: "asc" }],
      select: {
        employeeId: true,
        name: true,
        stream: true,
        department: true,
        status: true,
      },
    }),
    prisma.leaveType.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        code: true,
        name: true,
        leaveGroup: true,
        category: true,
        daysAllowed: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  if (matchingEmployees.length === 0) {
    throw new Error(
      "No active employees found matching the chosen criteria " +
        `(Streams: ${streamsFilter ? streamsFilter.join(", ") : "ALL"}, ` +
        `Departments: ${departmentsFilter ? departmentsFilter.join(", ") : "ALL"}).`
    );
  }

  const warnings: string[] = [];
  const creditedEmployees: CreditResultSummary["creditedEmployees"] = [];
  const skippedEmployees: CreditResultSummary["skippedEmployees"] = [];

  const today = new Date(new Date().toISOString().slice(0, 10));

  // 3. Run atomic transaction with audit logging and deduplication
  await prisma.$transaction(
    async (tx) => {
      for (const employee of matchingEmployees) {
        // Boundary validation: Warn if employee has unassigned stream or department
        if (!employee.stream || employee.stream.trim() === "") {
          warnings.push(`Employee ${employee.employeeId} (${employee.name}) has an unassigned stream.`);
        }
        if (!employee.department || employee.department.trim() === "") {
          warnings.push(`Employee ${employee.employeeId} (${employee.name}) has an unassigned department.`);
        }

        // Deduplication check: Prevent duplicate credits for the same year/cycle
        if (!allowDuplicate) {
          const alreadyCredited = await tx.leaveCredit.findFirst({
            where: {
              employeeId: employee.employeeId,
              category,
              OR: [
                { year: currentYear },
                { cycle: currentCycle },
                {
                  createdAt: {
                    gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
                    lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`),
                  },
                },
              ],
            },
          });

          if (alreadyCredited) {
            skippedEmployees.push({
              employeeId: employee.employeeId,
              name: employee.name,
              stream: employee.stream,
              department: employee.department,
              reason: `Already credited ${alreadyCredited.days} days for cycle/year ${alreadyCredited.year || currentYear}.`,
            });
            continue;
          }
        }

        // Resolve stream-specific Leave Type according to policy
        const targetLeaveType = resolveEmployeePolicyLeaveType(employee, category, activeLeaveTypes);
        const targetLeaveTypeId = targetLeaveType?.id ?? null;

        // Resolve days: if explicit days provided > 0 use it; otherwise use stream policy quota
        const daysToCredit =
          criteria.days && criteria.days > 0
            ? criteria.days
            : targetLeaveType?.daysAllowed && targetLeaveType.daysAllowed > 0
            ? targetLeaveType.daysAllowed
            : 10;

        // 3a. Update balances and eligibilities atomically
        await applyCreditedDays(tx, employee.employeeId, targetLeaveTypeId, category, daysToCredit);

        // 3b. Record LeaveCredit record
        await tx.leaveCredit.create({
          data: {
            employeeId: employee.employeeId,
            category,
            days: daysToCredit,
            startDate: today,
            endDate: today,
            leaveTypeId: targetLeaveTypeId,
            stream: employee.stream || "UNASSIGNED",
            department: employee.department || "UNASSIGNED",
            year: currentYear,
            cycle: currentCycle,
          },
        });

        // 3c. Record LeaveCreditAudit record for strict compliance & ledger tracking
        await tx.leaveCreditAudit.create({
          data: {
            employeeId: employee.employeeId,
            stream: employee.stream || "UNASSIGNED",
            department: employee.department || "UNASSIGNED",
            category,
            leaveTypeId: targetLeaveTypeId,
            days: daysToCredit,
            year: currentYear,
            cycle: currentCycle,
            action: "CREDIT",
            performedBy,
            metadata: {
              targetLeaveTypeCode: targetLeaveType?.code || "UNMAPPED",
              targetLeaveTypeName: targetLeaveType?.name || "UNMAPPED",
              timestamp: new Date().toISOString(),
            },
          },
        });

        // 3d. Create employee notification
        await tx.employeeNotification.create({
          data: {
            employeeId: employee.employeeId,
            title: `${category === "ANNUAL" ? "Annual" : "Medical"} leave credited`,
            content: `${daysToCredit} day${daysToCredit === 1 ? "" : "s"} of ${category.toLowerCase()} leave have been credited to your balance.`,
            type: "LEAVE_CREDITED",
          },
        });

        // 3e. Atomically synchronize newly credited leave with both the entitlements table
        // and the corresponding year_end_process records/details in 'taken / current_year_entitlement_total' format
        const syncResult = await syncCreditWithYearEndProcess(tx, {
          employeeId: employee.employeeId,
          leaveTypeId: targetLeaveTypeId,
          leaveTypeCode: targetLeaveType?.code,
          category,
          daysCredited: daysToCredit,
          year: currentYear,
          cycle: currentCycle,
        });

        creditedEmployees.push({
          employeeId: employee.employeeId,
          name: employee.name,
          stream: employee.stream,
          department: employee.department,
          leaveTypeCode: targetLeaveType?.code || "N/A",
          creditedDays: daysToCredit,
        });
      }
    },
    { timeout: 30000 }
  );

  return {
    success: true,
    creditedCount: creditedEmployees.length,
    skippedCount: skippedEmployees.length,
    year: currentYear,
    cycle: currentCycle,
    category,
    creditedEmployees,
    skippedEmployees,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export class LeaveCreditNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeaveCreditNotFoundError";
  }
}

export class LeaveCreditConsumptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeaveCreditConsumptionError";
  }
}

export interface DeleteLeaveCreditResult {
  success: boolean;
  creditId: number;
  employeeId: string;
  employeeName: string;
  category: LeaveCategory;
  revertedDays: number;
  remainingCategoryBalance: number;
  entitlementTotal: number;
}

/**
 * Safely and atomically deletes a leave credit record, reversing credited balances across:
 *  1. employee_leave_balances (overall category balance)
 *  2. employee_leave_eligibilities (specific leave type balance & creditedDays)
 *  3. entitlements (JSONB balance breakdown & recalculated total)
 *  4. year_end_processes & year_end_process_details (snapshot_after in 'taken / total' format)
 *  5. leave_year_end_records (current cycle records)
 *
 * Enforces validation guardrails to prevent negative balances if leave was already consumed.
 */
export async function deleteLeaveCredit(
  creditId: number,
  performedBy: string = "Administrator"
): Promise<DeleteLeaveCreditResult> {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Fetch the credit entry with relations
      const credit = await tx.leaveCredit.findUnique({
        where: { id: creditId },
        include: {
          employee: {
            select: {
              employeeId: true,
              name: true,
              stream: true,
              department: true,
            },
          },
          leaveType: {
            select: {
              id: true,
              code: true,
              name: true,
              daysAllowed: true,
            },
          },
        },
      });

      if (!credit) {
        throw new LeaveCreditNotFoundError(`Leave credit record #${creditId} no longer exists.`);
      }

      const employeeName = credit.employee?.name || credit.employeeId;
      const creditYear = credit.year || new Date(credit.createdAt).getUTCFullYear();
      const creditCycle = credit.cycle || `${creditYear}-${creditYear + 1}`;

      // 2. Identify or resolve the policy leave type
      let targetLeaveTypeId = credit.leaveTypeId;
      let targetLeaveTypeCode = credit.leaveType?.code;

      if (!targetLeaveTypeId) {
        const activeLeaveTypes = await tx.leaveType.findMany({
          where: { status: "ACTIVE" },
          select: {
            id: true,
            code: true,
            name: true,
            leaveGroup: true,
            category: true,
            daysAllowed: true,
          },
        });
        const resolved = resolveEmployeePolicyLeaveType(
          {
            employeeId: credit.employeeId,
            stream: credit.stream || credit.employee?.stream || "",
            department: credit.department || credit.employee?.department || "",
          },
          credit.category,
          activeLeaveTypes
        );
        targetLeaveTypeId = resolved?.id ?? null;
        targetLeaveTypeCode = resolved?.code;
      }

      // 3. Validation Guardrails: Check if balance was consumed before deleting
      // 3a. Check category balance
      const categoryBalanceRecord = await tx.employeeLeaveBalance.findUnique({
        where: {
          employeeId_category: {
            employeeId: credit.employeeId,
            category: credit.category,
          },
        },
      });
      const currentCategoryBal = categoryBalanceRecord?.balance ?? 0;
      if (currentCategoryBal < credit.days) {
        throw new LeaveCreditConsumptionError(
          `Cannot delete credit of ${credit.days} day(s): Employee ${employeeName} has already consumed their leave. Available ${credit.category.toLowerCase()} balance is ${currentCategoryBal} day(s), which is less than the ${credit.days} day(s) to be reversed.`
        );
      }

      // 3b. Check specific leave type eligibility balance
      let currentEligibilityBal = 0;
      let currentCreditedDays = 0;
      if (targetLeaveTypeId) {
        const eligibility = await tx.employeeLeaveEligibility.findUnique({
          where: {
            employeeId_leaveTypeId: {
              employeeId: credit.employeeId,
              leaveTypeId: targetLeaveTypeId,
            },
          },
        });
        if (eligibility) {
          currentEligibilityBal = eligibility.leaveBalance;
          currentCreditedDays = eligibility.creditedDays;
          if (currentEligibilityBal < credit.days) {
            throw new LeaveCreditConsumptionError(
              `Cannot delete credit of ${credit.days} day(s): Employee ${employeeName} has only ${currentEligibilityBal} day(s) remaining for ${targetLeaveTypeCode || "this leave type"}, which is less than the ${credit.days} day(s) to be reversed.`
            );
          }
        }
      }

      // 3c. Check Entitlement ledger
      const entitlement = await tx.entitlement.findUnique({
        where: {
          userId_year: {
            userId: credit.employeeId,
            year: creditYear,
          },
        },
      });
      if (entitlement && typeof entitlement.entitlementData === "object" && entitlement.entitlementData !== null) {
        const data = entitlement.entitlementData as Record<string, any>;
        const leaveCode = targetLeaveTypeCode || (credit.category === "ANNUAL" ? "CL" : "ML");
        const bal = data.balances?.[leaveCode] || data[leaveCode];
        if (bal) {
          const totalRemaining = Number(bal.total ?? bal.remainingBalance ?? 0);
          const credited = Number(bal.credited ?? 0);
          if (totalRemaining < credit.days && credited >= credit.days) {
            throw new LeaveCreditConsumptionError(
              `Cannot delete credit of ${credit.days} day(s): Employee ${employeeName} has only ${totalRemaining} day(s) remaining in their entitlement for year ${creditYear}.`
            );
          }
        }
      }

      // 4. Balance & Ledger Rollback
      // 4a. Decrement employeeLeaveBalance
      const newCategoryBal = currentCategoryBal - credit.days;
      await tx.employeeLeaveBalance.update({
        where: {
          employeeId_category: {
            employeeId: credit.employeeId,
            category: credit.category,
          },
        },
        data: {
          balance: { decrement: credit.days },
        },
      });

      // 4b. Decrement employeeLeaveEligibility
      if (targetLeaveTypeId) {
        await tx.employeeLeaveEligibility.update({
          where: {
            employeeId_leaveTypeId: {
              employeeId: credit.employeeId,
              leaveTypeId: targetLeaveTypeId,
            },
          },
          data: {
            creditedDays: Math.max(0, currentCreditedDays - credit.days),
            leaveBalance: { decrement: credit.days },
          },
        });
      }

      // 4c. Safely synchronize and roll back Entitlements and Year-End Process
      const syncResult = await syncCreditWithYearEndProcess(tx, {
        employeeId: credit.employeeId,
        leaveTypeId: targetLeaveTypeId,
        leaveTypeCode: targetLeaveTypeCode,
        category: credit.category,
        daysCredited: -credit.days,
        year: creditYear,
        cycle: creditCycle,
      });

      // 4d. Record Audit trail
      await tx.leaveCreditAudit.create({
        data: {
          employeeId: credit.employeeId,
          stream: credit.stream || credit.employee?.stream || "UNASSIGNED",
          department: credit.department || credit.employee?.department || "UNASSIGNED",
          category: credit.category,
          leaveTypeId: targetLeaveTypeId,
          days: 0,
          year: creditYear,
          cycle: creditCycle,
          action: "REVERSAL",
          performedBy,
          metadata: {
            reversedDays: credit.days,
            creditId: credit.id,
            previousBalance: currentCategoryBal,
            newBalance: newCategoryBal,
            entitlementTotalAfter: syncResult.entitlementTotal,
            reason: "Administrator revoked leave credit",
            timestamp: new Date().toISOString(),
          },
        },
      });

      // 4e. Record Employee Notification
      await tx.employeeNotification.create({
        data: {
          employeeId: credit.employeeId,
          title: `${credit.category === "ANNUAL" ? "Annual" : "Medical"} leave credit revoked`,
          content: `${credit.days} day${credit.days === 1 ? "" : "s"} of ${credit.category.toLowerCase()} leave credit have been revoked by the administrator.`,
          type: "LEAVE_CREDIT_REVERSED",
        },
      });

      // 4f. Remove the credit entry
      await tx.leaveCredit.delete({
        where: { id: credit.id },
      });

      return {
        success: true,
        creditId: credit.id,
        employeeId: credit.employeeId,
        employeeName,
        category: credit.category,
        revertedDays: credit.days,
        remainingCategoryBalance: newCategoryBal,
        entitlementTotal: syncResult.entitlementTotal,
      };
    },
    { timeout: 30000 }
  );
}

/**
 * Safely updates credited leave days for an existing record with balance & entitlement synchronization.
 */
export async function updateLeaveCredit(
  creditId: number,
  newDays: number,
  performedBy: string = "Administrator"
) {
  if (!Number.isSafeInteger(newDays) || newDays < 1) {
    throw new Error("Credited days must be a positive integer.");
  }

  return await prisma.$transaction(
    async (tx) => {
      const credit = await tx.leaveCredit.findUnique({
        where: { id: creditId },
        include: {
          employee: {
            select: { employeeId: true, name: true, stream: true, department: true },
          },
          leaveType: {
            select: { id: true, code: true, name: true, daysAllowed: true },
          },
        },
      });

      if (!credit) {
        throw new LeaveCreditNotFoundError(`Leave credit record #${creditId} no longer exists.`);
      }

      const delta = newDays - credit.days;
      if (delta === 0) {
        return { success: true, credit, delta: 0, entitlementTotal: null };
      }

      const creditYear = credit.year || new Date(credit.createdAt).getUTCFullYear();
      const creditCycle = credit.cycle || `${creditYear}-${creditYear + 1}`;

      // If delta < 0 (reduction), check consumption guardrails
      if (delta < 0) {
        const requiredAvailable = -delta;
        const catBal = await tx.employeeLeaveBalance.findUnique({
          where: {
            employeeId_category: {
              employeeId: credit.employeeId,
              category: credit.category,
            },
          },
        });
        const currentBal = catBal?.balance ?? 0;
        if (currentBal < requiredAvailable) {
          throw new LeaveCreditConsumptionError(
            `Cannot reduce credit by ${requiredAvailable} day(s): Employee ${credit.employee?.name || credit.employeeId} has only ${currentBal} day(s) available in balance.`
          );
        }
      }

      let targetLeaveTypeId = credit.leaveTypeId;
      let targetLeaveTypeCode = credit.leaveType?.code;
      if (!targetLeaveTypeId) {
        const activeLeaveTypes = await tx.leaveType.findMany({ where: { status: "ACTIVE" } });
        const resolved = resolveEmployeePolicyLeaveType(
          {
            employeeId: credit.employeeId,
            stream: credit.stream || credit.employee?.stream || "",
            department: credit.department || credit.employee?.department || "",
          },
          credit.category,
          activeLeaveTypes
        );
        targetLeaveTypeId = resolved?.id ?? null;
        targetLeaveTypeCode = resolved?.code;
      }

      // Update employeeLeaveBalance
      await tx.employeeLeaveBalance.upsert({
        where: {
          employeeId_category: {
            employeeId: credit.employeeId,
            category: credit.category,
          },
        },
        create: {
          employeeId: credit.employeeId,
          category: credit.category,
          balance: Math.max(0, delta),
        },
        update: {
          balance: { increment: delta },
        },
      });

      // Update eligibility
      if (targetLeaveTypeId) {
        const eligibility = await tx.employeeLeaveEligibility.findUnique({
          where: {
            employeeId_leaveTypeId: {
              employeeId: credit.employeeId,
              leaveTypeId: targetLeaveTypeId,
            },
          },
        });
        if (eligibility) {
          await tx.employeeLeaveEligibility.update({
            where: {
              employeeId_leaveTypeId: {
                employeeId: credit.employeeId,
                leaveTypeId: targetLeaveTypeId,
              },
            },
            data: {
              creditedDays: Math.max(0, eligibility.creditedDays + delta),
              leaveBalance: { increment: delta },
            },
          });
        }
      }

      // Synchronize with entitlements and year end process
      const syncResult = await syncCreditWithYearEndProcess(tx, {
        employeeId: credit.employeeId,
        leaveTypeId: targetLeaveTypeId,
        leaveTypeCode: targetLeaveTypeCode,
        category: credit.category,
        daysCredited: delta,
        year: creditYear,
        cycle: creditCycle,
      });

      // Audit
      await tx.leaveCreditAudit.create({
        data: {
          employeeId: credit.employeeId,
          stream: credit.stream || credit.employee?.stream || "UNASSIGNED",
          department: credit.department || credit.employee?.department || "UNASSIGNED",
          category: credit.category,
          leaveTypeId: targetLeaveTypeId,
          days: newDays,
          year: creditYear,
          cycle: creditCycle,
          action: "UPDATE",
          performedBy,
          metadata: {
            previousDays: credit.days,
            newDays,
            delta,
            entitlementTotalAfter: syncResult.entitlementTotal,
            timestamp: new Date().toISOString(),
          },
        },
      });

      const updated = await tx.leaveCredit.update({
        where: { id: credit.id },
        data: { days: newDays },
      });

      return {
        success: true,
        credit: updated,
        delta,
        entitlementTotal: syncResult.entitlementTotal,
      };
    },
    { timeout: 30000 }
  );
}

