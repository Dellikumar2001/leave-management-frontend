import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { employeeId: "asc" },
      include: {
        approverSettings: true,
      },
    });

    const formattedEmployees = employees.map((emp) => ({
      employeeId: emp.employeeId,
      name: emp.name,
      stream: emp.stream,
      department: emp.department,
      gender: emp.gender,
      designation: emp.designation,
      firstLevelApprover: emp.approverSettings?.firstLevelApprover?.trim() || null,
      finalLevelApprover: emp.approverSettings?.finalLevelApprover?.trim() || null,
      updatedAt: emp.approverSettings?.updatedAt || null,
    }));

    // List of potential approvers for dropdowns
    const approverOptions = employees.map((emp) => ({
      employeeId: emp.employeeId,
      name: emp.name,
      department: emp.department,
      stream: emp.stream,
      label: emp.name,
    }));

    return Response.json({
      employees: formattedEmployees,
      approverOptions,
    });
  } catch (error) {
    console.error("Failed to load approver settings:", error);
    return Response.json(
      { error: "Unable to load approver settings from the database." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, employeeIds, firstLevelApprover, finalLevelApprover } = body;

    let targetIds: string[] = [];
    if (Array.isArray(employeeIds)) {
      targetIds = employeeIds
        .filter((id) => typeof id === "string" && id.trim())
        .map((id) => id.trim());
    } else if (employeeId && typeof employeeId === "string" && employeeId.trim()) {
      targetIds = [employeeId.trim()];
    }

    if (targetIds.length === 0) {
      return Response.json(
        { error: "At least one Employee ID is required." },
        { status: 400 }
      );
    }

    if (
      !firstLevelApprover ||
      typeof firstLevelApprover !== "string" ||
      !firstLevelApprover.trim()
    ) {
      return Response.json(
        { error: "First level approver is required." },
        { status: 400 }
      );
    }

    if (
      !finalLevelApprover ||
      typeof finalLevelApprover !== "string" ||
      !finalLevelApprover.trim()
    ) {
      return Response.json(
        { error: "Final level approver is required." },
        { status: 400 }
      );
    }

    const records = await Promise.all(
      targetIds.map((id) =>
        prisma.employeeApprover.upsert({
          where: { employeeId: id },
          create: {
            employeeId: id,
            firstLevelApprover: firstLevelApprover.trim(),
            finalLevelApprover: finalLevelApprover.trim(),
          },
          update: {
            firstLevelApprover: firstLevelApprover.trim(),
            finalLevelApprover: finalLevelApprover.trim(),
            updatedAt: new Date(),
          },
        })
      )
    );

    return Response.json({
      success: true,
      records: records.map((record) => ({
        employeeId: record.employeeId,
        firstLevelApprover: record.firstLevelApprover,
        finalLevelApprover: record.finalLevelApprover,
        updatedAt: record.updatedAt,
      })),
      record: records[0]
        ? {
            employeeId: records[0].employeeId,
            firstLevelApprover: records[0].firstLevelApprover,
            finalLevelApprover: records[0].finalLevelApprover,
            updatedAt: records[0].updatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to assign approvers:", error);
    return Response.json(
      { error: "Unable to save approver assignment." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return Response.json({ error: "Employee ID is required." }, { status: 400 });
    }

    await prisma.employeeApprover.deleteMany({
      where: { employeeId: employeeId.trim() },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete approver settings:", error);
    return Response.json(
      { error: "Unable to delete approver settings." },
      { status: 500 }
    );
  }
}
