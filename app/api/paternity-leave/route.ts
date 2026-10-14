import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const FEMALE_NAMES = ["diya", "kavya", "sneha", "ananya", "priya", "pooja", "meera"];

export interface PaternityEmployee {
  employeeId: string;
  name: string;
  gender: "Male" | "Female";
  stream: string;
  department: string;
  isEligible: boolean;
  daysAllowed: number;
  leaveBalance: number;
}

type DbEmployee = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  leaveRecords: Array<{
    isEligible: boolean;
    daysAllowed: number;
    leaveBalance: number;
  }>;
};

const FALLBACK_EMPLOYEES: PaternityEmployee[] = [
  { employeeId: "EMP-001", name: "Anandh", gender: "Male", stream: "SFS", department: "Computer Science", isEligible: true, daysAllowed: 15, leaveBalance: 15 },
  { employeeId: "EMP-002", name: "Arjun", gender: "Male", stream: "AIDED", department: "Commerce", isEligible: true, daysAllowed: 15, leaveBalance: 12 },
  { employeeId: "EMP-003", name: "Diya Menon", gender: "Female", stream: "SFS", department: "English", isEligible: false, daysAllowed: 0, leaveBalance: 0 },
  { employeeId: "EMP-004", name: "Venkatesh", gender: "Male", stream: "AIDED", department: "Mathematics", isEligible: true, daysAllowed: 15, leaveBalance: 15 },
  { employeeId: "EMP-005", name: "Kavya", gender: "Female", stream: "SFS", department: "Physics", isEligible: false, daysAllowed: 0, leaveBalance: 0 },
  { employeeId: "EMP-006", name: "Rohan Das", gender: "Male", stream: "AIDED", department: "Computer Science", isEligible: true, daysAllowed: 15, leaveBalance: 10 },
  { employeeId: "EMP-007", name: "Sneha Thomas", gender: "Female", stream: "SFS", department: "Commerce", isEligible: false, daysAllowed: 0, leaveBalance: 0 },
  { employeeId: "EMP-008", name: "Vikram", gender: "Male", stream: "AIDED", department: "English", isEligible: true, daysAllowed: 15, leaveBalance: 15 },
];

function getGender(name: string): "Male" | "Female" {
  return FEMALE_NAMES.some((fn) => name.toLowerCase().includes(fn)) ? "Female" : "Male";
}

