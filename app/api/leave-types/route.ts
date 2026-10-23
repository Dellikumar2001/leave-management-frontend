import { prisma } from "@/lib/prisma";
import { parseLeaveTypeInput, serializeLeaveType } from "@/lib/leave-types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const statusParam = new URL(request.url).searchParams.get("status")?.toUpperCase();
  if (statusParam && statusParam !== "ALL" && statusParam !== "ACTIVE" && statusParam !== "INACTIVE") {
    return Response.json({ error: "Invalid status filter." }, { status: 400 });
  }
  const status = statusParam === "ACTIVE" || statusParam === "INACTIVE" ? statusParam : undefined;

  try {
    const leaveTypes = await prisma.leaveType.findMany({
      where: status ? { status } : undefined,
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
      orderBy: { id: "desc" },
    });
    return Response.json(leaveTypes.map(serializeLeaveType));
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
    const { leaveGroupId, leaveCategoryId, ...leaveTypeData } = input;
    const categoryMaster = leaveCategoryId === undefined
      ? null
      : await prisma.leaveCategoryMaster.findFirst({
          where: { id: leaveCategoryId, status: "ACTIVE" },
          select: { id: true, isPaid: true },
        });

    if (leaveCategoryId !== undefined && !categoryMaster) {
      return Response.json({ error: "Select an active leave category." }, { status: 400 });
    }

    if (categoryMaster && !(body as Record<string, unknown>).paymentType) {
      leaveTypeData.paymentType = categoryMaster.isPaid ? "PAID" : "UNPAID";
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

    const employees = await prisma.employee.findMany({ select: { employeeId: true } });
    const leaveType = await prisma.leaveType.create({
      data: {
        ...leaveTypeData,
        ...(categoryMaster ? { categoryMaster: { connect: { id: categoryMaster.id } } } : {}),
        employeeEligibility: {
          create: employees.map(({ employeeId }) => ({
            employee: { connect: { employeeId } },
            isEligible: leaveTypeData.status === "ACTIVE",
            daysAllowed: leaveTypeData.status === "ACTIVE" ? leaveTypeData.daysAllowed : 0,
          })),
        },
        ...(group
          ? {
              leaveGroup: group.name,
              groupItems: {
                create: {
                  leaveGroup: { connect: { id: group.id } },
                },
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
    return Response.json(serializeLeaveType(leaveType), { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      return Response.json({ error: "A leave type with this code already exists." }, { status: 409 });
    }
    console.error("Failed to create leave type:", error);
    return Response.json({ error: "Unable to save the leave type." }, { status: 503 });
  }
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
