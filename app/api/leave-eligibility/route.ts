import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
          employeeLeaveApplications: {
            where: {
              status: "Approved",
            },
            select: {
              leaveTypeId: true,
              daysCount: true,
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
    const leaveTypesById = new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType]));
    const employeesWithBalances = employees.map((employee) => ({
      ...employee,
      leaveRecords: employee.leaveRecords.map((record) => {
        const leaveType = leaveTypesById.get(record.leaveTypeId);
        const isEligible = Boolean(record.isEligible && leaveType?.status === "ACTIVE");
        const key = `${employee.employeeId}-${record.leaveTypeId}`;
        const isProcessed = processedSet.has(key);

        let leaveBalance = 0;
        if (isEligible && leaveType) {
          if (isProcessed) {
            // Reflect the confirmed Leave Year-End process rollover opening balance directly
            leaveBalance = record.leaveBalance;
          } else {
            // Sum approved leave days taken by this employee for this leave type
            const takenDays = employee.employeeLeaveApplications
              .filter((app) => app.leaveTypeId === record.leaveTypeId)
              .reduce((sum, app) => sum + (app.daysCount || 1), 0);

            const daysAllowed = record.daysAllowed || leaveType.daysAllowed || 0;
            const credited = record.creditedDays || 0;
            const totalAllowance = daysAllowed + credited;
            leaveBalance = Math.max(0, totalAllowance - takenDays);
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
    console.error("Failed to load leave eligibility:", error);
    return Response.json({ error: "Unable to load leave entitlement from the database." }, { status: 503 });
  }
}