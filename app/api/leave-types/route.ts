import { prisma } from "@/lib/prisma";
import { parseLeaveTypeInput, serializeLeaveType } from "@/lib/leave-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status")?.toUpperCase();
  if (status && status !== "ALL" && status !== "ACTIVE" && status !== "INACTIVE") {
    return Response.json({ error: "Invalid status filter." }, { status: 400 });
  }

  try {
    const leaveTypes = await prisma.leaveType.findMany({
      where: status && status !== "ALL" ? { status } : undefined,
      orderBy: { id: "desc" },
    });
    return Response.json(leaveTypes.map(serializeLeaveType));
  } catch (error) {
    console.error("Failed to load leave types:", error);
    return Response.json({ error: "Unable to load leave types. Check the database connection and table setup." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = parseLeaveTypeInput(body);
  if (!input) return Response.json({ error: "Please provide valid leave type details." }, { status: 400 });

  try {
    const leaveType = await prisma.leaveType.create({ data: input });
    return Response.json(serializeLeaveType(leaveType), { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      return Response.json({ error: "A leave type with this code already exists." }, { status: 409 });
    }
    console.error("Failed to create leave type:", error);
    return Response.json({ error: "Unable to save the leave type." }, { status: 503 });
  }
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}