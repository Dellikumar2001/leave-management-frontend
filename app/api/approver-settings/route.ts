import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    let employeesWithApprovers: Array<{
      employeeId: string;
      name: string;
      stream: string;
      department: string;
      gender: string;
      designation: string | null;
      approverSettings?: {
        firstLevelApprover?: string | null;
        finalLevelApprover?: string | null;
        updatedAt?: Date | null;
      } | null;
    }> = [];

    try {
      employeesWithApprovers = await prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
        include: {
          approverSettings: true,
        },
      });
    } catch (primaryErr) {
      console.warn("Falling back to raw query for approverSettings:", primaryErr);
      const emps = await prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
      });
      const rawApprovers = await prisma.$queryRaw<
        {
          employee_id: string;
          first_level_approver: string | null;
          final_level_approver: string | null;
          updated_at: Date | null;
        }[]
      >`
        SELECT employee_id, first_level_approver, final_level_approver, updated_at
        FROM employee_approvers
      `.catch(() => []);

      const approverMap = new Map(
        rawApprovers.map((a) => [
          a.employee_id,
          {
            firstLevelApprover: a.first_level_approver,
            finalLevelApprover: a.final_level_approver,
            updatedAt: a.updated_at,
          },
        ])
      );

      employeesWithApprovers = emps.map((emp) => ({
        ...emp,
        approverSettings: approverMap.get(emp.employeeId) || null,
      }));
    }

    const formattedEmployees = employeesWithApprovers.map((emp) => ({
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
    const approverOptions = employeesWithApprovers.map((emp) => ({
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
      {
        error: "Unable to load approver settings from the database.",
        details: error instanceof Error ? error.message : String(error),
      },
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

    let records: Array<{
      employeeId: string;
      firstLevelApprover: string;
      finalLevelApprover: string;
      updatedAt: Date;
    }> = [];

    try {
      records = await Promise.all(
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
    } catch (primaryErr) {
      console.warn("Falling back to raw query for employeeApprover upsert:", primaryErr);
      const now = new Date();
      await Promise.all(
        targetIds.map((id) =>
          prisma.$executeRaw`
            INSERT INTO employee_approvers (employee_id, first_level_approver, final_level_approver, created_at, updated_at)
            VALUES (${id}, ${firstLevelApprover.trim()}, ${finalLevelApprover.trim()}, ${now}, ${now})
            ON CONFLICT (employee_id)
            DO UPDATE SET
              first_level_approver = ${firstLevelApprover.trim()},
              final_level_approver = ${finalLevelApprover.trim()},
              updated_at = ${now}
          `
        )
      );

      records = targetIds.map((id) => ({
        employeeId: id,
        firstLevelApprover: firstLevelApprover.trim(),
        finalLevelApprover: finalLevelApprover.trim(),
        updatedAt: now,
      }));
    }

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

    try {
      await prisma.employeeApprover.deleteMany({
        where: { employeeId: employeeId.trim() },
      });
    } catch {
      await prisma.$executeRaw`
        DELETE FROM employee_approvers WHERE employee_id = ${employeeId.trim()}
      `;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete approver settings:", error);
    return Response.json(
      { error: "Unable to delete approver settings." },
      { status: 500 }
    );
  }
}
