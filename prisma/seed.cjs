const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const employees = [
  { employeeId: "EMP-001", name: "Anandh", stream: "SFS", department: "Computer Science" },
  { employeeId: "EMP-002", name: "Arjun", stream: "AIDED", department: "Commerce" },
  { employeeId: "EMP-003", name: "Diya Menon", stream: "SFS", department: "English" },
  { employeeId: "EMP-004", name: "cenkatesh", stream: "AIDED", department: "Mathematics" },
  { employeeId: "EMP-005", name: "Kavya", stream: "SFS", department: "Physics" },
  { employeeId: "EMP-006", name: "Rohan Das", stream: "AIDED", department: "Computer Science" },
  { employeeId: "EMP-007", name: "Sneha Thomas", stream: "SFS", department: "Commerce" },
  { employeeId: "EMP-008", name: "Vikram", stream: "AIDED", department: "English" },
];

async function main() {
  const leaveTypes = await prisma.leaveType.findMany();

  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { employeeId: employee.employeeId },
      update: {},
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