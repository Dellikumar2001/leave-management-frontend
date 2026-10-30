import type { LeaveCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findBalanceLeaveType } from "@/lib/leave-administration";
import {
  deleteLeaveCredit,
  updateLeaveCredit,
  LeaveCreditNotFoundError,
  LeaveCreditConsumptionError,
} from "@/lib/annual-leave-credit";

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
    select: { daysAllowed: true, creditedDays: true, isEligible: true, leaveBalance: true },
  });

  if (eligibility) {
    const newCreditedDays = Math.max(0, eligibility.creditedDays + delta);
    if (newCreditedDays < 0) {
      throw new Error("The credit cannot be reversed because the employee's available balance has been used.");
    }
    await transaction.employeeLeaveEligibility.update({
      where: { employeeId_leaveTypeId: { employeeId, leaveTypeId } },
      data: {
        isEligible: true,
        creditedDays: newCreditedDays,
        leaveBalance: { increment: delta },
      },
    });
  } else {
    if (delta < 0) throw new Error("The credit cannot be reversed because the employee's available balance has been used.");
    const leaveTypeRecord = await transaction.leaveType.findUnique({
      where: { id: leaveTypeId },
      select: { daysAllowed: true },
    });
    const baseDays = leaveTypeRecord?.daysAllowed ?? 12;
    await transaction.employeeLeaveEligibility.create({
      data: {
        employeeId,
        leaveTypeId,
        isEligible: true,
        daysAllowed: baseDays,
        creditedDays: delta,
        leaveBalance: delta,
      },
    });
  }
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

import { executeAnnualLeaveCredit } from "@/lib/annual-leave-credit";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Select employees or filters and valid credit details." }, { status: 400 });
  }

  const input = body as {
    streams?: unknown;
    departments?: unknown;
    employee_ids?: unknown;
    employeeIds?: unknown;
    credit?: unknown;
    category?: unknown;
    days?: unknown;
    year?: unknown;
    cycle?: unknown;
    allowDuplicate?: unknown;
    performedBy?: unknown;
  };

  // Support both credit object and top-level fields
  let category: "ANNUAL" | "MEDICAL" = "ANNUAL";
  let days: number | undefined;

  const parsedCredit = parseCredit(input.credit);
  if (parsedCredit) {
    category = parsedCredit.category;
    days = parsedCredit.days;
  } else {
    if (isCategory(input.category)) {
      category = input.category;
    }
    if (Number.isSafeInteger(input.days) && (input.days as number) >= 0) {
      days = input.days as number;
    }
  }

  // Extract streams, departments, employeeIds
  const streams =
    typeof input.streams === "string"
      ? input.streams
      : Array.isArray(input.streams)
      ? (input.streams as string[])
      : undefined;

  const departments =
    typeof input.departments === "string"
      ? input.departments
      : Array.isArray(input.departments)
      ? (input.departments as string[])
      : undefined;

  const employeeIds = Array.isArray(input.employee_ids)
    ? (input.employee_ids as string[])
    : Array.isArray(input.employeeIds)
    ? (input.employeeIds as string[])
    : undefined;

  try {
    const result = await executeAnnualLeaveCredit({
      streams,
      departments,
      employee_ids: employeeIds,
      category,
      days,
      year: typeof input.year === "number" ? input.year : undefined,
      cycle: typeof input.cycle === "string" ? input.cycle : undefined,
      allowDuplicate: Boolean(input.allowDuplicate),
      performedBy: typeof input.performedBy === "string" ? input.performedBy : "Administrator",
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to credit leave.";
    if (
      message.includes("No active employees found") ||
      message.includes("could not be found") ||
      message.includes("consumed their available balance")
    ) {
      return Response.json({ error: message }, { status: 400 });
    }
    console.error("Failed to credit leave:", error);
    return Response.json({ error: message || "Unable to credit leave. Check database state." }, { status: 503 });
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
    const result = await updateLeaveCredit(input.id as number, input.days as number);
    return Response.json({ credit: result.credit, result }, { status: 200 });
  } catch (error) {
    if (error instanceof LeaveCreditNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof LeaveCreditConsumptionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message.includes("no longer exists")) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (
        error.message.includes("used") ||
        error.message.includes("consumed") ||
        error.message.includes("cannot be reversed") ||
        error.message.includes("balance")
      ) {
        return Response.json({ error: error.message }, { status: 409 });
      }
      console.error("Failed to update leave credit:", error);
      return Response.json({ error: `Unable to update leave credit: ${error.message}` }, { status: 500 });
    }
    console.error("Failed to update leave credit (unknown error):", error);
    return Response.json({ error: "Unable to update the leave credit." }, { status: 500 });
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
    const result = await deleteLeaveCredit(id as number);
    return Response.json({ success: true, result }, { status: 200 });
  } catch (error) {
    if (error instanceof LeaveCreditNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof LeaveCreditConsumptionError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error) {
      if (error.message.includes("no longer exists")) {
        return Response.json({ error: error.message }, { status: 404 });
      }
      if (
        error.message.includes("used") ||
        error.message.includes("consumed") ||
        error.message.includes("cannot be reversed") ||
        error.message.includes("balance")
      ) {
        return Response.json({ error: error.message }, { status: 409 });
      }
      console.error("Failed to delete leave credit:", error);
      return Response.json({ error: `Unable to delete leave credit: ${error.message}` }, { status: 500 });
    }
    console.error("Failed to delete leave credit (unknown error):", error);
    return Response.json({ error: "Unable to delete the leave credit due to an unexpected error." }, { status: 500 });
  }
}
