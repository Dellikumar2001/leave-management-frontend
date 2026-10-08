import { prisma } from "@/lib/prisma";
import {
  hasPrismaErrorCode,
  parseHolidayInput,
  serializeHoliday,
} from "@/lib/holiday-records";
import type { HolidayRecord } from "@/lib/holiday-records";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Invalid holiday ID." }, { status: 400 });

  try {
    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday) return Response.json({ error: "Holiday not found." }, { status: 404 });
    return Response.json(serializeHoliday(holiday as HolidayRecord));
  } catch (error) {
    console.error("Failed to load holiday:", error);
    return Response.json({ error: "Unable to load the holiday record." }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Invalid holiday ID." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = parseHolidayInput(body);
  if (!input) return Response.json({ error: "Please provide valid holiday details." }, { status: 400 });

  try {
    const holiday = await prisma.holiday.update({ where: { id }, data: input });
    return Response.json(serializeHoliday(holiday as HolidayRecord));
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2025")) return Response.json({ error: "Holiday not found." }, { status: 404 });
    console.error("Failed to update holiday:", error);
    return Response.json({ error: "Unable to update the holiday record." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Invalid holiday ID." }, { status: 400 });

  try {
    await prisma.holiday.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2025")) return Response.json({ error: "Holiday not found." }, { status: 404 });
    console.error("Failed to delete holiday:", error);
    return Response.json({ error: "Unable to delete the holiday record." }, { status: 503 });
  }
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}