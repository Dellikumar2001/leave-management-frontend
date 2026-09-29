import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const leaveTypes = await prisma.leaveType.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return Response.json({ data: leaveTypes });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const leaveType = await prisma.leaveType.create({
    data: {
      code: body.code,
      name: body.name,
      category: body.category,
      days: Number(body.days),
      description: body.description ?? null,
      status: body.status ?? "ACTIVE",
      applicableTo: Array.isArray(body.applicableTo) ? body.applicableTo : [body.applicableTo ?? "STUDENT"],
    },
  });

  return Response.json({ data: leaveType }, { status: 201 });
}
