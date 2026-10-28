import { prisma } from "@/lib/prisma";
import { calculateLeaveBalance } from "@/lib/leave-eligibility";

export const runtime = "nodejs";

const DAY_MS = 86_400_000;

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function inclusiveDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date) {
  const from = Math.max(start.getTime(), rangeStart.getTime());
  const to = Math.min(end.getTime(), rangeEnd.getTime());
  return to < from ? 0 : Math.floor((to - from) / DAY_MS) + 1;
}

function earnedDays(entitlement: number, joined: Date, start: Date, end: Date) {
  const eligibleStart = new Date(Math.max(joined.getTime(), start.getTime()));
  if (eligibleStart > end) return 0;
  return Math.round(entitlement * inclusiveDays(eligibleStart, end) / inclusiveDays(start, end));
}

function earnedPeriodDays(
  entitlement: number,
  joined: Date,
  periodStart: Date,
  periodEnd: Date,
  academicYearStart: Date,
  academicYearEnd: Date,
) {
  const eligibleStart = new Date(Math.max(joined.getTime(), periodStart.getTime()));
  if (eligibleStart > periodEnd) return 0;
  return Math.round(
    entitlement * inclusiveDays(eligibleStart, periodEnd) / inclusiveDays(academicYearStart, academicYearEnd),
  );
}

function leaveTypeMatches(requestType: string, leaveType: { code: string; name: string; leaveGroup: string }) {
  const normalizedType = requestType.toUpperCase().replaceAll("_", " ");
  const knownLabels: Record<string, string[]> = {
    GENERAL: ["GENERAL", "CASUAL"],
    MEDICAL: ["MEDICAL", "SICK"],
    "ON DUTY": ["ON DUTY", "DUTY"],
    HOSTEL: ["HOSTEL"],
    OTHER: ["OTHER", "SPECIAL"],
  };
  const leaveLabels = [leaveType.code, leaveType.name, leaveType.leaveGroup].map((value) => value.toUpperCase());
  return (knownLabels[normalizedType] ?? [normalizedType]).some((label) =>
    leaveLabels.some((leaveLabel) => leaveLabel.includes(label) || label.includes(leaveLabel)),
  );
}

function isTaken(status: string, endDate: Date, today: Date) {
  return status === "APPROVED" && endDate < today;
}

