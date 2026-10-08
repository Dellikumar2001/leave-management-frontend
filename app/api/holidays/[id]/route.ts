import { prisma } from "@/lib/prisma";
import {
  hasPrismaErrorCode,
  parseHolidayInput,
  serializeHoliday,
} from "@/lib/holiday-records";
import type { HolidayRecord } from "@/lib/holiday-records";

export const runtime = "nodejs";

export async function GET() {
  try {
    const holidays = await prisma.holiday.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] });
    return Response.json(holidays.map((holiday) => serializeHoliday(holiday as HolidayRecord)));
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2021")) {
      return Response.json({ error: "Holiday calendar table is not set up. Run npm run db:migrate." }, { status: 503 });
    }
    console.error("Failed to load holidays:", error);
    return Response.json({ error: "Unable to load holiday records from the database." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const isBatch = Array.isArray(body);
  const values = isBatch ? body : [body];
  const inputs = values.map(parseHolidayInput);
  if (inputs.some((input) => input === null)) {
    return Response.json({ error: "Please provide valid holiday details." }, { status: 400 });
  }

  try {
    // If multiple records, insert them while avoiding duplicates
    const results = [];
    for (const input of inputs) {
      if (!input) continue;
      const created = await prisma.holiday.create({ data: input });
      results.push(created);
    }
    const serialized = results.map((record) => serializeHoliday(record as HolidayRecord));
    return Response.json(isBatch ? serialized : serialized[0], { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2021")) {
      return Response.json({ error: "Holiday calendar table is not set up. Run npm run db:migrate." }, { status: 503 });
    }
    console.error("Failed to create holiday records:", error);
    return Response.json({ error: "Unable to save holiday records to the database." }, { status: 503 });
  }
}

export async function DELETE() {
  try {
    const result = await prisma.holiday.deleteMany();
    return Response.json({ deletedCount: result.count });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2021")) {
      return Response.json({ error: "Holiday table is not set up. Run the Prisma migration first." }, { status: 503 });
    }
    console.error("Failed to reset holidays:", error);
    return Response.json({ error: "Unable to reset holiday records." }, { status: 503 });
  }
}