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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const group = await prisma.leaveGroup.findUnique({
    where: { id: Number(id) },
    include: {
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

    const effectiveFrom = getEffectiveFromDate(body.effectiveFrom);
    const status = normalizeStatus(body.status);
    const leaveTypeCodes = Array.isArray(body.leaveTypeCodes) ? body.leaveTypeCodes.map(String) : [];

    const leaveTypes = leaveTypeCodes.length
      ? await prisma.leaveType.findMany({
          where: {
            code: {
              in: leaveTypeCodes,
            },
          },
        })
      : [];

    const updatedGroup = await prisma.leaveGroup.update({
      where: { id: leaveGroupId },
      data: {
        code: String(body.code ?? existingGroup.code).trim(),
        name: String(body.name ?? existingGroup.name).trim(),
        description: body.description !== undefined ? String(body.description).trim() || null : existingGroup.description,
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
        items: {
          include: {
            leaveType: true,
          },
        },
      },
    });

    return Response.json({ data: updatedGroup });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update leave group.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
}
