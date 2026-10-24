/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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

const religions = ["Hindu", "Christian", "Muslim", "Sikh", "Jain", "Buddhist"];

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
    const gender = employeeGenders[employee.employeeId] || "Male";
    const existingEmp = await prisma.employee.findUnique({
      where: { employeeId: employee.employeeId },
      select: { religion: true },
    });
    const religion = existingEmp?.religion || religions[Math.floor(Math.random() * religions.length)];
    await prisma.employee.upsert({
      where: { employeeId: employee.employeeId },
      update: { name: employee.name, stream: employee.stream, department: employee.department, status: employee.status, gender, religion },
      create: { ...employee, gender, religion },
    });

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

  console.log("Seeding approvers for approval test requests...");
  const approvalTestApprovers = [
    { employeeId: "EMP-001", firstLevelApprover: "CS HOD", secondLevelApprover: "Vice Principal", finalLevelApprover: "Principal", backupOfficer: "Dean" },
    { employeeId: "EMP-002", firstLevelApprover: "Commerce HOD", secondLevelApprover: "Vice Principal", finalLevelApprover: "Principal", backupOfficer: "Dean" },
    { employeeId: "EMP-003", firstLevelApprover: "English HOD", secondLevelApprover: "Vice Principal", finalLevelApprover: "Principal", backupOfficer: "Dean" },
    { employeeId: "EMP-004", firstLevelApprover: "Mathematics HOD", secondLevelApprover: "Vice Principal", finalLevelApprover: "Principal", backupOfficer: "Dean" },
  ];
  for (const approvers of approvalTestApprovers) {
    const existing = await prisma.employeeApprover.findUnique({
      where: { employeeId: approvers.employeeId },
    });
    if (existing) {
      const missingApprovers = Object.fromEntries(
        Object.entries(approvers)
          .filter(([field]) => field !== "employeeId")
          .filter(([field]) => !existing[field]?.trim())
      );
      if (Object.keys(missingApprovers).length > 0) {
        await prisma.employeeApprover.update({
          where: { employeeId: approvers.employeeId },
          data: missingApprovers,
        });
      }
    } else {
      await prisma.employeeApprover.create({ data: approvers });
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

  console.log("Seeding Employee Leave Applications...");
  const leaveTypeMap = {};
  for (const lt of allLeaveTypes) {
    leaveTypeMap[lt.code] = lt.id;
  }

  const applications = [
    // EMP-001 (Anandh)
    { employeeId: "EMP-001", typeCode: "CL", startDate: new Date("2026-02-10"), endDate: new Date("2026-02-11"), daysCount: 2, reason: "Family Function", status: "Approved", reviewedBy: "CS HOD", remarks: "Granted as requested." },
    { employeeId: "EMP-001", typeCode: "ML", startDate: new Date("2026-04-05"), endDate: new Date("2026-04-07"), daysCount: 3, reason: "Viral fever and recovery", status: "Approved", reviewedBy: "CS HOD", remarks: "Medical certificate verified." },
    { employeeId: "EMP-001", typeCode: "EL", startDate: new Date("2026-07-15"), endDate: new Date("2026-07-20"), daysCount: 6, reason: "Annual family travel", status: "Approved", reviewedBy: "Dean of Academics", remarks: "Approved with alternate class arrangement." },
    { employeeId: "EMP-001", typeCode: "CL", startDate: new Date("2026-09-02"), endDate: new Date("2026-09-03"), daysCount: 2, reason: "Personal urgent errands", status: "Approved", reviewedBy: "CS HOD", remarks: "Approved." },
    { employeeId: "EMP-001", typeCode: "CL", startDate: new Date("2026-10-20"), endDate: new Date("2026-10-21"), daysCount: 2, reason: "Attending tech conference", status: "Pending", reviewedBy: "CS HOD", remarks: "Under review." },
    // EMP-002 (Arjun)
    { employeeId: "EMP-002", typeCode: "CL", startDate: new Date("2026-01-15"), endDate: new Date("2026-01-16"), daysCount: 2, reason: "Personal commitment", status: "Approved", reviewedBy: "Commerce HOD", remarks: "Approved." },
    { employeeId: "EMP-002", typeCode: "ML", startDate: new Date("2026-03-12"), endDate: new Date("2026-03-14"), daysCount: 3, reason: "Severe migraine and rest", status: "Approved", reviewedBy: "Commerce HOD", remarks: "Approved." },
    { employeeId: "EMP-002", typeCode: "EL", startDate: new Date("2026-08-10"), endDate: new Date("2026-08-14"), daysCount: 5, reason: "Personal leave", status: "Rejected", reviewedBy: "Dean", remarks: "Conflict with examination duty schedule." },
    { employeeId: "EMP-002", typeCode: "CL", startDate: new Date("2026-10-25"), endDate: new Date("2026-10-26"), daysCount: 2, reason: "Attending seminar", status: "Pending", reviewedBy: "Commerce HOD", remarks: "Awaiting recommendation." },
    // EMP-003 (Diya Menon)
    { employeeId: "EMP-003", typeCode: "MLV", startDate: new Date("2026-02-01"), endDate: new Date("2026-07-30"), daysCount: 180, reason: "Statutory maternity leave", status: "Approved", reviewedBy: "Principal", remarks: "Statutory leave sanctioned." },
    { employeeId: "EMP-003", typeCode: "CL", startDate: new Date("2026-09-15"), endDate: new Date("2026-09-16"), daysCount: 2, reason: "Child health checkup", status: "Approved", reviewedBy: "English HOD", remarks: "Approved." },
    // EMP-004 (Venkatesh)
    { employeeId: "EMP-004", typeCode: "CL", startDate: new Date("2026-02-18"), endDate: new Date("2026-02-19"), daysCount: 2, reason: "Personal work", status: "Approved", reviewedBy: "Mathematics HOD", remarks: "Approved." },
    { employeeId: "EMP-004", typeCode: "ML", startDate: new Date("2026-05-11"), endDate: new Date("2026-05-13"), daysCount: 3, reason: "Knee sprain treatment", status: "Approved", reviewedBy: "Mathematics HOD", remarks: "Medical receipt submitted." },
    // EMP-005 (Kavya)
    { employeeId: "EMP-005", typeCode: "CL", startDate: new Date("2026-03-05"), endDate: new Date("2026-03-06"), daysCount: 2, reason: "Family wedding ceremony", status: "Approved", reviewedBy: "Physics HOD", remarks: "Granted." },
    { employeeId: "EMP-005", typeCode: "EL", startDate: new Date("2026-06-10"), endDate: new Date("2026-06-18"), daysCount: 9, reason: "Summer vacation travel", status: "Approved", reviewedBy: "Dean", remarks: "Approved." },
    // EMP-006 (Rohan Das)
    { employeeId: "EMP-006", typeCode: "PL", startDate: new Date("2026-04-10"), endDate: new Date("2026-04-24"), daysCount: 15, reason: "Paternity statutory leave", status: "Approved", reviewedBy: "CS HOD", remarks: "Childbirth statutory leave." },
    { employeeId: "EMP-006", typeCode: "CL", startDate: new Date("2026-08-20"), endDate: new Date("2026-08-21"), daysCount: 2, reason: "Personal emergency", status: "Cancelled", reviewedBy: "CS HOD", remarks: "Cancelled by employee." },
    // EMP-007 (Sneha Thomas)
    { employeeId: "EMP-007", typeCode: "CL", startDate: new Date("2026-02-25"), endDate: new Date("2026-02-26"), daysCount: 2, reason: "Family commitment", status: "Approved", reviewedBy: "Commerce HOD", remarks: "Approved." },
    { employeeId: "EMP-007", typeCode: "ML", startDate: new Date("2026-06-04"), endDate: new Date("2026-06-06"), daysCount: 3, reason: "Seasonal flu recovery", status: "Approved", reviewedBy: "Commerce HOD", remarks: "Approved." },
    // EMP-008 (Vikram)
    { employeeId: "EMP-008", typeCode: "CL", startDate: new Date("2026-03-15"), endDate: new Date("2026-03-16"), daysCount: 2, reason: "Personal work", status: "Approved", reviewedBy: "English HOD", remarks: "Approved." },
    { employeeId: "EMP-008", typeCode: "EL", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), daysCount: 5, reason: "Personal travel", status: "Approved", reviewedBy: "Dean", remarks: "Approved." },
  ];

  for (const app of applications) {
    const leaveTypeId = leaveTypeMap[app.typeCode];
    if (!leaveTypeId) continue;
    const existing = await prisma.employeeLeaveApplication.findFirst({
      where: {
        employeeId: app.employeeId,
        leaveTypeId,
        startDate: app.startDate,
      },
    });
    if (!existing) {
      await prisma.employeeLeaveApplication.create({
        data: {
          employeeId: app.employeeId,
          leaveTypeId,
          startDate: app.startDate,
          endDate: app.endDate,
          daysCount: app.daysCount,
          reason: app.reason,
          status: app.status,
          reviewedBy: app.reviewedBy,
          remarks: app.remarks,
        },
      });
    }
  }

  console.log("Seeding approval queue test requests...");
  const approvalTestRequests = [
    { employeeId: "EMP-001", typeCode: "CL", startDate: new Date("2026-11-02"), endDate: new Date("2026-11-03"), daysCount: 2, currentApprovalLevel: 1, reason: "[TEST] Level 1 accept or reject" },
    { employeeId: "EMP-002", typeCode: "CL", startDate: new Date("2026-11-04"), endDate: new Date("2026-11-05"), daysCount: 2, currentApprovalLevel: 1, reason: "[TEST] Level 1 decision" },
    { employeeId: "EMP-003", typeCode: "ML", startDate: new Date("2026-11-09"), endDate: new Date("2026-11-10"), daysCount: 2, currentApprovalLevel: 2, reason: "[TEST] Level 2 accept or reject" },
    { employeeId: "EMP-004", typeCode: "EL", startDate: new Date("2026-11-16"), endDate: new Date("2026-11-20"), daysCount: 5, currentApprovalLevel: 3, reason: "[TEST] Level 3 accept or reject" },
  ];

  for (const app of approvalTestRequests) {
    const leaveTypeId = leaveTypeMap[app.typeCode];
    if (!leaveTypeId) continue;

    const existing = await prisma.employeeLeaveApplication.findFirst({
      where: {
        employeeId: app.employeeId,
        leaveTypeId,
        startDate: app.startDate,
      },
    });
    if (existing) continue;

    const approvers = await prisma.employeeApprover.findUnique({
      where: { employeeId: app.employeeId },
    });
    if (!approvers?.firstLevelApprover || !approvers.secondLevelApprover || !approvers.finalLevelApprover) {
      throw new Error(`Approval test approvers are incomplete for ${app.employeeId}.`);
    }

    const approvals = [];
    if (app.currentApprovalLevel >= 2) {
      approvals.push({ level: 1, approver: approvers.firstLevelApprover, action: "APPROVED" });
    }
    if (app.currentApprovalLevel >= 3) {
      approvals.push({ level: 2, approver: approvers.secondLevelApprover, action: "APPROVED" });
    }

    await prisma.employeeLeaveApplication.create({
      data: {
        employeeId: app.employeeId,
        leaveTypeId,
        startDate: app.startDate,
        endDate: app.endDate,
        daysCount: app.daysCount,
        reason: app.reason,
        status: "Pending",
        currentApprovalLevel: app.currentApprovalLevel,
        approvals: { create: approvals },
      },
    });
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
  });