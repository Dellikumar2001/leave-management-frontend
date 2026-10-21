import type { LeaveCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const blockedLeaveMessage = "Can't take leave on this date, contact admin";

export function parseDateOnly(value: unknown): Date | null {
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
  return leaveTypes.find((leaveType) => isLeaveTypeForCategory(leaveType, category)) ?? null;
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
