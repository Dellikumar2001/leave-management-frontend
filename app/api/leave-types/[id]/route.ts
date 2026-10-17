import { prisma } from "@/lib/prisma";
import { parseLeaveTypeInput, serializeLeaveType } from "@/lib/leave-types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const id = parseId((await params).id);
  if (id === null) return Response.json({ error: "Invalid leave type ID." }, { status: 400 });

  try {
    const leaveType = await prisma.leaveType.findUnique({
      where: { id },
      include: {
        categoryMaster: {
          select: { id: true, name: true, code: true },
        },
        groupItems: {
          include: {
            leaveGroup: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                category: {
                  select: { id: true, name: true, code: true },
                },
                categories: {
                  select: {
                    categoryId: true,
                    category: { select: { id: true, name: true, code: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
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
    const { leaveGroupId, leaveCategoryId, ...leaveTypeData } = input;
    const categoryMaster = leaveCategoryId === undefined
      ? null
      : await prisma.leaveCategoryMaster.findFirst({
          where: { id: leaveCategoryId, status: "ACTIVE" },
          select: { id: true },
        });

    if (leaveCategoryId !== undefined && !categoryMaster) {
      return Response.json({ error: "Select an active leave category." }, { status: 400 });
    }

    let group = leaveGroupId === undefined
      ? null
      : await prisma.leaveGroup.findFirst({
          where: { id: leaveGroupId, status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            categoryId: true,
            category: { select: { id: true, name: true, code: true } },
            categories: {
              select: {
                categoryId: true,
                category: { select: { id: true, name: true, code: true } },
              },
            },
          },
        });

    if (leaveGroupId !== undefined && !group) {
      return Response.json({ error: "Select an active leave group." }, { status: 400 });
    }

    if (!group && leaveCategoryId !== undefined) {
      group = await prisma.leaveGroup.findFirst({
        where: {
          status: "ACTIVE",
          OR: [
            { categoryId: leaveCategoryId },
            { categories: { some: { categoryId: leaveCategoryId } } },
          ],
        },
        select: {
          id: true,
          name: true,
          categoryId: true,
          category: { select: { id: true, name: true, code: true } },
          categories: {
            select: {
              categoryId: true,
              category: { select: { id: true, name: true, code: true } },
            },
          },
        },
      });
    }

    const leaveType = await prisma.$transaction(async (transaction) => {
      const updatedLeaveType = await transaction.leaveType.update({
        where: { id },
        data: {
          ...leaveTypeData,
          ...(categoryMaster ? { categoryMaster: { connect: { id: categoryMaster.id } } } : {}),
          ...(group
            ? {
                leaveGroup: group.name,
                groupItems: {
                  deleteMany: {},
                  create: {
                    leaveGroup: { connect: { id: group.id } },
                  },
                },
              }
            : leaveGroupId === undefined && leaveCategoryId === undefined
            ? {
                leaveGroup: "",
                groupItems: {
                  deleteMany: {},
                },
              }
            : {}),
        },
        include: {
          categoryMaster: {
            select: { id: true, name: true, code: true },
          },
          groupItems: {
            include: {
              leaveGroup: {
                select: {
                  id: true,
                  name: true,
                  categoryId: true,
                  category: {
                    select: { id: true, name: true, code: true },
                  },
                  categories: {
                    select: {
                      categoryId: true,
                      category: { select: { id: true, name: true, code: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      await transaction.employeeLeaveEligibility.updateMany({
        where: { leaveTypeId: id },
        data: {
          isEligible: leaveTypeData.status === "ACTIVE",
          daysAllowed: leaveTypeData.status === "ACTIVE" ? leaveTypeData.daysAllowed : 0,
        },
      });

      return updatedLeaveType;
    });
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
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.leaveType.findUnique({ where: { id }, select: { status: true } });
      if (!existing) return "not-found";
      if (existing.status.toUpperCase() !== "ACTIVE") return "inactive";

      await transaction.leaveGroupItem.deleteMany({ where: { leaveTypeId: id } });
      await transaction.leaveType.delete({ where: { id } });
      return "deleted";
    });

    if (result === "not-found") return Response.json({ error: "Leave type not found." }, { status: 404 });
    if (result === "inactive") {
      return Response.json({ error: "Inactive leave types cannot be deleted." }, { status: 409 });
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2025")) return Response.json({ error: "Leave type not found." }, { status: 404 });
    if (hasPrismaErrorCode(error, "P2003")) {
      return Response.json(
        { error: "This leave type is still referenced by other records and cannot be deleted." },
        { status: 409 },
      );
    }
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
