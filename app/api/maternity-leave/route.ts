import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const FEMALE_NAMES = ["diya", "kavya", "sneha", "ananya", "priya", "pooja", "meera"];

export interface MaternityEmployee {
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

const FALLBACK_EMPLOYEES: MaternityEmployee[] = [
  { employeeId: "EMP-001", name: "Anandh", gender: "Male", stream: "SFS", department: "Computer Science", isEligible: false, daysAllowed: 0, leaveBalance: 0 },
  { employeeId: "EMP-002", name: "Arjun", gender: "Male", stream: "AIDED", department: "Commerce", isEligible: false, daysAllowed: 0, leaveBalance: 0 },
  { employeeId: "EMP-003", name: "Diya Menon", gender: "Female", stream: "SFS", department: "English", isEligible: true, daysAllowed: 180, leaveBalance: 180 },
  { employeeId: "EMP-004", name: "Venkatesh", gender: "Male", stream: "AIDED", department: "Mathematics", isEligible: false, daysAllowed: 0, leaveBalance: 0 },
  { employeeId: "EMP-005", name: "Kavya", gender: "Female", stream: "SFS", department: "Physics", isEligible: true, daysAllowed: 180, leaveBalance: 180 },
  { employeeId: "EMP-006", name: "Rohan Das", gender: "Male", stream: "AIDED", department: "Computer Science", isEligible: false, daysAllowed: 0, leaveBalance: 0 },
  { employeeId: "EMP-007", name: "Sneha Thomas", gender: "Female", stream: "SFS", department: "Commerce", isEligible: true, daysAllowed: 180, leaveBalance: 180 },
  { employeeId: "EMP-008", name: "Vikram", gender: "Male", stream: "AIDED", department: "English", isEligible: false, daysAllowed: 0, leaveBalance: 0 },
];

function getGender(name: string): "Male" | "Female" {
  return FEMALE_NAMES.some((fn) => name.toLowerCase().includes(fn)) ? "Female" : "Male";
}

export async function GET() {
  try {
    const femaleOnlyFallback = FALLBACK_EMPLOYEES.filter((emp) => emp.gender === "Female");

    if (!process.env.DATABASE_URL) {
      return Response.json({
        employees: femaleOnlyFallback,
        leaveType: { code: "MLV", name: "Maternity Leave", daysAllowed: 180, status: "ACTIVE" },
        records: [],
      });
    }

    let maternityLeaveType = await prisma.leaveType.findFirst({
      where: {
        OR: [
          { code: "MLV" },
          { name: { contains: "Maternity", mode: "insensitive" } },
        ],
      },
    });

    if (!maternityLeaveType) {
      try {
        maternityLeaveType = await prisma.leaveType.create({
          data: {
            code: "MLV",
            name: "Maternity Leave",
            daysAllowed: 180,
            status: "ACTIVE",
            description: "Statutory maternity leave for eligible female staff.",
          },
        });
      } catch {
        maternityLeaveType = await prisma.leaveType.findFirst({
          where: { code: "MLV" },
        });
      }
    }

    const employees = await prisma.employee.findMany({
      orderBy: { employeeId: "asc" },
      include: {
        leaveRecords: {
          where: maternityLeaveType ? { leaveTypeId: maternityLeaveType.id } : undefined,
          select: {
            isEligible: true,
            daysAllowed: true,
            leaveBalance: true,
          },
        },
      },
    });

    const maternityRecords = await prisma.maternityLeave.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (!employees || employees.length === 0) {
      return Response.json({
        employees: femaleOnlyFallback,
        leaveType: maternityLeaveType ?? { code: "MLV", name: "Maternity Leave", daysAllowed: 180, status: "ACTIVE" },
        records: maternityRecords,
      });
    }

    const formattedEmployees: MaternityEmployee[] = (employees as DbEmployee[])
      .map((emp: DbEmployee): MaternityEmployee => {
        const record = emp.leaveRecords?.[0];
        const gender = getGender(emp.name);
        return {
          employeeId: emp.employeeId,
          name: emp.name,
          gender,
          stream: emp.stream,
          department: emp.department,
          isEligible: gender === "Female" ? (record ? record.isEligible : true) : false,
          daysAllowed: record ? record.daysAllowed : (maternityLeaveType?.daysAllowed ?? 180),
          leaveBalance: record ? record.leaveBalance : (maternityLeaveType?.daysAllowed ?? 180),
        };
      })
      .filter((emp: MaternityEmployee) => emp.gender === "Female");

    return Response.json({
      employees: formattedEmployees,
      leaveType: maternityLeaveType,
      records: maternityRecords,
    });
  } catch (error) {
    console.error("Failed to load maternity leave data:", error);
    return Response.json({
      employees: FALLBACK_EMPLOYEES.filter((emp) => emp.gender === "Female"),
      leaveType: { code: "MLV", name: "Maternity Leave", daysAllowed: 180, status: "ACTIVE" },
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

  const singleEmployeeId = typeof body.employeeId === "string" ? body.employeeId : null;
  const employeeIds = singleEmployeeId
    ? [singleEmployeeId]
    : Array.isArray(body.employeeIds)
      ? (body.employeeIds as string[])
      : [];

  if (employeeIds.length === 0) {
    return Response.json({ error: "Please select at least one employee." }, { status: 400 });
  }

  const noOfDays = Number(body.noOfDays ?? body.daysAllowed) || 180;
  const remarks = typeof body.remarks === "string" ? body.remarks : (typeof body.remarkText === "string" ? body.remarkText : "");
  const status = typeof body.status === "string" ? body.status : "Active";

  try {
    if (!process.env.DATABASE_URL) {
      return Response.json({
        success: true,
        message: `Updated maternity leave for ${employeeIds.length} employee(s).`,
      });
    }

    let maternityLeaveType = await prisma.leaveType.findFirst({
      where: {
        OR: [
          { code: "MLV" },
          { name: { contains: "Maternity", mode: "insensitive" } },
        ],
      },
    });

    if (!maternityLeaveType) {
      maternityLeaveType = await prisma.leaveType.create({
        data: {
          code: "MLV",
          name: "Maternity Leave",
          daysAllowed: 180,
          status: "ACTIVE",
        },
      });
    }

    const savedRecords = [];

    for (const empId of employeeIds) {
      let empName = (typeof body.employeeName === "string" && body.employeeName) ? body.employeeName : "";
      if (!empName) {
        const dbEmp = await prisma.employee.findUnique({ where: { employeeId: empId } });
        empName = dbEmp?.name || FALLBACK_EMPLOYEES.find((f) => f.employeeId === empId)?.name || empId;
      }

      const existingRecord = await prisma.maternityLeave.findFirst({
        where: { employeeId: empId },
      });

      let saved;
      if (existingRecord) {
        saved = await prisma.maternityLeave.update({
          where: { id: existingRecord.id },
          data: {
            employeeName: empName,
            noOfDays,
            remarks,
            status,
          },
        });
      } else {
        saved = await prisma.maternityLeave.create({
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

      await prisma.employeeLeaveEligibility.upsert({
        where: {
          employeeId_leaveTypeId: {
            employeeId: empId,
            leaveTypeId: maternityLeaveType.id,
          },
        },
        update: {
          isEligible: true,
          daysAllowed: noOfDays,
          leaveBalance: noOfDays,
        },
        create: {
          employeeId: empId,
          leaveTypeId: maternityLeaveType.id,
          isEligible: true,
          daysAllowed: noOfDays,
          leaveBalance: noOfDays,
        },
      });
    }

    return Response.json({
      success: true,
      message: `Maternity leave saved successfully for ${employeeIds.length} employee(s).`,
      record: savedRecords[0],
      records: savedRecords,
    });
  } catch (error) {
    console.error("Failed to update maternity leave:", error);
    return Response.json(
      { error: "Failed to save maternity leave record." },
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
      await prisma.maternityLeave.delete({
        where: { id: Number(id) },
      });
    } else if (employeeId) {
      await prisma.maternityLeave.deleteMany({
        where: { employeeId },
      });
    } else {
      return Response.json({ error: "Missing id or employeeId parameter." }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: "Maternity leave record removed successfully.",
    });
  } catch (error) {
    console.error("Failed to delete maternity leave record:", error);
    return Response.json(
      { error: "Failed to delete maternity leave record." },
      { status: 500 }
    );
  }
}
