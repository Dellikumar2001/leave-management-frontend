import { prisma } from "@/lib/prisma";
import { parseLeaveGroupCategoryIds } from "@/lib/leave-group-categories";

const MIN_EFFECTIVE_FROM = "2000-01-01";
const MAX_EFFECTIVE_FROM = "2100-12-31";

function getEffectiveFromDate(value: unknown): Date {
  if (typeof value !== "string") {
    throw new Error("Effective from is required.");
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("Effective from must be a valid date in YYYY-MM-DD format.");
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Effective from is not a valid date.");
  }

  const minDate = new Date(`${MIN_EFFECTIVE_FROM}T00:00:00.000Z`);
  const maxDate = new Date(`${MAX_EFFECTIVE_FROM}T00:00:00.000Z`);

  if (parsed < minDate || parsed > maxDate) {
    throw new Error(`Effective from must be between ${MIN_EFFECTIVE_FROM} and ${MAX_EFFECTIVE_FROM}.`);
  }

  return parsed;
}

function normalizeStatus(value: unknown): "ACTIVE" | "INACTIVE" {
  const status = String(value ?? "ACTIVE").trim().toUpperCase();

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    throw new Error("Status must be ACTIVE or INACTIVE.");
  }

  return status as "ACTIVE" | "INACTIVE";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const group = await prisma.leaveGroup.findUnique({
    where: { id: Number(id) },
    include: {
      category: true,
      categories: { include: { category: true } },
      items: {
        include: {
          leaveType: true,
        },
      },
    },
  });

  if (!group) {
    return Response.json({ error: "Leave group not found." }, { status: 404 });
  }

  return Response.json({ data: group });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const leaveGroupId = Number(id);
    const existingGroup = await prisma.leaveGroup.findUnique({
      where: { id: leaveGroupId },
    });

    if (!existingGroup) {
      return Response.json({ error: "Leave group not found." }, { status: 404 });
    }

    if (body.code) {
      const nextCode = String(body.code).trim().toUpperCase();
      const duplicate = await prisma.leaveGroup.findFirst({
        where: {
          code: nextCode,
          NOT: { id: leaveGroupId },
        },
      });
      if (duplicate) {
        return Response.json({ error: `A leave group with code "${nextCode}" already exists.` }, { status: 400 });
      }
    }

    const effectiveFrom = getEffectiveFromDate(body.effectiveFrom);
    const status = normalizeStatus(body.status);
    let categoryIds: number[];
    if (body.categoryIds !== undefined) {
      const parsedCategoryIds = parseLeaveGroupCategoryIds(body.categoryIds);
      if (!parsedCategoryIds) {
        return Response.json({ error: "Select valid leave categories." }, { status: 400 });
      }
      categoryIds = parsedCategoryIds;
    } else if (body.categoryId !== undefined) {
      if (body.categoryId === null || body.categoryId === "") {
        categoryIds = [];
      } else {
        const parsedCategoryIds = parseLeaveGroupCategoryIds([body.categoryId]);
        if (!parsedCategoryIds) {
          return Response.json({ error: "Select a valid leave category." }, { status: 400 });
        }
        categoryIds = parsedCategoryIds;
      }
    } else {
      const existingCategories = await prisma.leaveGroupCategory.findMany({
        where: { leaveGroupId },
        select: { categoryId: true },
      });
      categoryIds = existingCategories.length
        ? existingCategories.map(({ categoryId }) => categoryId)
        : existingGroup.categoryId ? [existingGroup.categoryId] : [];
    }
    const leaveTypeCodes = Array.isArray(body.leaveTypeCodes)
      ? [...new Set<string>(body.leaveTypeCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean))]
      : [];

    const categories = categoryIds.length
      ? await prisma.leaveCategoryMaster.findMany({
          where: { id: { in: categoryIds }, status: "ACTIVE" },
          select: { id: true },
        })
      : [];
    if (categories.length !== categoryIds.length) {
      return Response.json({ error: "Select active leave categories only." }, { status: 400 });
    }

    const leaveTypes = leaveTypeCodes.length
      ? await prisma.leaveType.findMany({
          where: {
            status: { in: ["ACTIVE", "Active", "active"] },
            OR: leaveTypeCodes.map((itemCode) => ({
              code: { equals: itemCode, mode: "insensitive" },
            })),
          },
        })
      : ([] as Awaited<ReturnType<typeof prisma.leaveType.findMany>>);
    if (leaveTypes.length !== leaveTypeCodes.length) {
      return Response.json({ error: "Select active leave types only." }, { status: 400 });
    }

    const updatedGroup = await prisma.leaveGroup.update({
      where: { id: leaveGroupId },
      data: {
        code: String(body.code ?? existingGroup.code).trim().toUpperCase(),
        name: String(body.name ?? existingGroup.name).trim().toUpperCase(),
        description: body.description !== undefined ? String(body.description).trim().toUpperCase() || null : existingGroup.description,
        categoryId: categories[0]?.id ?? null,
        categories: {
          deleteMany: {},
          create: categories.map(({ id }) => ({
            category: { connect: { id } },
          })),
        },
        effectiveFrom,
        status,
        items: {
          deleteMany: {},
          create: leaveTypes.map((leaveType) => ({
            leaveType: {
              connect: { id: leaveType.id },
            },
          })),
        },
      },
      include: {
        category: true,
        categories: { include: { category: true } },
        items: {
          include: {
            leaveType: true,
          },
        },
      },
    });

    return Response.json({ data: updatedGroup });
  } catch (error) {
    console.error("Error updating leave group:", error);
    let message = "Failed to update leave group.";
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint failed") || error.message.includes("P2002")) {
        message = "A leave group with this code already exists.";
      } else {
        message = error.message;
      }
    }
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leaveGroupId = Number(id);

    const leaveGroup = await prisma.leaveGroup.findUnique({
      where: { id: leaveGroupId },
    });

    if (!leaveGroup) {
      return Response.json({ error: "Leave group not found." }, { status: 404 });
    }

    if (leaveGroup.status === "INACTIVE") {
      return Response.json({ error: "Inactive leave groups cannot be deleted." }, { status: 400 });
    }

    await prisma.leaveGroup.delete({
      where: { id: leaveGroupId },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting leave group:", error);
    const message = error instanceof Error ? error.message : "Failed to delete leave group.";
    return Response.json({ error: message }, { status: 400 });
  }
}
