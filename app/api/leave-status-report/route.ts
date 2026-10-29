import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/leave-status-report
 *  Query params: stream, department, employeeId, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 *  Returns employees with leave records and any noted remarks suitable for the Leave Status Report.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stream = searchParams.get("stream") ?? "";
    const department = searchParams.get("department") ?? "";
    const employeeId = searchParams.get("employeeId") ?? "";
    const employeeType = searchParams.get("employeeType") ?? "";
    const status = searchParams.get("status") ?? "";
    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";

    const [employees, leaveTypes, studentRequests, rawStatuses] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
        where: {
          ...(stream ? { stream } : {}),
          ...(department ? { department } : {}),
          ...(employeeId ? { employeeId } : {}),
          ...(employeeType ? { employeeType } : {}),
        },
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
      prisma.studentLeaveRequest.findMany({
        where: {
          remarks: { not: null },
        },
        select: {
          remarks: true,
          student: {
            select: { studentCode: true },
          },
        },
      }).catch(() => []),
      prisma.$queryRaw<{ employee_id: string; status: string }[]>`
        SELECT employee_id, status FROM employees
      `.catch(() => []),
    ]);

    const statusMap = new Map<string, string>();
    for (const row of rawStatuses) {
      if (row.employee_id && row.status) {
        statusMap.set(row.employee_id, row.status);
      }
    }

    const remarkMap = new Map<string, string>();
    for (const req of studentRequests) {
      if (req.student?.studentCode && req.remarks) {
        remarkMap.set(req.student.studentCode, req.remarks);
      }
    }

    const employeesWithRemarks = employees.map((emp) => ({
      ...emp,
      status: (emp as { status?: string }).status || statusMap.get(emp.employeeId) || "Approved",
      remarks: remarkMap.get(emp.employeeId) ?? null,
    }));

    const finalEmployees = status
      ? employeesWithRemarks.filter((e) => e.status.toLowerCase() === status.toLowerCase())
      : employeesWithRemarks;

    return Response.json({
      employees: finalEmployees,
      leaveTypes,
      filters: { stream, department, employeeId, employeeType, status, startDate, endDate },
    });
  } catch (error) {
    console.error("Failed to load leave status report:", error);
    return Response.json(
      { error: "Unable to load leave status report from the database." },
      { status: 503 },
    );
  }
}
