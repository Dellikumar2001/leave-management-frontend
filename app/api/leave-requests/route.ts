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
  const groups = await prisma.leaveGroup.findMany({
    include: {
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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const selectedCodes = Array.isArray(body.leaveTypeCodes) ? body.leaveTypeCodes : [];

    if (!body.code || !body.name || !body.effectiveFrom) {
      return Response.json({ error: "Code, name, and effective from are required." }, { status: 400 });
    }

    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        code: {
          in: selectedCodes.map((code: string) => String(code)),
        },
      },
    });

    const effectiveFrom = getEffectiveFromDate(body.effectiveFrom);
    const status = normalizeStatus(body.status);

    const leaveGroup = await prisma.leaveGroup.create({
      data: {
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        description: body.description ? String(body.description).trim() : null,
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
