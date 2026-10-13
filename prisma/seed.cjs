const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const employees = [
  { employeeId: "EMP-001", name: "Anandh", stream: "SFS", department: "Computer Science", gender: "Male" },
  { employeeId: "EMP-002", name: "Arjun", stream: "AIDED", department: "Commerce", gender: "Male" },
  { employeeId: "EMP-003", name: "Diya Menon", stream: "SFS", department: "English", gender: "Female" },
  { employeeId: "EMP-004", name: "cenkatesh", stream: "AIDED", department: "Mathematics", gender: "Male" },
  { employeeId: "EMP-005", name: "Kavya", stream: "SFS", department: "Physics", gender: "Female" },
  { employeeId: "EMP-006", name: "Rohan Das", stream: "AIDED", department: "Computer Science", gender: "Male" },
  { employeeId: "EMP-007", name: "Sneha Thomas", stream: "SFS", department: "Commerce", gender: "Female" },
  { employeeId: "EMP-008", name: "Vikram", stream: "AIDED", department: "English", gender: "Male" },
];

async function main() {
  const leaveTypes = await prisma.leaveType.findMany({
    select: { id: true, status: true, daysAllowed: true },
  });

  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { employeeId: employee.employeeId },
      update: { gender: employee.gender },
      create: employee,
    });

    for (const leaveType of leaveTypes) {
      const isEligible = leaveType.status.toUpperCase() === "ACTIVE";

      await prisma.employeeLeaveEligibility.upsert({
        where: {
          employeeId_leaveTypeId: {
            employeeId: employee.employeeId,
            leaveTypeId: leaveType.id,
          },
        },
        update: {},
        create: {
          employeeId: employee.employeeId,
          leaveTypeId: leaveType.id,
          isEligible,
          daysAllowed: isEligible ? leaveType.daysAllowed : 0,
          leaveBalance: 0,
        },
      });
    }
  }

  console.log(`Seeded ${employees.length} employees and eligibility records for ${leaveTypes.length} leave types.`);
}

main()
  .catch((error) => {
    console.error("Failed to seed leave eligibility:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });