import { prisma } from "@/lib/prisma";
import { calculateLeaveBalance } from "@/lib/leave-eligibility";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/statutory-report
 * Returns employees with gender from employee_leave_eligibilities and calculated leave balances
 */
export async function GET() {
  try {
    const [employees, leaveTypes, genderRows] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
        include: {
          leaveRecords: {
            select: {
              leaveTypeId: true,
              isEligible: true,
              daysAllowed: true,
              leaveBalance: true,
              joiningDate: true,
            },
          },
        },
      }),
      prisma.leaveType.findMany({
        orderBy: { id: "asc" },
        select: { id: true, code: true, name: true, status: true, daysAllowed: true },
      }),
      prisma
        .$queryRawUnsafe<Array<{ employee_id: string; gender: string }>>(
          'SELECT DISTINCT employee_id, gender FROM "employee_leave_eligibilities"'
        )
        .catch(() => []),
    ]);

    const genderMap = new Map(genderRows.map((r) => [r.employee_id, r.gender]));
    const leaveTypesById = new Map(leaveTypes.map((lt) => [lt.id, lt]));
    const leaveYear = new Date().getUTCFullYear();

    const employeesWithBalances = employees.map((employee) => {
      const employeeGender = genderMap.get(employee.employeeId) || "Male";

      return {
        ...employee,
        gender: employeeGender,
        leaveRecords: employee.leaveRecords.map(({ joiningDate, ...record }) => {
          const lt = leaveTypesById.get(record.leaveTypeId);
          const isEligible = record.isEligible && lt?.status === "ACTIVE";
          return {
            ...record,
            gender: employeeGender,
            joiningDate,
            leaveBalance:
              isEligible && lt
                ? calculateLeaveBalance(lt.daysAllowed, joiningDate, leaveYear)
                : record.leaveBalance ?? 0,
          };
        }),
      };
    });

    return Response.json({ employees: employeesWithBalances, leaveTypes });
  } catch (error) {
    console.error("Failed to load statutory report data:", error);
    return Response.json(
      { error: "Unable to load statutory report data from the database.", details: String(error) },
      { status: 503 }
    );
  }
}

/**
 * POST /api/statutory-report
 * Prepares statutory report generation (placeholder for future report generation logic)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportType, employeeIds, startDate, endDate, departments } = body;

    return Response.json({
      success: true,
      message: `Statutory report configuration ready for ${reportType || "Statutory"} Leave.`,
      details: {
        reportType,
        totalEmployees: Array.isArray(employeeIds) ? employeeIds.length : 0,
        startDate,
        endDate,
        departments,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to process statutory report request:", error);
    return Response.json(
      { error: "Failed to process statutory report generation request." },
      { status: 400 }
    );
  }
}
