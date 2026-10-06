import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
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
            },
          },
        },
      }),
      prisma.leaveType.findMany({
        orderBy: { id: "asc" },
        select: { id: true, code: true, name: true, status: true },
      }),
    ]);

    return Response.json({ employees, leaveTypes });
  } catch (error) {
    console.error("Failed to load leave eligibility:", error);
    return Response.json({ error: "Unable to load leave eligibility from the database." }, { status: 503 });
  }
}