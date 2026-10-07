import { prisma } from "@/lib/prisma";
import { parseLeaveTypeInput, serializeLeaveType } from "@/lib/leave-types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Invalid leave type ID." }, { status: 400 });

  try {
    const leaveType = await prisma.leaveType.findUnique({ where: { id } });
    if (!leaveType) return Response.json({ error: "Leave type not found." }, { status: 404 });
    return Response.json(serializeLeaveType(leaveType));
  } catch (error) {
    console.error("Failed to load leave type:", error);
    return Response.json({ error: "Unable to load the leave type." }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Invalid leave type ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = parseLeaveTypeInput(body);
  if (!input) return Response.json({ error: "Please provide valid leave type details." }, { status: 400 });

  try {
    const leaveType = await prisma.leaveType.update({ where: { id }, data: input });
    return Response.json(serializeLeaveType(leaveType));
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      return Response.json({ error: "A leave type with this code already exists." }, { status: 409 });
    }
    if (hasPrismaErrorCode(error, "P2025")) return Response.json({ error: "Leave type not found." }, { status: 404 });
    console.error("Failed to update leave type:", error);
    return Response.json({ error: "Unable to update the leave type." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Invalid leave type ID." }, { status: 400 });

  try {
    const existing = await prisma.leaveType.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return Response.json({ error: "Leave type not found." }, { status: 404 });
    if (existing.status.toUpperCase() !== "ACTIVE") {
      return Response.json({ error: "Inactive leave types cannot be deleted." }, { status: 409 });
    }
    await prisma.leaveType.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2025")) return Response.json({ error: "Leave type not found." }, { status: 404 });
    console.error("Failed to delete leave type:", error);
    return Response.json({ error: "Unable to delete the leave type." }, { status: 503 });
  }
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
