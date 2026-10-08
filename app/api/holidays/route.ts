import { prisma } from "@/lib/prisma";
import { hasPrismaErrorCode, parseHolidayInput, serializeHoliday } from "@/lib/holiday-records";

export const runtime = "nodejs";

export async function GET() {
  try {
    const holidays = await prisma.holiday.findMany({ orderBy: [{ date: "asc" }, { id: "asc" }] });
    return Response.json(holidays.map(serializeHoliday));
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
    const rawText = await request.text();
    if (!rawText || !rawText.trim()) {
      return Response.json({ error: "Empty request payload received." }, { status: 400 });
    }
    body = JSON.parse(rawText);
  } catch (err) {
    console.error("Failed to parse JSON body in /api/holidays:", err);
    return Response.json({ error: "Invalid JSON body format." }, { status: 400 });
  }

  const isBatch = Array.isArray(body);
  const values: unknown[] = isBatch ? (body as unknown[]) : [body];

  if (values.length === 0) {
    return Response.json({ error: "No holiday records provided." }, { status: 400 });
  }

  const inputs = values.map((val) => parseHolidayInput(val));
  if (inputs.some((input) => input === null)) {
    return Response.json({ error: "Please provide valid holiday details." }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(
      inputs.map((input) => prisma.holiday.create({ data: input! }))
    );
    const result = created.map(serializeHoliday);
    return Response.json(isBatch ? result : result[0], { status: 201 });
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