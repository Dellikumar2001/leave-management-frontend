import { prisma } from "@/lib/prisma";
import { calculateLeaveBalance } from "@/lib/leave-eligibility";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const yearParam = new URL(request.url).searchParams.get("year");
  const leaveYear = yearParam === null ? new Date().getUTCFullYear() : Number(yearParam);
  if (!Number.isInteger(leaveYear) || leaveYear < 1900 || leaveYear > 9999) {
    return Response.json({ error: "Choose a valid leave year." }, { status: 400 });
  }

  try {
    const [employees, leaveTypes] = await Promise.all([
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
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          daysAllowed: true,
          category: true,
          leaveGroup: true,
        },
      }),
    ]);

    const leaveTypesById = new Map(leaveTypes.map((leaveType) => [leaveType.id, leaveType]));
    const employeesWithBalances = employees.map((employee) => ({
      ...employee,
      leaveRecords: employee.leaveRecords.map(({ joiningDate, ...record }) => {
        const leaveType = leaveTypesById.get(record.leaveTypeId);
        const isEligible = record.isEligible && leaveType?.status === "ACTIVE";

        return {
          ...record,
          leaveBalance: isEligible && leaveType
            ? calculateLeaveBalance(leaveType.daysAllowed, joiningDate, leaveYear) + record.creditedDays
            : 0,
        };
      }),
    }));

    return Response.json({ employees: employeesWithBalances, leaveTypes });
  } catch (error) {
    console.error("Failed to load leave eligibility:", error);
    return Response.json({ error: "Unable to load leave eligibility from the database." }, { status: 503 });
  }
}