function countWorkdays(start: Date, end: Date, holidayDates: Set<string>) {
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidayDates.has(cursor.toISOString().slice(0, 10))) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const employeeId = params.get("employeeId")?.trim() ?? "";
  const periodStart = parseDate(params.get("startDate"));
  const periodEnd = parseDate(params.get("endDate"));
  const academicYearStart = parseDate(params.get("academicYearStart"));
  const academicYearEnd = parseDate(params.get("academicYearEnd"));

  if (!employeeId || !periodStart || !periodEnd || periodEnd < periodStart ||
    !academicYearStart || !academicYearEnd || academicYearEnd < academicYearStart ||
    periodStart < academicYearStart || periodEnd > academicYearEnd) {
    return Response.json({ error: "Select an employee and a valid reporting period." }, { status: 400 });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      select: {
        employeeId: true,
        name: true,
        stream: true,
        department: true,
        designation: true,
        mobileNumber: true,
        workEmail: true,
        leaveBalances: { select: { category: true, balance: true } },
        leaveRecords: {
          where: { isEligible: true },
          select: {
            leaveTypeId: true,
            daysAllowed: true,
            leaveBalance: true,
            creditedDays: true,
            joiningDate: true,
            leaveType: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                leaveGroup: true,
                daysAllowed: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!employee) return Response.json({ error: "Employee not found." }, { status: 404 });

    const students = await prisma.student.findMany({
      where: { studentCode: employeeId },
      select: {
        id: true,
        user: { select: { email: true, firstName: true, lastName: true, name: true } },
      },
    });
    const studentIds = students.map(({ id }) => id);
    const [requests, credits, holidays] = await Promise.all([
      studentIds.length
        ? prisma.studentLeaveRequest.findMany({
          where: {
            studentId: { in: studentIds },
            startDate: { lte: periodEnd },
            endDate: { gte: periodStart },
          },
          include: {
            reviewer: { select: { name: true, firstName: true, lastName: true } },
          },
          orderBy: [{ startDate: "desc" }, { id: "desc" }],
        })
        : Promise.resolve([]),
      prisma.leaveCredit.findMany({
        where: {
          employeeId,
          createdAt: {
            gte: academicYearStart,
            lt: new Date(academicYearEnd.getTime() + DAY_MS),
          },
        },
        select: {
          category: true,
          days: true,
          createdAt: true,
          leaveTypeId: true,
          leaveType: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.holiday.findMany({
        where: {
          date: { gte: periodStart, lte: periodEnd },
          status: { equals: "active", mode: "insensitive" },
          isHoliday: true,
        },
        select: { date: true },
      }),
    ]);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const requestHistory = requests.filter((record) =>
      isTaken(record.status.toString().toUpperCase(), record.endDate, today),
    ).map((record) => {
      const status = record.status.toString().toUpperCase();
      const reviewer = record.reviewer;
      const approver = reviewer?.name?.trim() ||
        [reviewer?.firstName, reviewer?.lastName].filter(Boolean).join(" ") || null;
      return {
        id: record.id,
        startDate: record.startDate,
        endDate: record.endDate,
        appliedAt: record.appliedAt,
        duration: inclusiveDays(record.startDate, record.endDate),
        leaveType: record.type.toString().replaceAll("_", " "),
        status,
        reason: record.reason,
        approver,
        reviewedAt: record.reviewedAt,
      };
    });

    const categorizedCredits = credits.map((credit) => ({
      ...credit,
      periodDays: credit.createdAt >= periodStart &&
        credit.createdAt < new Date(periodEnd.getTime() + DAY_MS) ? credit.days : 0,
    }));
    const eligibleRecords = employee.leaveRecords.filter((record) => record.leaveType.status === "ACTIVE");
    const leaveTypes = eligibleRecords.map((record) => {
      const typeCredits = categorizedCredits.filter((credit) => credit.leaveTypeId === record.leaveTypeId);
      const allocatedPeriod = earnedPeriodDays(
        record.leaveType.daysAllowed,
        record.joiningDate,
        periodStart,
        periodEnd,
        academicYearStart,
        academicYearEnd,
      ) +
        typeCredits.reduce((total, credit) => total + credit.periodDays, 0);
      const allocatedYear = earnedDays(record.leaveType.daysAllowed, record.joiningDate, academicYearStart, academicYearEnd) +
        typeCredits.reduce((total, credit) => total + credit.days, 0);
      const leavesTaken = requests
        .filter((leave) =>
          isTaken(leave.status.toString().toUpperCase(), leave.endDate, today) &&
          leaveTypeMatches(leave.type.toString(), record.leaveType)
        )
        .reduce((total, leave) => total + overlaps(leave.startDate, leave.endDate, periodStart, periodEnd), 0);
      return {
        id: record.leaveTypeId,
        code: record.leaveType.code,
        name: record.leaveType.name,
        category: record.leaveType.category ?? record.leaveType.leaveGroup,
        allocatedPeriod,
        allocatedYear,
        leavesTaken,
        balance: calculateLeaveBalance(record.leaveType.daysAllowed, record.joiningDate, new Date().getUTCFullYear()) +
          record.creditedDays,
      };
    });
    for (const category of ["ANNUAL", "MEDICAL"] as const) {
      const unassignedCredits = categorizedCredits.filter((credit) => credit.category === category && credit.leaveTypeId === null);
      if (!unassignedCredits.length) continue;
      const categoryBalance = employee.leaveBalances.find((balance) => balance.category === category)?.balance ?? 0;
      const typedCredits = eligibleRecords
        .filter((record) => record.leaveType.category === category)
        .reduce((total, record) => total + record.creditedDays, 0);
      leaveTypes.push({
        id: category === "ANNUAL" ? -1 : -2,
        code: `${category}-CREDIT`,
        name: `${category === "ANNUAL" ? "Annual" : "Medical"} leave credit`,
        category,
        allocatedPeriod: unassignedCredits.reduce((total, credit) => total + credit.periodDays, 0),
        allocatedYear: unassignedCredits.reduce((total, credit) => total + credit.days, 0),
        leavesTaken: 0,
        balance: Math.max(0, categoryBalance - typedCredits),
      });
    }

    const holidaysInPeriod = new Set(holidays.map(({ date }) => date.toISOString().slice(0, 10)));
    const workdays = countWorkdays(periodStart, periodEnd, holidaysInPeriod);
    const missedDaysByType = new Map<string, Set<string>>();
    for (const leave of requests) {
      const status = leave.status.toString().toUpperCase();
      if (!isTaken(status, leave.endDate, today)) continue;
      const start = new Date(Math.max(leave.startDate.getTime(), periodStart.getTime()));
      const end = new Date(Math.min(leave.endDate.getTime(), periodEnd.getTime()));
      const type = leave.type.toString().replaceAll("_", " ");
      const missedDays = missedDaysByType.get(type) ?? new Set<string>();
      const cursor = new Date(start);
      while (cursor <= end) {
        const weekday = cursor.getUTCDay();
        const key = cursor.toISOString().slice(0, 10);
        if (weekday !== 0 && weekday !== 6 && !holidaysInPeriod.has(key)) missedDays.add(key);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      missedDaysByType.set(type, missedDays);
    }
    const missedWorkdays = new Set([...missedDaysByType.values()].flatMap((days) => [...days])).size;
    const frequentLeave = [...missedDaysByType.entries()].sort((left, right) => right[1].size - left[1].size)[0];
    const longestLeave = requests
      .filter((leave) => isTaken(leave.status.toString().toUpperCase(), leave.endDate, today))
      .reduce((longest, leave) => Math.max(longest, overlaps(leave.startDate, leave.endDate, periodStart, periodEnd)), 0);
    const totalAllocated = leaveTypes.reduce((total, type) => total + type.allocatedPeriod, 0);
    const totalTaken = leaveTypes.reduce((total, type) => total + type.leavesTaken, 0);
    const primaryStudent = students[0];

    return Response.json({
      employee: {
        employeeId: employee.employeeId,
        name: employee.name,
        designation: employee.designation,
        department: employee.department,
        stream: employee.stream,
        mobile: employee.mobileNumber,
        workEmail: employee.workEmail?.trim() || primaryStudent?.user.email?.trim() || null,
      },
      period: {
        startDate: periodStart,
        endDate: periodEnd,
        academicYearStart,
        academicYearEnd,
      },
      leaveTypes,
      leaveHistory: requestHistory,
      analytics: {
        workdays,
        missedWorkdays,
        absenteeismRate: workdays ? (missedWorkdays / workdays) * 100 : 0,
        utilizationRate: totalAllocated ? (totalTaken / totalAllocated) * 100 : 0,
        longestContinuousLeave: longestLeave,
        frequentlyUsedLeaveType: frequentLeave?.[0] ?? "None",
        leaveTypeDays: [...missedDaysByType.entries()].map(([type, days]) => ({ type, days: days.size })),
      },
    });
  } catch (error) {
    console.error("Failed to generate individual leave report:", error);
    return Response.json({ error: "Unable to generate this leave report from the database." }, { status: 503 });
  }
}
