import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseDate(value: string | null, isEndOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = isEndOfDay ? "23:59:59.999Z" : "00:00:00.000Z";
  const date = new Date(`${value}T${time}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let employeeId = searchParams.get("employeeId")?.trim() || "";
    if (employeeId === "random") {
      const allEmps = await prisma.employee.findMany({
        select: { employeeId: true },
        orderBy: { employeeId: "asc" },
      });
      if (allEmps.length > 0) {
        const randomIndex = Math.floor(Math.random() * allEmps.length);
        employeeId = allEmps[randomIndex].employeeId;
      } else {
        employeeId = "EMP-001";
      }
    } else if (!employeeId || employeeId === "default") {
      const primaryEmp = await prisma.employee.findFirst({
        orderBy: { employeeId: "asc" },
        select: { employeeId: true },
      });
      employeeId = primaryEmp?.employeeId || "EMP-001";
    }

    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const statusParam = searchParams.get("status")?.trim().toLowerCase() || "";

    const startDate = parseDate(startDateParam, false);
    const endDate = parseDate(endDateParam, true);

    // Fetch the target employee
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      include: {
        leaveRecords: {
          include: {
            leaveType: true,
          },
        },
      },
    });

    if (!employee) {
      return Response.json({ error: "Employee not found." }, { status: 404 });
    }

    // Fetch all employees for switcher
    const allEmployees = await prisma.employee.findMany({
      orderBy: { employeeId: "asc" },
      select: {
        employeeId: true,
        name: true,
        department: true,
        stream: true,
        gender: true,
      },
    });

    // Build date filter for applications
    const dateFilter: {
      startDate?: { lte: Date };
      endDate?: { gte: Date };
    } = {};

    if (endDate) {
      dateFilter.startDate = { lte: endDate };
    }
    if (startDate) {
      dateFilter.endDate = { gte: startDate };
    }

    // Fetch employee leave applications
    const applications = await prisma.employeeLeaveApplication.findMany({
      where: {
        employeeId,
        ...dateFilter,
        ...(statusParam && statusParam !== "all"
          ? { status: { equals: statusParam, mode: "insensitive" } }
          : {}),
      },
      include: {
        leaveType: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
    });

    // Compute metrics
    let approvedDays = 0;
    let pendingDays = 0;
    let rejectedDays = 0;
    let cancelledDays = 0;
    let totalDaysApplied = 0;

    for (const app of applications) {
      const days = app.daysCount || 1;
      totalDaysApplied += days;
      const s = app.status.toLowerCase();
      if (s === "approved" || s === "taken") {
        approvedDays += days;
      } else if (s === "pending") {
        pendingDays += days;
      } else if (s === "rejected") {
        rejectedDays += days;
      } else if (s === "cancelled") {
        cancelledDays += days;
      }
    }

    // Compute leave entitlements & balances
    const leaveBalances = employee.leaveRecords.map((rec) => {
      // Days taken for this leave type in date range
      const taken = applications
        .filter(
          (a) =>
            a.leaveTypeId === rec.leaveTypeId &&
            (a.status.toLowerCase() === "approved" || a.status.toLowerCase() === "taken")
        )
        .reduce((sum, a) => sum + (a.daysCount || 1), 0);

      const calculatedBalance = Math.max(0, (rec.daysAllowed || 0) + (rec.creditedDays || 0) - taken);

      return {
        leaveTypeId: rec.leaveTypeId,
        code: rec.leaveType.code,
        name: rec.leaveType.name,
        daysAllowed: rec.daysAllowed,
        creditedDays: rec.creditedDays,
        takenDays: taken,
        balance: calculatedBalance,
      };
    });

    const overallBalance = leaveBalances.reduce((sum, lb) => sum + lb.balance, 0);

    const formattedApplications = applications.map((app) => ({
      id: app.id,
      leaveTypeId: app.leaveTypeId,
      leaveTypeCode: app.leaveType.code,
      leaveTypeName: app.leaveType.name,
      startDate: app.startDate.toISOString().slice(0, 10),
      endDate: app.endDate.toISOString().slice(0, 10),
      daysCount: app.daysCount,
      reason: app.reason,
      status: app.status,
      appliedAt: app.appliedAt.toISOString().slice(0, 10),
      reviewedBy: app.reviewedBy ?? "—",
      remarks: app.remarks ?? "—",
    }));

    return Response.json({
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        stream: employee.stream,
        department: employee.department,
        status: "Active",
        gender: employee.gender || "Not Specified",
      },
      allEmployees,
      dateRange: {
        startDate: startDateParam || "",
        endDate: endDateParam || "",
      },
      metrics: {
        totalApplications: applications.length,
        totalDaysApplied,
        approvedDays,
        pendingDays,
        rejectedDays,
        cancelledDays,
        overallBalance,
      },
      leaveBalances,
      applications: formattedApplications,
    });
  } catch (error) {
    console.error("Failed to fetch employee status report:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load employee status report from database." },
      { status: 500 }
    );
  }
}
