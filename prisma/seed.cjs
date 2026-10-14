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
const categories = [
  { code: "ANNUAL", name: "Annual Leave", description: "Standard annual paid leave allocation", isPaid: true },
  { code: "CASUAL", name: "Casual Leave", description: "Short-term unforeseen casual leaves", isPaid: true },
  { code: "MEDICAL", name: "Medical Leave", description: "Leave for medical recovery and doctor consultations", isPaid: true },
  { code: "EMERGENCY", name: "Emergency Leave", description: "Urgent emergency personal leaves", isPaid: true },
  { code: "SPECIAL", name: "Special Leave", description: "Special leaves including maternity, paternity, and duty", isPaid: true },
];

const leaveGroups = [
  { code: "GRP-GEN", name: "General Staff", description: "Standard leave group for non-teaching and administrative staff", effectiveFrom: new Date("2026-01-01") },
  { code: "GRP-FAC", name: "Teaching Faculty", description: "Academic and faculty leave structure", effectiveFrom: new Date("2026-01-01") },
];

const starterLeaveTypes = [
  { code: "CL", name: "Casual Leave", leaveGroup: "General Staff", daysAllowed: 12, description: "Annual casual leave allowance", status: "ACTIVE" },
  { code: "ML", name: "Medical Leave", leaveGroup: "General Staff", daysAllowed: 15, description: "Sick and medical leave", status: "ACTIVE" },
  { code: "EL", name: "Earned Leave", leaveGroup: "General Staff", daysAllowed: 30, description: "Earned annual leave", status: "ACTIVE" },
  { code: "PL", name: "Paternity Leave", leaveGroup: "General Staff", daysAllowed: 15, description: "Statutory leave for male employees upon childbirth", status: "ACTIVE" },
  { code: "MLV", name: "Maternity Leave", leaveGroup: "General Staff", daysAllowed: 180, description: "Statutory maternity leave for eligible female staff", status: "ACTIVE" },
];

const employees = [
  { employeeId: "EMP-001", name: "Anandh", stream: "SFS", department: "Computer Science", status: "Approved" },
  { employeeId: "EMP-002", name: "Arjun", stream: "AIDED", department: "Commerce", status: "Pending" },
  { employeeId: "EMP-003", name: "Diya Menon", stream: "SFS", department: "English", status: "Approved" },
  { employeeId: "EMP-004", name: "Venkatesh", stream: "AIDED", department: "Mathematics", status: "Rejected" },
  { employeeId: "EMP-005", name: "Kavya", stream: "SFS", department: "Physics", status: "Approved" },
  { employeeId: "EMP-006", name: "Rohan Das", stream: "AIDED", department: "Computer Science", status: "Cancelled" },
  { employeeId: "EMP-007", name: "Sneha Thomas", stream: "SFS", department: "Commerce", status: "Pending" },
  { employeeId: "EMP-008", name: "Vikram", stream: "AIDED", department: "English", status: "Approved" },
];

const starterHolidays = [
  { date: new Date("2026-01-01"), name: "New Year's Day", type: "Gazetted", description: "Public Holiday", isHoliday: true, status: "active" },
  { date: new Date("2026-01-26"), name: "Republic Day", type: "National", description: "National Holiday", isHoliday: true, status: "active" },
  { date: new Date("2026-08-15"), name: "Independence Day", type: "National", description: "National Holiday", isHoliday: true, status: "active" },
  { date: new Date("2026-10-02"), name: "Gandhi Jayanti", type: "National", description: "National Holiday", isHoliday: true, status: "active" },
  { date: new Date("2026-12-25"), name: "Christmas Day", type: "Gazetted", description: "Public Holiday", isHoliday: true, status: "active" },
];

const employeeGenders = {
  "EMP-001": "Male",
  "EMP-002": "Male",
  "EMP-003": "Female",
  "EMP-004": "Male",
  "EMP-005": "Female",
  "EMP-006": "Male",
  "EMP-007": "Female",
  "EMP-008": "Male",
};

async function main() {
  console.log("Seeding Leave Categories...");
  for (const cat of categories) {
    await prisma.leaveCategoryMaster.upsert({
      where: { code: cat.code },
      update: { name: cat.name, description: cat.description, isPaid: cat.isPaid },
      create: cat,
    });
  }

  console.log("Seeding Leave Groups...");
  const catRecord = await prisma.leaveCategoryMaster.findFirst({ where: { code: "ANNUAL" } });
  for (const grp of leaveGroups) {
    await prisma.leaveGroup.upsert({
      where: { code: grp.code },
      update: { name: grp.name, description: grp.description },
      create: {
        ...grp,
        categoryId: catRecord ? catRecord.id : null,
      },
    });
  }

  console.log("Seeding Starter Leave Types...");
  for (const lt of starterLeaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: { name: lt.name, daysAllowed: lt.daysAllowed, description: lt.description, status: lt.status },
      create: lt,
    });
  }

  const allLeaveTypes = await prisma.leaveType.findMany();

  console.log("Seeding Employees and Eligibility...");
  for (const employee of employees) {
    await prisma.employee.upsert({
      where: { employeeId: employee.employeeId },
      update: { gender: employee.gender },
      update: { name: employee.name, stream: employee.stream, department: employee.department, status: employee.status },
      create: employee,
    });

    const gender = employeeGenders[employee.employeeId] || "Male";

    for (const lt of allLeaveTypes) {
      const isEligible = lt.status.toUpperCase() === "ACTIVE";

      await prisma.employeeLeaveEligibility.upsert({
        where: {
          employeeId_leaveTypeId: {
            employeeId: employee.employeeId,
            leaveTypeId: lt.id,
          },
        },
        update: {
    gender,
          isEligible,
          daysAllowed: isEligible ? lt.daysAllowed : 0,
        },
        create: {
          employeeId: employee.employeeId,
          leaveTypeId: lt.id,
          isEligible,
    daysAllowed: isEligible ? lt.daysAllowed : 0,
    leaveBalance: isEligible ? lt.daysAllowed : 0,
          gender,
        },
      });
    }
  }

  console.log("Seeding Holidays...");
  for (const h of starterHolidays) {
    const existing = await prisma.holiday.findFirst({
      where: { name: h.name, date: h.date },
    });
    if (!existing) {
      await prisma.holiday.create({ data: h });
    }
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((error) => {
    console.error("Failed to seed database:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  })