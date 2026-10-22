import { NextRequest } from "next/server";

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

export async function GET() {
  const query = () =>
    prisma.leaveGroup.findMany({
      include: {
        category: true,
        categories: { include: { category: true } },
        items: {
          include: {
            leaveType: true,
          },
        },
      },
      orderBy: { effectiveFrom: "desc" },
    });

  try {
    const groups = await query();
    return Response.json({ data: groups });
  } catch (firstErr) {
    // Retry once after a short delay — handles cold-start connection issues.
    console.warn("Leave-groups first attempt failed, retrying in 300ms:", firstErr instanceof Error ? firstErr.message : firstErr);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const groups = await query();
      return Response.json({ data: groups });
    } catch (error) {
      console.error("Failed to load leave groups:", error);
      return Response.json({ error: "Unable to load leave groups from the database." }, { status: 503 });
    }
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const b = body;

    const code = typeof b.code === "string" ? b.code.trim().toUpperCase() : "";
    if (!code) {
      return Response.json({ error: "Group code is required." }, { status: 400 });
    }

    if (!b.effectiveFrom) {
      return Response.json({ error: "From date is required." }, { status: 400 });
    }

    const existingGroup = await prisma.leaveGroup.findUnique({
      where: { code },
    });
    if (existingGroup) {
      return Response.json({ error: `A leave group with code "${code}" already exists.` }, { status: 400 });
    }

    const selectedCodes = Array.isArray(b.leaveTypeCodes)
      ? [...new Set(b.leaveTypeCodes.map((c: unknown) => String(c).trim().toUpperCase()).filter(Boolean))]
      : [];

    const categoryIds = b.categoryIds !== undefined
      ? parseLeaveGroupCategoryIds(b.categoryIds)
      : b.categoryId === undefined || b.categoryId === null || b.categoryId === ""
        ? []
        : parseLeaveGroupCategoryIds([b.categoryId]);

    if (!categoryIds) {
      return Response.json({ error: "Select valid leave categories." }, { status: 400 });
    }

    const categories = categoryIds.length
      ? await prisma.leaveCategoryMaster.findMany({
          where: { id: { in: categoryIds }, status: "ACTIVE" },
          select: { id: true },
        })
      : [];
    if (categories.length !== categoryIds.length) {
      return Response.json({ error: "Select active leave categories only." }, { status: 400 });
    }

    const leaveTypes = selectedCodes.length > 0
      ? await prisma.leaveType.findMany({
          where: {
            status: { in: ["ACTIVE", "Active", "active"] },
            OR: selectedCodes.map((itemCode) => ({
              code: { equals: itemCode, mode: "insensitive" },
            })),
          },
        })
      : [];
    if (selectedCodes.length > 0 && leaveTypes.length !== selectedCodes.length) {
      return Response.json({ error: "Select active leave types only." }, { status: 400 });
    }

    const effectiveFrom = getEffectiveFromDate(b.effectiveFrom);
    const status = normalizeStatus(b.status);

    const leaveGroup = await prisma.leaveGroup.create({
      data: {
        code,
        name: typeof b.name === "string" ? b.name.trim().toUpperCase() : "",
        description: typeof b.description === "string" && b.description.trim() ? b.description.trim().toUpperCase() : null,
        categoryId: categories[0]?.id ?? null,
        categories: {
          create: categories.map(({ id }) => ({
            category: { connect: { id } },
          })),
        },
        effectiveFrom,
        status,
        items: {
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

    return Response.json({ data: leaveGroup }, { status: 201 });
  } catch (error) {
    console.error("Error creating leave group:", error);
    let message = "Failed to create leave group.";
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