export async function GET() {
  try {
    const maleOnlyFallback = FALLBACK_EMPLOYEES.filter((emp) => emp.gender === "Male");

    if (!process.env.DATABASE_URL) {
      return Response.json({
        employees: maleOnlyFallback,
        leaveType: { code: "PL", name: "Paternity Leave", daysAllowed: 15, status: "ACTIVE" },
        records: [],
      });
    }

    // Check or find paternity leave type
    let paternityLeaveType = await prisma.leaveType.findFirst({
      where: {
        OR: [
          { code: "PL" },
          { name: { contains: "Paternity", mode: "insensitive" } },
        ],
      },
    });

    if (!paternityLeaveType) {
      try {
        paternityLeaveType = await prisma.leaveType.create({
          data: {
            code: "PL",
            name: "Paternity Leave",
            daysAllowed: 15,
            status: "ACTIVE",
            description: "Paternity leave for male employees.",
          },
        });
      } catch {
        paternityLeaveType = await prisma.leaveType.findFirst({
          where: { code: "PL" },
        });
      }
    }

    const employees = await prisma.employee.findMany({
      orderBy: { employeeId: "asc" },
      include: {
        leaveRecords: {
          where: paternityLeaveType ? { leaveTypeId: paternityLeaveType.id } : undefined,
          select: {
            isEligible: true,
            daysAllowed: true,
            leaveBalance: true,
          },
        },
      },
    });

    // Fetch existing paternity leave records from database
    const paternityRecords = await prisma.paternityLeave.findMany({
      orderBy: { id: "desc" },
    });

    if (!employees || employees.length === 0) {
      return Response.json({
        employees: maleOnlyFallback,
        leaveType: paternityLeaveType ?? { code: "PL", name: "Paternity Leave", daysAllowed: 15, status: "ACTIVE" },
        records: paternityRecords,
      });
    }

    const formattedEmployees: PaternityEmployee[] = (employees as DbEmployee[])
      .map((emp: DbEmployee): PaternityEmployee => {
        const record = emp.leaveRecords?.[0];
        const gender = getGender(emp.name);
        return {
          employeeId: emp.employeeId,
          name: emp.name,
          gender,
          stream: emp.stream,
          department: emp.department,
          isEligible: gender === "Male" ? (record ? record.isEligible : true) : false,
          daysAllowed: record ? record.daysAllowed : (paternityLeaveType?.daysAllowed ?? 15),
          leaveBalance: record ? record.leaveBalance : (paternityLeaveType?.daysAllowed ?? 15),
        };
      })
      .filter((emp: PaternityEmployee) => emp.gender === "Male");

    return Response.json({
      employees: formattedEmployees,
      leaveType: paternityLeaveType,
      records: paternityRecords,
    });
  } catch (error) {
    console.error("Failed to load paternity leave data:", error);
    return Response.json({
      employees: FALLBACK_EMPLOYEES.filter((emp) => emp.gender === "Male"),
      leaveType: { code: "PL", name: "Paternity Leave", daysAllowed: 15, status: "ACTIVE" },
      records: [],
    });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Support single record { employeeId, employeeName, noOfDays, remarks, status }
  // as well as multiple { employeeIds, daysAllowed, remarks, ... }
  const singleEmployeeId = typeof body.employeeId === "string" ? body.employeeId : null;
  const employeeIds = singleEmployeeId
    ? [singleEmployeeId]
    : Array.isArray(body.employeeIds)
      ? (body.employeeIds as string[])
      : [];

  if (employeeIds.length === 0) {
    return Response.json({ error: "Please select at least one employee." }, { status: 400 });
  }

  // Ensure selected employees are not female
  const invalidFemale = FALLBACK_EMPLOYEES.find(
    (e) => employeeIds.includes(e.employeeId) && e.gender !== "Male"
  );
  if (invalidFemale) {
    return Response.json(
      { error: `Paternity leave is strictly applicable to male employees only. ${invalidFemale.name} is not eligible.` },
      { status: 400 }
    );
  }

  const noOfDays = Number(body.noOfDays ?? body.daysAllowed) || 5;
  const remarks = typeof body.remarks === "string" ? body.remarks : (typeof body.remarkText === "string" ? body.remarkText : "");
  const status = typeof body.status === "string" ? body.status : "Active";

  try {
    if (!process.env.DATABASE_URL) {
      return Response.json({
        success: true,
        message: `Updated paternity leave for ${employeeIds.length} employee(s).`,
      });
    }

    let paternityLeaveType = await prisma.leaveType.findFirst({
      where: {
        OR: [
          { code: "PL" },
          { name: { contains: "Paternity", mode: "insensitive" } },
        ],
      },
    });

    if (!paternityLeaveType) {
      paternityLeaveType = await prisma.leaveType.create({
        data: {
          code: "PL",
          name: "Paternity Leave",
          daysAllowed: 15,
          status: "ACTIVE",
        },
      });
    }

    const savedRecords = [];

    for (const empId of employeeIds) {
      // Find employee name from DB or request or fallback
      let empName = (typeof body.employeeName === "string" && body.employeeName) ? body.employeeName : "";
      if (!empName) {
        const dbEmp = await prisma.employee.findUnique({ where: { employeeId: empId } });
        empName = dbEmp?.name || FALLBACK_EMPLOYEES.find((f) => f.employeeId === empId)?.name || empId;
      }

      // Upsert into paternity_leaves table
      const existingRecord = await prisma.paternityLeave.findFirst({
        where: { employeeId: empId },
      });

      let saved;
      if (existingRecord) {
        saved = await prisma.paternityLeave.update({
          where: { id: existingRecord.id },
          data: {
            employeeName: empName,
            noOfDays,
            remarks,
            status,
          },
        });
      } else {
        saved = await prisma.paternityLeave.create({
          data: {
            employeeId: empId,
            employeeName: empName,
            noOfDays,
            remarks,
            status,
          },
        });
      }
      savedRecords.push(saved);

      // Also keep employee_leave_eligibilities table synchronized
      await prisma.employeeLeaveEligibility.upsert({
        where: {
          employeeId_leaveTypeId: {
            employeeId: empId,
            leaveTypeId: paternityLeaveType.id,
          },
        },
        update: {
          isEligible: true,
          daysAllowed: noOfDays,
          leaveBalance: noOfDays,
        },
        create: {
          employeeId: empId,
          leaveTypeId: paternityLeaveType.id,
          isEligible: true,
          daysAllowed: noOfDays,
          leaveBalance: noOfDays,
        },
      });
    }

    return Response.json({
      success: true,
      message: `Paternity leave saved successfully for ${employeeIds.length} employee(s).`,
      record: savedRecords[0],
      records: savedRecords,
    });
  } catch (error) {
    console.error("Failed to update paternity leave:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const employeeId = searchParams.get("employeeId");

    if (id && !isNaN(Number(id))) {
      await prisma.paternityLeave.delete({
        where: { id: Number(id) },
      });
    } else if (employeeId) {
      await prisma.paternityLeave.deleteMany({
        where: { employeeId },
      });
    } else {
      return Response.json({ error: "Missing id or employeeId parameter." }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: "Paternity leave record removed successfully.",
    });
  } catch (error) {
    console.error("Failed to delete paternity leave record:", error);
    return Response.json(
      { error: "Failed to delete paternity leave record." },
      { status: 500 }
    );
  }
}
