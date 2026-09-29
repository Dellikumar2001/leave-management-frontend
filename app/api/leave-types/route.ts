import { prisma } from "@/lib/prisma";
import { parseLeaveTypeInput } from "@/lib/leave-types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await prisma.leaveType.findMany({ orderBy: { id: "desc" } });
    return Response.json(result.map(serializeLeaveType));
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
    const result = await prisma.leaveType.create({
      data: input,
    });
    return Response.json(serializeLeaveType(result), { status: 201 });
  } catch (error) {
    if (isDuplicateCode(error)) return Response.json({ error: "A leave type with this code already exists." }, { status: 409 });
    console.error("Failed to create leave type:", error);
    return Response.json({ error: "Unable to save the leave type." }, { status: 503 });
  }
}

function isDuplicateCode(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function serializeLeaveType<T>(leaveType: T) {
  return leaveType;
}