import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const eligibilities = await prisma.leaveEligibility.findMany({ orderBy: { id: "desc" } });
    return Response.json(eligibilities);
  } catch (error) {
    console.error("Failed to load leave eligibility configurations:", error);
    return Response.json({ error: "Unable to load leave eligibility." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Please provide valid eligibility details." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const eligibilityName = typeof input.eligibilityName === "string" ? input.eligibilityName.trim() : "";
  const employeeType = typeof input.employeeType === "string" ? input.employeeType.trim() : "";
  const employmentType = typeof input.employmentType === "string" ? input.employmentType.trim() : "";
  const leaveGroup = typeof input.leaveGroup === "string" ? input.leaveGroup.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const managementStream = typeof input.managementStream === "string" ? input.managementStream.trim() : "";

  if (!eligibilityName || !employeeType || !employmentType || !leaveGroup || eligibilityName.length > 120 || description.length > 500) {
    return Response.json({ error: "Provide a name, employee type, employment type, and leave group. Text limits: name 120, description 500 characters." }, { status: 400 });
  }

  try {
    const eligibility = await prisma.leaveEligibility.create({
      data: { eligibilityName, description, employeeType, employmentType, managementStream, leaveGroup },
    });
    return Response.json(eligibility, { status: 201 });
  } catch (error) {
    console.error("Failed to create leave eligibility configuration:", error);
    return Response.json({ error: "Unable to save leave eligibility. Check the database connection and table setup." }, { status: 503 });
  }
}