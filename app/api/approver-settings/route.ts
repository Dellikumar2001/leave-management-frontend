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
      secondLevelApprover: emp.approverSettings?.secondLevelApprover?.trim() || null,
      finalLevelApprover: emp.approverSettings?.finalLevelApprover?.trim() || null,
      backupOfficer: emp.approverSettings?.backupOfficer?.trim() || null,
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
    const { employeeId, employeeIds, firstLevelApprover, secondLevelApprover, finalLevelApprover, backupOfficer } = body;

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

    const hasFirst = Object.prototype.hasOwnProperty.call(body, "firstLevelApprover");
    const hasSecond = Object.prototype.hasOwnProperty.call(body, "secondLevelApprover");
    const hasFinal = Object.prototype.hasOwnProperty.call(body, "finalLevelApprover");
    const hasBackup = Object.prototype.hasOwnProperty.call(body, "backupOfficer");

    const cleanStr = (val: unknown) => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const firstVal = cleanStr(firstLevelApprover);
    const secondVal = cleanStr(secondLevelApprover);
    const finalVal = cleanStr(finalLevelApprover);
    const backupVal = cleanStr(backupOfficer);

    if (!firstVal && !secondVal && !finalVal && !backupVal) {
      return Response.json(
        { error: "Please select at least one approver or backup officer." },
        { status: 400 }
      );
    }

    const records = await Promise.all(
      targetIds.map(async (id) => {
        let existingFirst: string | null = null;
        let existingSecond: string | null = null;
        let existingFinal: string | null = null;
        let existingBackup: string | null = null;

        try {
          const existing = await prisma.employeeApprover.findUnique({
            where: { employeeId: id },
          });
          if (existing) {
            existingFirst = existing.firstLevelApprover ?? null;
            existingSecond = existing.secondLevelApprover ?? null;
            existingFinal = existing.finalLevelApprover ?? null;
            existingBackup = existing.backupOfficer ?? null;
          }
        } catch {
          const rawExisting = await prisma.$queryRawUnsafe<
            Array<{
              first_level_approver: string | null;
              second_level_approver: string | null;
              final_level_approver: string | null;
              backup_officer: string | null;
            }>
          >(
            `SELECT first_level_approver, second_level_approver, final_level_approver, backup_officer FROM employee_approvers WHERE employee_id = $1 LIMIT 1`,
            id
          ).catch(() => null);

          if (rawExisting && rawExisting[0]) {
            existingFirst = rawExisting[0].first_level_approver ?? null;
            existingSecond = rawExisting[0].second_level_approver ?? null;
            existingFinal = rawExisting[0].final_level_approver ?? null;
            existingBackup = rawExisting[0].backup_officer ?? null;
          }
        }

        const newFirstLevel = hasFirst ? firstVal : existingFirst;
        const newSecondLevel = hasSecond ? secondVal : existingSecond;
        const newFinalLevel = hasFinal ? finalVal : existingFinal;
        const newBackup = hasBackup ? backupVal : existingBackup;

        try {
          return await prisma.employeeApprover.upsert({
            where: { employeeId: id },
            create: {
              employeeId: id,
              firstLevelApprover: newFirstLevel,
              secondLevelApprover: newSecondLevel,
              finalLevelApprover: newFinalLevel,
              backupOfficer: newBackup,
            },
            update: {
              firstLevelApprover: newFirstLevel,
              secondLevelApprover: newSecondLevel,
              finalLevelApprover: newFinalLevel,
              backupOfficer: newBackup,
              updatedAt: new Date(),
            },
          });
        } catch (upsertError) {
          console.warn("Prisma upsert fallback to SQL:", upsertError);
          await prisma.$executeRawUnsafe(
            `INSERT INTO employee_approvers (employee_id, first_level_approver, second_level_approver, final_level_approver, backup_officer, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (employee_id)
             DO UPDATE SET
               first_level_approver = EXCLUDED.first_level_approver,
               second_level_approver = EXCLUDED.second_level_approver,
               final_level_approver = EXCLUDED.final_level_approver,
               backup_officer = EXCLUDED.backup_officer,
               updated_at = NOW();`,
            id,
            newFirstLevel,
            newSecondLevel,
            newFinalLevel,
            newBackup
          );

          return {
            id: 0,
            employeeId: id,
            firstLevelApprover: newFirstLevel,
            secondLevelApprover: newSecondLevel,
            finalLevelApprover: newFinalLevel,
            backupOfficer: newBackup,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      })
    );

    return Response.json({
      success: true,
      records: records.map((record) => ({
        employeeId: record.employeeId,
        firstLevelApprover: record.firstLevelApprover,
        secondLevelApprover: record.secondLevelApprover,
        finalLevelApprover: record.finalLevelApprover,
        backupOfficer: record.backupOfficer,
        updatedAt: record.updatedAt,
      })),
      record: records[0]
        ? {
            employeeId: records[0].employeeId,
            firstLevelApprover: records[0].firstLevelApprover,
            secondLevelApprover: records[0].secondLevelApprover,
            finalLevelApprover: records[0].finalLevelApprover,
            backupOfficer: records[0].backupOfficer,
            updatedAt: records[0].updatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to assign approvers:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save approver assignment.",
      },
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
