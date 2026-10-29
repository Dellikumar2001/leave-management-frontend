import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getDepartmentHOD(department: string): string {
  const d = (department || "").toLowerCase().trim();
  if (d.includes("computer") || d === "cs") return "CS HOD";
  if (d.includes("commerce")) return "Commerce HOD";
  if (d.includes("english")) return "English HOD";
  if (d.includes("math")) return "Mathematics HOD";
  if (d.includes("physic")) return "Physics HOD";
  return department ? `${department} HOD` : "Department HOD";
}

async function loadApproverSettingsMap(): Promise<Map<
  string,
  { firstLevelApprover: string; finalLevelApprover: string }
> | null> {
  try {
    const p = prisma as unknown as Record<string, { findMany?: () => Promise<unknown[]> }>;
    const candidateModel = p.approverSetting || p.approverSettings || p.leaveApproverSetting;
    if (candidateModel && typeof candidateModel.findMany === "function") {
      const records = (await candidateModel.findMany()) as Array<Record<string, unknown>>;
      if (Array.isArray(records) && records.length > 0) {
        const map = new Map<string, { firstLevelApprover: string; finalLevelApprover: string }>();
        for (const item of records) {
          const key = String(item.employeeId || item.employee_id || item.department || "").trim();
          if (key) {
            map.set(key, {
              firstLevelApprover: String(
                item.firstLevelApprover || item.level1Approver || item.first_level_approver || item.approver1 || ""
              ).trim(),
              finalLevelApprover: String(
                item.finalLevelApprover || item.level2Approver || item.final_level_approver || item.approver2 || ""
              ).trim(),
            });
          }
        }
        return map;
      }
    }
  } catch {
    // Model does not exist yet; gracefully fallback
  }

  try {
    const rawRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "approver_settings" LIMIT 200`
    ).catch(() => null);

    if (rawRows && Array.isArray(rawRows) && rawRows.length > 0) {
      const map = new Map<string, { firstLevelApprover: string; finalLevelApprover: string }>();
      for (const row of rawRows) {
        const key = String(row.employeeId || row.employee_id || row.department || "").trim();
        if (key) {
          map.set(key, {
            firstLevelApprover: String(
              row.firstLevelApprover || row.level1_approver || row.first_level_approver || row.approver1 || ""
            ).trim(),
            finalLevelApprover: String(
              row.finalLevelApprover || row.level2_approver || row.final_level_approver || row.approver2 || ""
            ).trim(),
          });
        }
      }
      return map;
    }
  } catch {
    // Raw table does not exist yet; gracefully fallback
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeNameParam = searchParams.get("employeeName")?.trim() || "";
    const firstLevelParam =
      searchParams.get("firstLevelApprover")?.trim() || searchParams.get("approver1")?.trim() || "";
    const finalLevelParam =
      searchParams.get("finalLevelApprover")?.trim() || searchParams.get("approver2")?.trim() || "";
    const streamParam = searchParams.get("stream")?.trim() || "";
    const departmentParam = searchParams.get("department")?.trim() || "";
    const employeeTypeParam = searchParams.get("employeeType")?.trim() || "";

    // 1. Fetch all employees from the database
    const employees = await prisma.employee.findMany({
      orderBy: { employeeId: "asc" },
    });

    // 2. Load dynamic approver settings if table is available
    const settingsMap = await loadApproverSettingsMap();

    const employeeNameSet = new Set<string>();
    const firstLevelSet = new Set<string>();
    const finalLevelSet = new Set<string>();
    const streamSet = new Set<string>();
    const departmentSet = new Set<string>();
    const employeeTypeSet = new Set<string>();

    const allRecords = employees.map((emp) => {
      const empType = (emp as { employeeType?: string | null }).employeeType || "Teaching";
      if (emp.name) employeeNameSet.add(emp.name);
      if (emp.stream) streamSet.add(emp.stream);
      if (emp.department) departmentSet.add(emp.department);
      if (empType) employeeTypeSet.add(empType);

      const dynamicSetting =
        settingsMap?.get(emp.employeeId) || settingsMap?.get(emp.department);

      // First Level Approver: HOD of the department
      const firstLevel =
        dynamicSetting?.firstLevelApprover &&
        dynamicSetting.firstLevelApprover !== "—" &&
        dynamicSetting.firstLevelApprover !== "--"
          ? dynamicSetting.firstLevelApprover
          : getDepartmentHOD(emp.department);

      // Final Level Approver: Principal
      const finalLevel =
        dynamicSetting?.finalLevelApprover &&
        dynamicSetting.finalLevelApprover !== "—" &&
        dynamicSetting.finalLevelApprover !== "--"
          ? dynamicSetting.finalLevelApprover
          : "Principal";

      if (firstLevel) firstLevelSet.add(firstLevel);
      if (finalLevel) finalLevelSet.add(finalLevel);

      return {
        id: emp.employeeId,
        employeeId: emp.employeeId,
        employeeName: emp.name,
        stream: emp.stream,
        department: emp.department,
        employeeType: empType,
        streamAndDepartment: `${emp.stream}-${emp.department}`,
        firstLevelApprover: firstLevel,
        secondLevelApprover: finalLevel,
        finalLevelApprover: finalLevel,
      };
    });

    // 3. Apply filters
    const filteredRecords = allRecords.filter((rec) => {
      // Employee Name filter
      if (employeeNameParam && employeeNameParam.toLowerCase() !== "all") {
        if (rec.employeeName.toLowerCase() !== employeeNameParam.toLowerCase()) {
          return false;
        }
      }

      // First Level Approver filter
      if (firstLevelParam && firstLevelParam.toLowerCase() !== "all") {
        if (rec.firstLevelApprover.toLowerCase() !== firstLevelParam.toLowerCase()) {
          return false;
        }
      }

      // Final Level Approver filter
      if (finalLevelParam && finalLevelParam.toLowerCase() !== "all") {
        if (rec.finalLevelApprover.toLowerCase() !== finalLevelParam.toLowerCase()) {
          return false;
        }
      }

      // Stream filter
      if (streamParam && streamParam.toLowerCase() !== "all") {
        if (rec.stream.toLowerCase() !== streamParam.toLowerCase()) {
          return false;
        }
      }

      // Department filter
      if (departmentParam && departmentParam.toLowerCase() !== "all") {
        if (rec.department.toLowerCase() !== departmentParam.toLowerCase()) {
          return false;
        }
      }

      // Employee Type filter
      if (employeeTypeParam && employeeTypeParam.toLowerCase() !== "all") {
        if (rec.employeeType.toLowerCase() !== employeeTypeParam.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    const defaultEmployeeTypes = ["Teaching", "Non-Teaching"];
    const allEmployeeTypes = Array.from(new Set([...defaultEmployeeTypes, ...Array.from(employeeTypeSet)])).sort();

    return Response.json({
      records: filteredRecords,
      filters: {
        allEmployeeNames: Array.from(employeeNameSet).sort(),
        allFirstLevelApprovers: Array.from(firstLevelSet).sort(),
        allFinalLevelApprovers: Array.from(finalLevelSet).sort(),
        allStreams: Array.from(streamSet).sort(),
        allDepartments: Array.from(departmentSet).sort(),
        allEmployeeTypes,
      },
    });
  } catch (error) {
    console.error("Failed to fetch approver report:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load approver report from database.",
      },
      { status: 500 }
    );
  }
}
