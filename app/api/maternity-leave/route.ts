import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type MaternityLeaveInput = {
  employeeId: string;
  noOfDays: number;
  remarks: string;
};

export async function GET() {
  try {
    const records = await prisma.maternityLeave.findMany({
      orderBy: { employeeName: "asc" },
    });

    return Response.json({ records: records.map(serializeRecord) });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2021")) {
      return Response.json({ error: "Maternity leave table is not set up. Run npm run db:migrate." }, { status: 503 });
    }
    console.error("Failed to load maternity leave records:", error);
    return Response.json({ error: "Unable to load maternity leave records." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = parseMaternityLeaveInput(body);
  if (!input) {
    return Response.json({ error: "Employee ID, a positive number of days, and remarks are required." }, { status: 400 });
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { employeeId: input.employeeId },
      select: { name: true },
    });
    if (!employee) {
      return Response.json({ error: "Employee not found." }, { status: 404 });
    }

    const record = await prisma.maternityLeave.upsert({
      where: { employeeId: input.employeeId },
      create: {
        employeeId: input.employeeId,
        employeeName: employee.name,
        noOfDays: input.noOfDays,
        remarks: input.remarks,
      },
      update: {
        employeeName: employee.name,
        noOfDays: input.noOfDays,
        remarks: input.remarks,
      },
    });

    return Response.json({ record: serializeRecord(record) }, { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2021")) {
      return Response.json({ error: "Maternity leave table is not set up. Run npm run db:migrate." }, { status: 503 });
    }
    console.error("Failed to save maternity leave record:", error);
    return Response.json({ error: "Unable to save the maternity leave record." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const employeeId = new URL(request.url).searchParams.get("employeeId")?.trim();
  if (!employeeId) {
    return Response.json({ error: "Employee ID is required." }, { status: 400 });
  }

  try {
    const result = await prisma.maternityLeave.deleteMany({ where: { employeeId } });
    return Response.json({ deletedCount: result.count });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2021")) {
      return Response.json({ error: "Maternity leave table is not set up. Run npm run db:migrate." }, { status: 503 });
    }
    console.error("Failed to delete maternity leave record:", error);
    return Response.json({ error: "Unable to delete the maternity leave record." }, { status: 503 });
  }
}

function parseMaternityLeaveInput(value: unknown): MaternityLeaveInput | null {
  if (!value || typeof value !== "object") return null;

  const body = value as Record<string, unknown>;
  const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
  const noOfDays = Number(body.noOfDays);
  const remarks = typeof body.remarks === "string" ? body.remarks.trim() : "";

  if (!employeeId || !Number.isSafeInteger(noOfDays) || noOfDays <= 0 || !remarks) return null;
  return { employeeId, noOfDays, remarks };
}

function serializeRecord(record: {
  employeeId: string;
  employeeName: string;
  noOfDays: number;
  remarks: string | null;
  status?: string;
}) {
  return {
    ...record,
    remarks: record.remarks ?? "",
    status: "Active" as const,
  };
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
