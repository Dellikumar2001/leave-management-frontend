import type { LeaveCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findBalanceLeaveType } from "@/lib/leave-administration";

export const runtime = "nodejs";

function isCategory(value: unknown): value is "ANNUAL" | "MEDICAL" {
  return value === "ANNUAL" || value === "MEDICAL";
}

function parseCredit(value: unknown): { category: "ANNUAL" | "MEDICAL"; days: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as { category?: unknown; days?: unknown };
  if (!isCategory(input.category) || !Number.isSafeInteger(input.days) ||
      (input.days as number) < 1 || (input.days as number) > 2_147_483_647) return null;
  return { category: input.category, days: input.days as number };
}

async function changeCreditedDays(
  transaction: Prisma.TransactionClient,
  employeeId: string,
  leaveTypeId: number | null,
  category: LeaveCategory,
  delta: number,
) {
  if (delta === 0) return;
  if (delta < 0) {
    const updated = await transaction.employeeLeaveBalance.updateMany({
      where: { employeeId, category, balance: { gte: -delta } },
      data: { balance: { increment: delta } },
    });
    if (!updated.count) throw new Error("The credit cannot be reversed because the employee's available balance has been used.");
  } else {
    await transaction.employeeLeaveBalance.upsert({
      where: { employeeId_category: { employeeId, category } },
      create: { employeeId, category, balance: delta },
      update: { balance: { increment: delta } },
    });
  }

  if (leaveTypeId === null) return;
  const eligibility = await transaction.employeeLeaveEligibility.findUnique({
    where: { employeeId_leaveTypeId: { employeeId, leaveTypeId } },
    select: { creditedDays: true, isEligible: true, leaveBalance: true },
  });
  if (!eligibility || !eligibility.isEligible) return;
  const creditedDays = eligibility.creditedDays + delta;
  if (creditedDays < 0) throw new Error("The credit cannot be reversed because the employee's available balance has been used.");
  await transaction.employeeLeaveEligibility.update({
    where: { employeeId_leaveTypeId: { employeeId, leaveTypeId } },
    data: {
      creditedDays,
      leaveBalance: { increment: delta },
    },
  });
}

export async function GET(request: Request) {
  const categoryParam = new URL(request.url).searchParams.get("category")?.toUpperCase();
  if (categoryParam && !isCategory(categoryParam)) {
    return Response.json({ error: "Choose Annual or Medical." }, { status: 400 });
  }
  try {
    const credits = await prisma.leaveCredit.findMany({
      where: categoryParam ? { category: categoryParam as LeaveCategory } : undefined,
      include: {
        employee: { select: { employeeId: true, name: true, stream: true, department: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return Response.json({
      credits: credits.map(({ leaveType, ...credit }) => ({
        ...credit,
        balanceLeaveType: leaveType ?? { id: 0, name: "Legacy credit", code: "LEGACY" },
      })),
    });
  } catch (error) {
    console.error("Failed to load leave credits:", error);
    return Response.json({ error: "Unable to load leave credits. Check the database migration." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Select employees and valid credit details." }, { status: 400 });
  }

  const input = body as { employeeIds?: unknown; credit?: unknown };
  const credit = parseCredit(input.credit);
  if (!Array.isArray(input.employeeIds) || !input.employeeIds.length ||
      !input.employeeIds.every((id) => typeof id === "string" && id.trim()) || !credit) {
    return Response.json({ error: "Select employees and enter a positive number of credit days." }, { status: 400 });
  }
  const employeeIds = [...new Set(input.employeeIds.map((id) => (id as string).trim()))];

  try {
    const createdCount = await prisma.$transaction(async (transaction) => {
      const foundEmployees = await transaction.employee.findMany({
        where: { employeeId: { in: employeeIds } },
        select: { employeeId: true },
      });
      if (foundEmployees.length !== employeeIds.length) throw new Error("One or more selected employees could not be found.");

      const balanceLeaveType = await findBalanceLeaveType(transaction, credit.category);
      if (!balanceLeaveType) {
        throw new Error(`Create an active ${credit.category === "ANNUAL" ? "Annual" : "Medical"} leave type or group before crediting days.`);
      }

      for (const employeeId of employeeIds) {
        await changeCreditedDays(transaction, employeeId, balanceLeaveType.id, credit.category, credit.days);
        await transaction.leaveCredit.create({
          data: {
            employeeId,
            category: credit.category,
            days: credit.days,
            startDate: new Date(new Date().toISOString().slice(0, 10)),
            endDate: new Date(new Date().toISOString().slice(0, 10)),
            leaveTypeId: balanceLeaveType.id,
          },
        });
      }
      await transaction.employeeNotification.createMany({
        data: employeeIds.map((employeeId) => ({
          employeeId,
          title: `${credit.category === "ANNUAL" ? "Annual" : "Medical"} leave credited`,
          content: `${credit.days} day${credit.days === 1 ? "" : "s"} of ${credit.category.toLowerCase()} leave have been credited to your balance.`,
          type: "LEAVE_CREDITED",
        })),
      });
      return employeeIds.length;
    });
    return Response.json({ creditedCount: createdCount }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("could not be found")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Create an active")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not eligible")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to credit leave:", error);
    return Response.json({ error: "Unable to credit leave. Check the database migration." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Provide a credit ID and updated day count." }, { status: 400 });
  }
  const input = body as { id?: unknown; days?: unknown };
  if (!Number.isSafeInteger(input.id) || (input.id as number) < 1 ||
      !Number.isSafeInteger(input.days) || (input.days as number) < 1 || (input.days as number) > 2_147_483_647) {
    return Response.json({ error: "Provide a valid credit ID and positive day count." }, { status: 400 });
  }

  try {
    const credit = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.leaveCredit.findUnique({ where: { id: input.id as number } });
      if (!existing) throw new Error("The credit record no longer exists.");
      const newDays = input.days as number;
      await changeCreditedDays(transaction, existing.employeeId, existing.leaveTypeId, existing.category, newDays - existing.days);
      return transaction.leaveCredit.update({
        where: { id: existing.id },
        data: { days: newDays },
      });
    });
    return Response.json({ credit });
  } catch (error) {
    if (error instanceof Error && error.message.includes("no longer exists")) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("cannot be reversed")) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("Failed to update leave credit:", error);
    return Response.json({ error: "Unable to update the leave credit." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Provide a credit ID." }, { status: 400 });
  }
  const id = (body as { id?: unknown }).id;
  if (!Number.isSafeInteger(id) || (id as number) < 1) {
    return Response.json({ error: "Provide a valid credit ID." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.leaveCredit.findUnique({ where: { id: id as number } });
      if (!existing) throw new Error("The credit record no longer exists.");
      await changeCreditedDays(transaction, existing.employeeId, existing.leaveTypeId, existing.category, -existing.days);
      await transaction.leaveCredit.delete({ where: { id: existing.id } });
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("no longer exists")) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("cannot be reversed")) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("Failed to delete leave credit:", error);
    return Response.json({ error: "Unable to delete the leave credit." }, { status: 503 });
  }
}
