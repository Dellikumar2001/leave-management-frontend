import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!Number.isInteger(id) || id < 1 || !name || !code || typeof body.isPaid !== "boolean") {
    return Response.json({ error: "A valid category name, code, and paid status are required." }, { status: 400 });
  }

  if (body.status !== undefined && !["ACTIVE", "INACTIVE"].includes(body.status)) {
    return Response.json({ error: "Status must be ACTIVE or INACTIVE." }, { status: 400 });
  }

  try {
    const category = await prisma.leaveCategoryMaster.update({
      where: { id },
      data: {
        name,
        code,
        isPaid: body.isPaid,
        description: typeof body.description === "string" ? body.description.trim() || null : null,
        status: body.status ?? "ACTIVE",
      },
    });

    return Response.json({ data: category });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "P2002") {
        return Response.json({ error: "A category with this code already exists." }, { status: 409 });
      }
      if (error.code === "P2025") {
        return Response.json({ error: "Leave category not found." }, { status: 404 });
      }
    }

    return Response.json({ error: "Unable to update leave category." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isInteger(id) || id < 1) {
    return Response.json({ error: "Invalid leave category id." }, { status: 400 });
  }

  try {
    const category = await prisma.leaveCategoryMaster.findUnique({ where: { id } });

    if (!category) {
      return Response.json({ error: "Leave category not found." }, { status: 404 });
    }

    if (category.status === "INACTIVE") {
      return Response.json({ error: "Inactive leave categories cannot be deleted." }, { status: 400 });
    }

    await prisma.leaveCategoryMaster.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return Response.json({ error: "Leave category not found." }, { status: 404 });
    }

    return Response.json({ error: "Unable to delete leave category." }, { status: 500 });
  }
}