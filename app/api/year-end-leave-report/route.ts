import { prisma } from "@/lib/prisma";
import {
  getYearEndLeaveValues,
  leaveTypeCategory,
  academicYearStartFor,
} from "@/lib/year-end-leave-report";

export const runtime = "nodejs";

function academicYearStart(year: number) {
  return new Date(Date.UTC(year, 6, 1));
}

function academicYearEnd(year: number) {
  return new Date(Date.UTC(year + 1, 6, 0));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const employeeIds = [...new Set(params.getAll("employeeId").map((id) => id.trim()).filter(Boolean))];
  const year = Number(params.get("year"));
  if (employeeIds.length === 0 || !Number.isInteger(year) || year < 1900 || year > 9998) {
    return Response.json({ error: "Select at least one employee and a valid academic year." }, { status: 400 });
  }

  try {
    const [employees, leaveTypes] = await Promise.all([
      prisma.employee.findMany({
        where: { employeeId: { in: employeeIds } },
        select: {
          employeeId: true,
          name: true,
          stream: true,
          department: true,
          leaveRecords: {
            select: {
              leaveTypeId: true,
              isEligible: true,
              leaveBalance: true,
              creditedDays: true,
              bf: true,
              joiningDate: true,
              leaveType: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  status: true,
                  daysAllowed: true,
                  category: true,
                  leaveGroup: true,
                },
              },
            },
          },
        },
      }),
      prisma.leaveType.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
          daysAllowed: true,
          category: true,
          leaveGroup: true,
        },
      }),
    ]);
    if (employees.length !== employeeIds.length) {
      return Response.json({ error: "One or more selected employees could not be found." }, { status: 404 });
    }

    const employeesById = new Map(employees.map((employee) => [employee.employeeId, employee]));
    const firstMedicalYearByEmployee = new Map(employeeIds.map((employeeId) => {
      const employee = employeesById.get(employeeId);
      if (!employee) throw new Error(`Selected employee ${employeeId} could not be loaded.`);
      const firstMedicalYear = employee.leaveRecords
        .filter((record) =>
          record.isEligible &&
          record.leaveType.status === "ACTIVE" &&
          leaveTypeCategory(record.leaveType) === "medical",
        )
        .reduce((earliest, record) => Math.min(earliest, academicYearStartFor(record.joiningDate)), year);
      return [employeeId, firstMedicalYear] as const;
    }));
    const earliestMedicalYear = Math.min(...firstMedicalYearByEmployee.values());
    const usageRecords = await prisma.employeeLeaveUsage.findMany({
      where: {
        employeeId: { in: employeeIds },
        startDate: { lte: academicYearEnd(year) },
        endDate: { gte: academicYearStart(earliestMedicalYear) },
      },
      select: { employeeId: true, leaveTypeId: true, status: true, startDate: true, endDate: true },
    });
    const usageRecordsByEmployee = new Map<string, typeof usageRecords>();
    for (const record of usageRecords) {
      const employeeRecords = usageRecordsByEmployee.get(record.employeeId) ?? [];
      employeeRecords.push(record);
      usageRecordsByEmployee.set(record.employeeId, employeeRecords);
    }

    const reports = employeeIds.map((employeeId) => {
      const employee = employeesById.get(employeeId);
      if (!employee) throw new Error(`Selected employee ${employeeId} could not be loaded.`);
      const employeeData = {
        ...employee,
        leaveRecords: employee.leaveRecords.map((record) => ({
          ...record,
          isEligible: record.isEligible && record.leaveType.status === "ACTIVE",
        })),
      };
      const employeeUsageRecords = usageRecordsByEmployee.get(employeeId) ?? [];
      const firstMedicalYear = firstMedicalYearByEmployee.get(employeeId);
      if (firstMedicalYear === undefined) throw new Error(`Medical leave period for employee ${employeeId} could not be determined.`);
      let medicalCarryForward = 0;
      for (let previousYear = firstMedicalYear; previousYear < year; previousYear += 1) {
        medicalCarryForward += getYearEndLeaveValues(
          employeeData,
          leaveTypes,
          employeeUsageRecords,
          previousYear,
          0,
        ).medicalAvailable;
      }

      return {
        employee: {
          employeeId: employee.employeeId,
          name: employee.name,
          stream: employee.stream,
          department: employee.department,
        },
        values: getYearEndLeaveValues(employeeData, leaveTypes, employeeUsageRecords, year, medicalCarryForward),
      };
    });

    return Response.json({ reports });
  } catch (error) {
    console.error("Failed to generate year end leave report:", error);
    return Response.json({ error: "Unable to generate the year end leave report." }, { status: 503 });
  }
}
