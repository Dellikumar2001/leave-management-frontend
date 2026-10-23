import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [employees, approverRows] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { employeeId: "asc" },
        include: {
          approverSettings: true,
        },
      }),
      prisma.$queryRawUnsafe<
        Array<{
          employee_id: string;
          first_level_approver: string | null;
          final_level_approver: string | null;
          backup_officer: string | null;
          updated_at: Date | null;
        }>
      >(
        `SELECT employee_id, first_level_approver, final_level_approver, backup_officer, updated_at FROM employee_approvers`
      ).catch(() => []),
    ]);

    const approverMap = new Map(approverRows.map((r) => [r.employee_id, r]));

    const formattedEmployees = employees.map((emp) => {
      const setting = emp.approverSettings;
      const raw = approverMap.get(emp.employeeId);

      const firstLevel =
        setting?.firstLevelApprover?.trim() ||
        raw?.first_level_approver?.trim() ||
        null;
      const finalLevel =
        setting?.finalLevelApprover?.trim() ||
        raw?.final_level_approver?.trim() ||
        null;
      const backup =
        setting?.backupOfficer?.trim() ||
        raw?.backup_officer?.trim() ||
        null;
      const updated = setting?.updatedAt || raw?.updated_at || null;

      return {
        employeeId: emp.employeeId,
        name: emp.name,
        stream: emp.stream,
        department: emp.department,
        gender: emp.gender,
        designation: emp.designation,
        firstLevelApprover: firstLevel,
        finalLevelApprover: finalLevel,
        backupOfficer: backup,
        updatedAt: updated,
      };
    });

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
    const { employeeId, employeeIds, firstLevelApprover, finalLevelApprover, backupOfficer } = body;

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
    const hasFinal = Object.prototype.hasOwnProperty.call(body, "finalLevelApprover");
    const hasBackup = Object.prototype.hasOwnProperty.call(body, "backupOfficer");

    const cleanStr = (val: unknown) => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const firstVal = cleanStr(firstLevelApprover);
    const finalVal = cleanStr(finalLevelApprover);
    const backupVal = cleanStr(backupOfficer);

    if (!firstVal && !finalVal && !backupVal) {
      return Response.json(
        { error: "Please select at least one approver or backup officer." },
        { status: 400 }
      );
    }

    const records = await Promise.all(
      targetIds.map(async (id) => {
        let existingFirst: string | null = null;
        let existingFinal: string | null = null;
        let existingBackup: string | null = null;

        try {
          const existing = await prisma.employeeApprover.findUnique({
            where: { employeeId: id },
          });
          if (existing) {
            existingFirst = existing.firstLevelApprover ?? null;
            existingFinal = existing.finalLevelApprover ?? null;
            existingBackup = existing.backupOfficer ?? null;
          }
        } catch {
          const rawExisting = await prisma.$queryRawUnsafe<
            Array<{
              first_level_approver: string | null;
              final_level_approver: string | null;
              backup_officer: string | null;
            }>
          >(
            `SELECT first_level_approver, final_level_approver, backup_officer FROM employee_approvers WHERE employee_id = $1 LIMIT 1`,
            id
          ).catch(() => null);

          if (rawExisting && rawExisting[0]) {
            existingFirst = rawExisting[0].first_level_approver ?? null;
            existingFinal = rawExisting[0].final_level_approver ?? null;
            existingBackup = rawExisting[0].backup_officer ?? null;
          }
        }

        const newFirstLevel = hasFirst ? firstVal : existingFirst;
        const newFinalLevel = hasFinal ? finalVal : existingFinal;
        const newBackup = hasBackup ? backupVal : existingBackup;

        try {
          return await prisma.employeeApprover.upsert({
            where: { employeeId: id },
            create: {
              employeeId: id,
              firstLevelApprover: newFirstLevel,
              finalLevelApprover: newFinalLevel,
              backupOfficer: newBackup,
            },
            update: {
              firstLevelApprover: newFirstLevel,
              finalLevelApprover: newFinalLevel,
              backupOfficer: newBackup,
              updatedAt: new Date(),
            },
          });
        } catch (upsertError) {
          console.warn("Prisma upsert fallback to SQL:", upsertError);
          await prisma.$executeRawUnsafe(
            `INSERT INTO employee_approvers (employee_id, first_level_approver, final_level_approver, backup_officer, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (employee_id)
             DO UPDATE SET
               first_level_approver = EXCLUDED.first_level_approver,
               final_level_approver = EXCLUDED.final_level_approver,
               backup_officer = EXCLUDED.backup_officer,
               updated_at = NOW();`,
            id,
            newFirstLevel,
            newFinalLevel,
            newBackup
          );

          return {
            id: 0,
            employeeId: id,
            firstLevelApprover: newFirstLevel,
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
        finalLevelApprover: record.finalLevelApprover,
        backupOfficer: record.backupOfficer,
        updatedAt: record.updatedAt,
      })),
      record: records[0]
        ? {
            employeeId: records[0].employeeId,
            firstLevelApprover: records[0].firstLevelApprover,
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
