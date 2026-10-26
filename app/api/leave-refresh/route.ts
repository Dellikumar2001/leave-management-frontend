import { prisma } from "@/lib/prisma";
import { calculateLeaveBalance } from "@/lib/leave-eligibility";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/** GET /api/leave-refresh
 *  Returns the same shape as /api/leave-eligibility so the page can share types.
 */
export async function GET() {
  try {
    const [employees, leaveTypes, yearEndRecords] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
        include: {
          leaveRecords: {
            select: {
              leaveTypeId: true,
              isEligible: true,
              daysAllowed: true,
              leaveBalance: true,
              creditedDays: true,
              joiningDate: true,
            },
          },
        },
      }),
      prisma.leaveType.findMany({
        orderBy: { id: "asc" },
        select: { id: true, code: true, name: true, status: true, daysAllowed: true },
      }),
      prisma.leaveYearEndRecord.findMany({
        select: { employeeId: true, leaveTypeId: true },
      }),
    ]);

    const processedSet = new Set(yearEndRecords.map((r) => `${r.employeeId}-${r.leaveTypeId}`));
    const leaveTypesById = new Map(leaveTypes.map((lt) => [lt.id, lt]));
    const leaveYear = new Date().getUTCFullYear();
    const employeesWithBalances = employees.map((employee) => ({
      ...employee,
      leaveRecords: employee.leaveRecords.map(({ joiningDate, ...record }) => {
        const lt = leaveTypesById.get(record.leaveTypeId);
        const isEligible = record.isEligible && lt?.status === "ACTIVE";
        const key = `${employee.employeeId}-${record.leaveTypeId}`;
        const isProcessed = processedSet.has(key);

        let leaveBalance = 0;
        if (isEligible && lt) {
          if (isProcessed) {
            // Directly reflect the confirmed Leave Year-End process rollover balance
            leaveBalance = record.leaveBalance;
          } else {
            leaveBalance =
              calculateLeaveBalance(record.daysAllowed || lt.daysAllowed, joiningDate, leaveYear) +
              record.creditedDays;
          }
        }

        return {
          ...record,
          leaveBalance,
        };
      }),
    }));

    return Response.json({ employees: employeesWithBalances, leaveTypes });
  } catch (error) {
    console.error("Failed to load leave refresh data:", error);
    return Response.json(
      { error: "Unable to load leave refresh data from the database." },
      { status: 503 },
    );
  }
}

/** POST /api/leave-refresh
 *  Body: { employeeIds: string[] }
 *  Recalculates and persists leave_balance for every matching record in
 *  employee_leave_eligibilities, then returns the updated data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (
      !body ||
      typeof body !== "object" ||
      !Array.isArray((body as Record<string, unknown>).employeeIds)
    ) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { employeeIds } = body as { employeeIds: string[] };

    if (!employeeIds.every((id) => typeof id === "string")) {
      return Response.json({ error: "All employee IDs must be strings." }, { status: 400 });
    }

    const [leaveTypes, eligibilityRecords, yearEndRecords] = await Promise.all([
      prisma.leaveType.findMany({
        orderBy: { id: "asc" },
        select: { id: true, code: true, name: true, status: true, daysAllowed: true },
      }),
      prisma.employeeLeaveEligibility.findMany({
        where: { employeeId: { in: employeeIds } },
      }),
      prisma.leaveYearEndRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
        },
        orderBy: { id: "desc" },
      }),
    ]);

    const latestYearEndMap = new Map<string, number>();
    yearEndRecords.forEach((yr) => {
      const key = `${yr.employeeId}-${yr.leaveTypeId}`;
      if (!latestYearEndMap.has(key)) {
        latestYearEndMap.set(key, yr.proposedOpeningBalance);
      }
    });

    const leaveTypesById = new Map(leaveTypes.map((lt) => [lt.id, lt]));
    const leaveYear = new Date().getUTCFullYear();

    const updates = eligibilityRecords.map((record) => {
      const lt = leaveTypesById.get(record.leaveTypeId);
      const isEligible = record.isEligible && lt?.status === "ACTIVE";
      const key = `${record.employeeId}-${record.leaveTypeId}`;

      let newBalance = 0;
      if (isEligible && lt) {
        if (latestYearEndMap.has(key)) {
          newBalance = latestYearEndMap.get(key)!;
        } else {
          const allowance = record.daysAllowed || lt.daysAllowed;
          newBalance =
            calculateLeaveBalance(allowance, record.joiningDate, leaveYear) +
            record.creditedDays;
        }
      }

      return prisma.employeeLeaveEligibility.update({
        where: {
          employeeId_leaveTypeId: {
            employeeId: record.employeeId,
            leaveTypeId: record.leaveTypeId,
          },
        },
        data: { leaveBalance: newBalance },
      });
    });

    await prisma.$transaction(updates);

    // Return fresh data after recalculation
    return GET();
  } catch (error) {
    console.error("Failed to recalculate leave balances:", error);
    return Response.json(
      { error: "Failed to recalculate leave balances. Please try again." },
      { status: 503 },
    );
  }
}
