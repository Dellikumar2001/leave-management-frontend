import type { LeaveCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isCategory(value: unknown): value is LeaveCategory {
  return value === "ANNUAL" || value === "MEDICAL";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope");
  const streams = params.getAll("stream").filter(Boolean);
  const departments = params.getAll("department").filter(Boolean);
  try {
    if (scope === "streams") {
      const rows = await prisma.employee.findMany({
        distinct: ["stream"],
        orderBy: { stream: "asc" },
        select: { stream: true },
      });
      return Response.json({ streams: rows.map(({ stream }) => stream).filter(Boolean) });
    }
    if (scope === "departments" && streams.length) {
      const rows = await prisma.employee.findMany({
        where: { stream: { in: streams } },
        distinct: ["department"],
        orderBy: { department: "asc" },
        select: { department: true },
      });
      return Response.json({ departments: rows.map(({ department }) => department).filter(Boolean) });
    }
    if (scope === "employees" && streams.length && departments.length) {
      const employees = await prisma.employee.findMany({
        where: { stream: { in: streams }, department: { in: departments } },
        orderBy: { employeeId: "asc" },
        select: {
          employeeId: true,
          name: true,
          designation: true,
          stream: true,
          department: true,
          mobileNumber: true,
        },
      });
      return Response.json({ employees });
    }
    return Response.json({ error: "Choose a valid employee filter scope." }, { status: 400 });
  } catch (error) {
    console.error("Failed to load credit report employee filters:", error);
    return Response.json({ error: "Unable to load employee filters." }, { status: 503 });
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
    return Response.json({ error: "Choose a leave category and at least one employee filter." }, { status: 400 });
  }

  const input = body as {
    category?: unknown;
    employeeIds?: unknown;
    streams?: unknown;
    departments?: unknown;
  };
  const employeeIds = input.employeeIds === undefined ? [] : input.employeeIds;
  const streams = input.streams === undefined ? [] : input.streams;
  const departments = input.departments === undefined ? [] : input.departments;
  if (!isCategory(input.category) || !isStringArray(employeeIds) ||
      !isStringArray(streams) || !isStringArray(departments) ||
      (!employeeIds.length && !streams.length && !departments.length)) {
    return Response.json({ error: "Choose a leave category and at least one employee filter." }, { status: 400 });
  }

  const uniqueEmployeeIds = [...new Set(employeeIds.map((id) => id.trim()))];
  const uniqueStreams = [...new Set(streams.map((stream) => stream.trim()))];
  const uniqueDepartments = [...new Set(departments.map((department) => department.trim()))];
  const employeeWhere = uniqueEmployeeIds.length
    ? { employeeId: { in: uniqueEmployeeIds } }
    : {
      ...(uniqueStreams.length ? { stream: { in: uniqueStreams } } : {}),
      ...(uniqueDepartments.length ? { department: { in: uniqueDepartments } } : {}),
    };

  try {
    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      orderBy: { employeeId: "asc" },
      select: {
        employeeId: true,
        name: true,
        designation: true,
        stream: true,
        department: true,
        mobileNumber: true,
      },
    });
    const employeeIdsToAggregate = employees.map(({ employeeId }) => employeeId);
    const credits = employeeIdsToAggregate.length
      ? await prisma.leaveCredit.groupBy({
        by: ["employeeId"],
        where: { category: input.category, employeeId: { in: employeeIdsToAggregate } },
        _sum: { days: true },
      })
      : [];
    const daysByEmployeeId = new Map(credits.map(({ employeeId, _sum }) => [employeeId, _sum.days ?? 0]));
    return Response.json({
      rows: employees.map((employee) => ({
        ...employee,
        creditedDays: daysByEmployeeId.get(employee.employeeId) ?? 0,
      })),
    });
  } catch (error) {
    console.error("Failed to generate credit leave report:", error);
    return Response.json({ error: "Unable to generate the credit leave report." }, { status: 503 });
  }
}
