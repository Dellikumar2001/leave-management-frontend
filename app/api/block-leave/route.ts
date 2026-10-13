import { prisma } from "@/lib/prisma";
import type { LeaveCategory } from "@prisma/client";
import { getInclusiveDates, parseDateOnly } from "@/lib/leave-administration";

export const runtime = "nodejs";

type BlockInput = { employeeIds?: unknown; startDate?: unknown; endDate?: unknown };

function parseBlockDates(input: BlockInput) {
  const startDate = parseDateOnly(input.startDate);
  const endDate = input.endDate === "" || input.endDate === undefined
    ? startDate
    : parseDateOnly(input.endDate);
  if (!startDate || !endDate || endDate < startDate) return null;
  const dates = getInclusiveDates(startDate, endDate);
  return { startDate, endDate, dates };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const employeeId = params.get("employeeId");
  const categoryValue = params.get("category")?.toUpperCase() ?? "ANNUAL";
  if (categoryValue !== "ANNUAL" && categoryValue !== "MEDICAL") {
    return Response.json({ error: "Choose Annual or Medical." }, { status: 400 });
  }
  try {
    const [employees, streams, departments, blockedLeaves] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
        select: {
          employeeId: true,
          name: true,
          stream: true,
          department: true,
          leaveBalances: {
            where: { category: categoryValue as LeaveCategory },
            select: { balance: true },
          },
        },
      }),
      prisma.employee.findMany({ distinct: ["stream"], orderBy: { stream: "asc" }, select: { stream: true } }),
      prisma.employee.findMany({ distinct: ["department"], orderBy: { department: "asc" }, select: { department: true } }),
      prisma.blockedLeave.findMany({
        where: employeeId ? { employeeId } : undefined,
        orderBy: [{ date: "asc" }, { employeeId: "asc" }],
      }),
    ]);
    return Response.json({
      employees: employees.map(({ leaveBalances, ...employee }) => ({
        ...employee,
        balance: leaveBalances[0]?.balance ?? 0,
      })),
      streams: streams.map(({ stream }) => stream),
      departments: departments.map(({ department }) => department),
      blockedLeaves,
    });
  } catch (error) {
    console.error("Failed to load blocked leaves:", error);
    if (hasPrismaErrorCode(error, "P2021")) {
      return Response.json(
        { error: "A leave-administration table is missing. Run npm run db:migrate, then reload this page." },
        { status: 503 },
      );
    }
    return Response.json({ error: "Unable to load blocked leave records." }, { status: 503 });
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
    return Response.json({ error: "Select employees and valid dates." }, { status: 400 });
  }

  const input = body as BlockInput;
  const dates = parseBlockDates(input);
  if (!Array.isArray(input.employeeIds) || input.employeeIds.length === 0 ||
      !input.employeeIds.every((id) => typeof id === "string" && id.trim()) || !dates) {
    return Response.json({ error: "Select employees and a valid date range." }, { status: 400 });
  }
  const employeeIds = [...new Set(input.employeeIds.map((id) => (id as string).trim()))];

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const foundEmployees = await transaction.employee.findMany({
        where: { employeeId: { in: employeeIds } },
        select: { employeeId: true },
      });
      if (foundEmployees.length !== employeeIds.length) throw new Error("One or more selected employees could not be found.");

      const created = await transaction.blockedLeave.createMany({
        data: employeeIds.flatMap((employeeId) => dates.dates.map((date) => ({ employeeId, date }))),
        skipDuplicates: true,
      });
      await transaction.employeeNotification.createMany({
        data: employeeIds.map((employeeId) => ({
          employeeId,
          title: "Leave dates blocked",
          content: `${dates.dates.length} day${dates.dates.length === 1 ? "" : "s"} from ${dates.startDate.toISOString().slice(0, 10)} to ${dates.endDate.toISOString().slice(0, 10)} are unavailable for leave.`,
          type: "LEAVE_BLOCKED",
        })),
      });
      return created.count;
    });
    return Response.json({ blockedCount: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("could not be found")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to block leave:", error);
    return Response.json({ error: "Unable to save blocked leave records. Check the database migration." }, { status: 503 });
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
    return Response.json({ error: "Provide a blocked leave ID and date." }, { status: 400 });
  }

  const input = body as { id?: unknown; date?: unknown };
  const date = parseDateOnly(input.date);
  if (!Number.isSafeInteger(input.id) || (input.id as number) < 1 || !date) {
    return Response.json({ error: "Provide a valid blocked leave ID and date." }, { status: 400 });
  }

  try {
    const blockedLeave = await prisma.blockedLeave.update({
      where: { id: input.id as number },
      data: { date },
    });
    return Response.json({ blockedLeave });
  } catch (error) {
    console.error("Failed to update blocked leave:", error);
    return Response.json({ error: "Unable to update the blocked date." }, { status: 409 });
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
    return Response.json({ error: "Provide a blocked leave ID." }, { status: 400 });
  }
  const id = (body as { id?: unknown }).id;
  if (!Number.isSafeInteger(id) || (id as number) < 1) {
    return Response.json({ error: "Provide a valid blocked leave ID." }, { status: 400 });
  }

  try {
    await prisma.blockedLeave.delete({ where: { id: id as number } });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete blocked leave:", error);
    return Response.json({ error: "Unable to delete the blocked date." }, { status: 503 });
  }
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
