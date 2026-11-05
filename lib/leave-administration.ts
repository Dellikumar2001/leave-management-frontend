import type { LeaveCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const blockedLeaveMessage = "Leaves are blocked for this date. Kindly select any other date or contact admin";
export const holidayLeaveMessage = "Can't apply leave on a holiday";

export function parseDateOnly(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString().slice(0, 10);
    return new Date(`${iso}T00:00:00.000Z`);
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function getInclusiveDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function isLeaveTypeForCategory(
  leaveType: {
    name?: string;
    code?: string;
    category: LeaveCategory | null;
    leaveGroup: string;
    groupItems: {
      leaveGroup: {
        name: string;
        category: { name: string; code: string } | null;
        categories: { category: { name: string; code: string } }[];
      };
    }[];
  },
  category: LeaveCategory,
) {
  if (leaveType.category === category) return true;

  const values = [
    leaveType.name ?? "",
    leaveType.code ?? "",
    leaveType.leaveGroup,
    ...leaveType.groupItems.flatMap(({ leaveGroup }) => [
      leaveGroup.name,
      leaveGroup.category?.name ?? "",
      leaveGroup.category?.code ?? "",
      ...leaveGroup.categories.flatMap(({ category }) => [category.name, category.code]),
    ]),
  ];
  const categoryWord = category === "ANNUAL" ? "ANNUAL" : "MEDICAL";
  return values.some((value) => value.toUpperCase().includes(categoryWord));
}

export async function findBalanceLeaveType(
  transaction: Prisma.TransactionClient,
  category: LeaveCategory,
) {
  const leaveTypes = await transaction.leaveType.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      code: true,
      category: true,
      leaveGroup: true,
      groupItems: {
        select: {
          leaveGroup: {
            select: {
              name: true,
              category: { select: { name: true, code: true } },
              categories: { select: { category: { select: { name: true, code: true } } } },
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  // Credit Annual Leave maps into Casual Leave type (CL)
  if (category === "ANNUAL") {
    const casualType = leaveTypes.find(
      (lt) =>
        lt.code.toUpperCase() === "CL" ||
        lt.code.toUpperCase().startsWith("CL_") ||
        lt.name.toUpperCase().includes("CASUAL")
    );
    if (casualType) return casualType;
  }

  // Credit Medical Leave maps into Medical Leave type (ML)
  if (category === "MEDICAL") {
    const medicalType = leaveTypes.find(
      (lt) =>
        (lt.code.toUpperCase() === "ML" ||
         lt.name.toUpperCase() === "MEDICAL LEAVE" ||
         lt.name.toUpperCase().includes("MEDICAL") ||
         lt.code.toUpperCase().includes("MED")) &&
        !lt.name.toUpperCase().includes("MATERNITY")
    );
    if (medicalType) return medicalType;
  }

  return leaveTypes.find((leaveType) => isLeaveTypeForCategory(leaveType, category)) ?? null;
}

export async function findHolidayDate(
  startDate: Date,
  endDate: Date,
) {
  try {
    const holidays = await prisma.holiday.findMany({
      where: {
        status: { equals: "active", mode: "insensitive" },
        isHoliday: true,
        OR: [
          {
            date: {
              gte: new Date(startDate.getTime() - 86_400_000),
              lte: new Date(endDate.getTime() + 86_400_000),
            },
          },
          {
            repeatEveryYear: true,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        date: true,
        repeatEveryYear: true,
        type: true,
      },
      orderBy: { date: "asc" },
    });

    const dates = getInclusiveDates(startDate, endDate);
    const dateStrings = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
    const monthDayStrings = new Set(dates.map((d) => d.toISOString().slice(5, 10)));

    for (const h of holidays) {
      const hDateStr = h.date.toISOString().slice(0, 10);
      if (dateStrings.has(hDateStr)) {
        return h;
      }
      if (h.repeatEveryYear && monthDayStrings.has(hDateStr.slice(5, 10))) {
        return h;
      }
    }

    return null;
  } catch (error) {
    console.error("Failed to query holiday records:", error);
    return null;
  }
}

export async function findBlockedDate(
  employeeId: string,
  startDate: Date,
  endDate: Date,
) {
  return prisma.blockedLeave.findFirst({
    where: { employeeId, date: { gte: startDate, lte: endDate } },
    select: { date: true },
    orderBy: { date: "asc" },
  });
}

export async function isDateBlockedOrHoliday(
  employeeId: string,
  startDate: Date,
  endDate: Date,
) {
  const holiday = await findHolidayDate(startDate, endDate);
  if (holiday) {
    return { isBlocked: true, reason: "holiday" as const, message: holidayLeaveMessage, holiday };
  }
  const blocked = await findBlockedDate(employeeId, startDate, endDate);
  if (blocked) {
    return { isBlocked: true, reason: "blocked" as const, message: blockedLeaveMessage, blocked };
  }
  return { isBlocked: false, reason: null, message: null };
}
