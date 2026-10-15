import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

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
  try {
    const groups = await prisma.leaveGroup.findMany({
      include: {
        category: true,
        items: {
          include: {
            leaveType: true,
          },
        },
      },
      orderBy: {
        effectiveFrom: "desc",
      },
    });
    return Response.json({ data: groups });
  } catch (error) {
    console.error("Failed to load leave requests:", error);
    return Response.json({ error: "Unable to load leave requests. Check the database connection." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body is missing or not valid JSON." }, { status: 400 });
  }

  try {
    const b = body as Record<string, unknown>;
    const selectedCodes = Array.isArray(b.leaveTypeCodes)
      ? [...new Set(b.leaveTypeCodes.map((code: unknown) => String(code)))] as string[]
      : [];
    const categoryId = b.categoryId ? Number(b.categoryId) : null;

    // Previously mandatory validation:
    // if (!b.code || !b.name || !b.effectiveFrom || !Number.isInteger(categoryId) || categoryId <= 0) {
    //   return Response.json({ error: "Code, name, category, and effective from are required." }, { status: 400 });
    // }

    // Code and effective from remain required, while name, category, and leave types are optional:
    if (!b.code || !b.effectiveFrom) {
      return Response.json({ error: "Code and effective from are required." }, { status: 400 });
    }

    let category = null;
    if (categoryId && Number.isInteger(categoryId) && categoryId > 0) {
      category = await prisma.leaveCategoryMaster.findFirst({
        where: { id: categoryId, status: "ACTIVE" },
      });
      if (!category) {
        return Response.json({ error: "Select an active leave category." }, { status: 400 });
      }
    }

    const leaveTypes = selectedCodes.length > 0
      ? await prisma.leaveType.findMany({
          where: {
            status: "ACTIVE",
            code: {
              in: selectedCodes,
            },
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
        code: String(b.code).trim(),
        name: b.name ? String(b.name).trim() : "",
        description: b.description ? String(b.description).trim() : null,
        ...(category ? { category: { connect: { id: category.id } } } : {}),
        effectiveFrom,
        status,
        items: {
          create: leaveTypes.map((leaveType: (typeof leaveTypes)[number]) => ({
            leaveType: {
              connect: { id: leaveType.id },
            },
          })),
        },
      },
      include: {
        category: true,
        items: {
          include: {
            leaveType: true,
          },
        },
      },
    });

    return Response.json({ data: leaveGroup }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create leave group.";
    return Response.json({ error: message }, { status: 400 });
  }
}
