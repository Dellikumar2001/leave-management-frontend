import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.leaveCategoryMaster.findMany({
    orderBy: { name: "asc" },
  });

  return Response.json({ data: categories });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!name || !code || typeof body.isPaid !== "boolean") {
    return Response.json({ error: "Name, code, and paid status are required." }, { status: 400 });
  }

  if (body.status !== undefined && !["ACTIVE", "INACTIVE"].includes(body.status)) {
    return Response.json({ error: "Status must be ACTIVE or INACTIVE." }, { status: 400 });
  }

  try {
    const category = await prisma.leaveCategoryMaster.create({
      data: {
        name,
        code,
        isPaid: body.isPaid,
        description: typeof body.description === "string" ? body.description.trim() || null : null,
        status: body.status ?? "ACTIVE",
      },
    });

    return Response.json({ data: category }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return Response.json({ error: "A category with this code already exists." }, { status: 409 });
    }

    return Response.json({ error: "Unable to create leave category." }, { status: 500 });
  }
}