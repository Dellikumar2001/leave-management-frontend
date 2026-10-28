/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ============================================================================
// 1. LEAVE CATEGORIES (Leave Category Tab)
// ============================================================================
const categories = [
  {
    code: "PL-A",
    name: "PAID LEAVE AIDED",
    description: "LEAVE WITH PAY, SUBJECT TO POLICY",
    isPaid: true,
    status: "ACTIVE",
  },
  {
    code: "PL-SFS",
    name: "PAID LEAVE SFS",
    description: "LEAVE WITH PAY, SUBJECT TO POLICY",
    isPaid: true,
    status: "ACTIVE",
  },
  {
    code: "SPL-A",
    name: "SPECIAL LEAVE AIDED",
    description: "INSTITUTION-SPECIFIC LEAVE OR PERMISSION",
    isPaid: true,
    status: "ACTIVE",
  },
  {
    code: "SPL-SFS",
    name: "SPECIAL LEAVE SFS",
    description: "INSTITUTION-SPECIFIC LEAVE OR PERMISSION",
    isPaid: true,
    status: "ACTIVE",
  },
  {
    code: "STL-A",
    name: "STATUTORY LEAVE AIDED",
    description: "LEGALLY APPLICABLE LEAVE",
    isPaid: true,
    status: "ACTIVE",
  },
  {
    code: "STL-SFS",
    name: "STATUTORY LEAVE SFS",
    description: "LEGALLY APPLICABLE LEAVE",
    isPaid: true,
    status: "ACTIVE",
  },
  {
    code: "UPL-A",
    name: "UNPAID LEAVE AIDED",
    description: "LEAVE WITHOUT PAY / LOSS OF PAY",
    isPaid: false,
    status: "ACTIVE",
  },
  {
    code: "UPL-SFS",
    name: "UNPAID LEAVE SFS",
    description: "LEAVE WITHOUT PAY / LOSS OF PAY",
    isPaid: false,
    status: "ACTIVE",
  },
];

// ============================================================================
// 2. LEAVE TYPES (Leave Types Tab)
// ============================================================================
const leaveTypes = [
  {
    code: "PER_SFS",
    name: "HOURLY PERMISSION",
    description: "HOURLY",
    categoryCode: "SPL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 1,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "OD_SFS",
    name: "ON DUTY",
    description: "FULL DAY / HALF DAY",
    categoryCode: "SPL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 1,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "PL_SFS",
    name: "PATERNITY LEAVE",
    description: "FULL DAY / RULE-BASED",
    categoryCode: "STL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 0,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "ML_SFS",
    name: "MATERNITY LEAVE",
    description: "FULL DAY / RULE-BASED",
    categoryCode: "STL-A",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 0,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "LOP_SFS",
    name: "LOSS OF PAY",
    description: "FULL / HALF DAY",
    categoryCode: "UPL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 12,
    paymentType: "UNPAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "SL_SFS",
    name: "SICK LEAVE SFS",
    description: "FULL / HALF DAY",
    categoryCode: "PL-A",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "MEDICAL",
  },
  {
    code: "EL_SFS",
    name: "EARNED LEAVE",
    description: "FULL DAY",
    categoryCode: "PL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "ANNUAL",
  },
  {
    code: "CL_SFS",
    name: "CASUAL LEAVE",
    description: "FULL / HALF DAY",
    categoryCode: "PL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "CASUAL",
  },
  {
    code: "PER_A",
    name: "HOURLY PERMISSION",
    description: "HOURLY",
    categoryCode: "SPL-A",
    leaveGroup: "TEACHING - AIDED",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "OD_A",
    name: "ON DUTY",
    description: "FULL DAY / HALF DAY",
    categoryCode: "SPL-A",
    leaveGroup: "TEACHING - AIDED",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "PL_A",
    name: "PATERNITY LEAVE",
    description: "FULL DAY / RULE-BASED",
    categoryCode: "STL-A",
    leaveGroup: "TEACHING - AIDED",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "ML_A",
    name: "MATERNITY LEAVE",
    description: "FULL DAY / RULE-BASED",
    categoryCode: "STL-A",
    leaveGroup: "TEACHING - AIDED",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "LOP_A",
    name: "LOSS OF PAY",
    description: "FULL / HALF DAY",
    categoryCode: "UPL-A",
    leaveGroup: "TEACHING - AIDED",
    daysAllowed: 12,
    paymentType: "UNPAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
  {
    code: "SL_A",
    name: "SICK LEAVE",
    description: "FULL / HALF DAY",
    categoryCode: "PL-A",
    leaveGroup: "TEACHING - AIDED",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "MEDICAL",
  },
  {
    code: "EL_A",
    name: "EARNED LEAVE",
    description: "FULL DAY",
    categoryCode: "PL-A",
    leaveGroup: "TEACHING - AIDED",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "ANNUAL",
  },
  {
    code: "CL_A",
    name: "CASUAL LEAVE",
    description: "FULL / HALF DAY",
    categoryCode: "PL-A",
    leaveGroup: "TEACHING - AIDED",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "CASUAL",
  },
  {
    code: "CL",
    name: "Casual Leave",
    description: "Annual casual leave allowance",
    categoryCode: "PL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "CASUAL",
  },
  {
    code: "SL",
    name: "Sick Leave",
    description: "Sick and medical leave allowance",
    categoryCode: "PL-A",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "MEDICAL",
  },
  {
    code: "EL",
    name: "Earned Leave",
    description: "Earned annual leave allowance",
    categoryCode: "PL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 12,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "ANNUAL",
  },
  {
    code: "RH",
    name: "Restricted Holiday",
    description: "Restricted holiday leave",
    categoryCode: "SPL-SFS",
    leaveGroup: "TEACHING - SFS",
    daysAllowed: 3,
    paymentType: "PAID",
    status: "ACTIVE",
    categoryEnum: "SPECIAL",
  },
];

// ============================================================================
// 3. LEAVE GROUPS (Leave Groups Tab)
// ============================================================================
const leaveGroups = [
  {
    code: "TS",
    name: "TEACHING - SFS",
    description: "TEACHING - SFS LEAVE GROUP",
    effectiveFrom: new Date("2026-10-21"),
    status: "ACTIVE",
    categoryCodes: ["PL-SFS", "SPL-SFS", "STL-SFS", "UPL-SFS"],
    typeCodes: ["PL_SFS", "OD_SFS", "PER_SFS", "ML_SFS", "LOP_SFS", "SL_SFS", "EL_SFS", "CL_SFS"],
  },
  {
    code: "TA",
    name: "TEACHING - AIDED",
    description: "TEACHING - AIDED LEAVE GROUP",
    effectiveFrom: new Date("2026-10-21"),
    status: "ACTIVE",
    categoryCodes: ["PL-A", "SPL-A", "STL-A", "UPL-A"],
    typeCodes: ["CL_A", "EL_A", "SL_A", "LOP_A", "ML_A", "PL_A", "OD_A", "PER_A"],
  },
  {
    code: "NTA",
    name: "NON-TEACHING - AIDED",
    description: "NON-TEACHING - AIDED LEAVE GROUP",
    effectiveFrom: new Date("2026-10-21"),
    status: "ACTIVE",
    categoryCodes: ["PL-A", "SPL-A", "STL-A", "UPL-A"],
    typeCodes: ["CL_A", "EL_A", "SL_A", "LOP_A", "ML_A", "PL_A", "PER_A"],
  },
  {
    code: "NTS",
    name: "NON-TEACHING - SFS",
    description: "NON-TEACHING - SFS LEAVE GROUP",
    effectiveFrom: new Date("2026-10-21"),
    status: "ACTIVE",
    categoryCodes: ["PL-SFS", "SPL-SFS", "STL-SFS", "UPL-SFS"],
    typeCodes: ["CL_A", "EL_A", "SL_A", "LOP_A", "ML_A", "PL_A", "PER_A"],
  },
  {
    code: "ADMA",
    name: "ADMINISTRATIVE - AIDED",
    description: "ADMINISTRATIVE - AIDED LEAVE GROUP",
    effectiveFrom: new Date("2026-10-21"),
    status: "ACTIVE",
    categoryCodes: ["PL-A", "SPL-A", "STL-A", "UPL-A"],
    typeCodes: ["CL_A", "EL_A", "SL_A", "LOP_A", "ML_A", "PL_A", "PER_A"],
  },
  {
    code: "ADMS",
    name: "ADMINISTRATIVE - SFS",
    description: "ADMINISTRATIVE - SFS LEAVE GROUP",
    effectiveFrom: new Date("2026-10-21"),
    status: "ACTIVE",
    categoryCodes: ["SPL-SFS", "PL-SFS", "STL-SFS", "UPL-SFS"],
    typeCodes: ["CL_A", "EL_A", "SL_A", "LOP_A", "ML_A", "PL_A", "PER_A"],
  },
];

// ============================================================================
// 4. LEAVE ELIGIBILITY (Leave Eligibility Tab)
// ============================================================================
const leaveEligibilities = [
  // Rows 10-19 as shown in screenshot
  {
    eligibilityName: "SFS - ADMINISTRATIVE - PERMANENT",
    managementStream: "SFS",
    employeeType: "ADMINISTRATIVE",
    employmentType: "PERMANENT",
    description: "ALL DEPARTMENTS",
    leaveGroup: "ADMINISTRATIVE - SFS",
    status: "ACTIVE",
  },
  {
    eligibilityName: "AIDED - ADMINISTRATIVE - PERMANENT",
    managementStream: "AIDED",
    employeeType: "ADMINISTRATIVE",
    employmentType: "PERMANENT",
    description: "ALL DEPARTMENTS",
    leaveGroup: "ADMINISTRATIVE - AIDED",
    status: "ACTIVE",
  },
  {
    eligibilityName: "SFS - NON-TEACHING - PERMANENT",
    managementStream: "SFS",
    employeeType: "NON-TEACHING",
    employmentType: "PERMANENT",
    description: "ALL DEPARTMENTS",
    leaveGroup: "NON-TEACHING - SFS",
    status: "ACTIVE",
  },
  {
    eligibilityName: "AIDED - NON-TEACHING - PERMANENT",
    managementStream: "AIDED",
    employeeType: "NON-TEACHING",
    employmentType: "PERMANENT",
    description: "ALL DEPARTMENTS",
    leaveGroup: "NON-TEACHING - AIDED",
    status: "ACTIVE",
  },
  {
    eligibilityName: "SFS - TEACHING - PROBATION",
    managementStream: "SFS",
    employeeType: "TEACHING",
    employmentType: "PROBATION",
    description: "ALL DEPARTMENTS",
    leaveGroup: "TEACHING - SFS",
    status: "ACTIVE",
  },
  {
    eligibilityName: "SFS - TEACHING - CONTRACT",
    managementStream: "SFS",
    employeeType: "TEACHING",
    employmentType: "CONTRACT",
    description: "ALL DEPARTMENTS",
    leaveGroup: "TEACHING - SFS",
    status: "ACTIVE",
  },
  {
    eligibilityName: "SFS - TEACHING - PERMANENT",
    managementStream: "SFS",
    employeeType: "TEACHING",
    employmentType: "PERMANENT",
    description: "ALL DEPARTMENTS",
    leaveGroup: "TEACHING - SFS",
    status: "ACTIVE",
  },
  {
    eligibilityName: "AIDED - TEACHING - PROBATION",
    managementStream: "AIDED",
    employeeType: "TEACHING",
    employmentType: "PROBATION",
    description: "ALL DEPARTMENTS",
    leaveGroup: "TEACHING - AIDED",
    status: "ACTIVE",
  },
  {
    eligibilityName: "AIDED - TEACHING - CONTRACT",
    managementStream: "AIDED",
    employeeType: "TEACHING",
    employmentType: "CONTRACT",
    description: "ALL DEPARTMENTS",
    leaveGroup: "TEACHING - AIDED",
    status: "ACTIVE",
  },
  {
    eligibilityName: "AIDED - TEACHING - PERMANENT",
    managementStream: "AIDED",
    employeeType: "TEACHING",
    employmentType: "PERMANENT",
    description: "ALL DEPARTMENTS",
    leaveGroup: "TEACHING - AIDED",
    status: "ACTIVE",
  },
];

// ============================================================================
// 5. EMPLOYEES & COMPATIBILITY DATA
// ============================================================================
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

const starterHolidays = [
  { date: new Date("2026-01-01"), name: "New Year's Day", type: "Gazetted", description: "Public Holiday", isHoliday: true, status: "active" },
  { date: new Date("2026-01-26"), name: "Republic Day", type: "National", description: "National Holiday", isHoliday: true, status: "active" },
  { date: new Date("2026-08-15"), name: "Independence Day", type: "National", description: "National Holiday", isHoliday: true, status: "active" },
  { date: new Date("2026-10-02"), name: "Gandhi Jayanti", type: "National", description: "National Holiday", isHoliday: true, status: "active" },
  { date: new Date("2026-12-25"), name: "Christmas Day", type: "Gazetted", description: "Public Holiday", isHoliday: true, status: "active" },
];

async function main() {
  console.log("=================================================");
  console.log("🌱 Seeding Database from Screenshot Datasets...");
  console.log("=================================================");

  // 1. Seed Leave Categories
  console.log("\n1. Seeding Leave Categories (10 categories)...");
  const categoryMap = {};
  for (const cat of categories) {
    const record = await prisma.leaveCategoryMaster.upsert({
      where: { code: cat.code },
      update: {
        name: cat.name,
        description: cat.description,
        isPaid: cat.isPaid,
        status: cat.status,
      },
      create: {
        code: cat.code,
        name: cat.name,
        description: cat.description,
        isPaid: cat.isPaid,
        status: cat.status,
      },
    });
    categoryMap[cat.code] = record.id;
  }
  console.log(`✓ Seeded ${Object.keys(categoryMap).length} Leave Categories.`);

  // 2. Seed Leave Types
  console.log("\n2. Seeding Leave Types (16 types)...");
  const leaveTypeMap = {};
  for (const lt of leaveTypes) {
    const categoryMasterId = categoryMap[lt.categoryCode] || null;
    const record = await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {
        name: lt.name,
        description: lt.description,
        daysAllowed: lt.daysAllowed,
        status: lt.status,
        leaveGroup: lt.leaveGroup,
        paymentType: lt.paymentType,
        categoryMasterId,
        category: lt.categoryEnum,
      },
      create: {
        code: lt.code,
        name: lt.name,
        description: lt.description,
        daysAllowed: lt.daysAllowed,
        status: lt.status,
        leaveGroup: lt.leaveGroup,
        paymentType: lt.paymentType,
        categoryMasterId,
        category: lt.categoryEnum,
      },
    });
    leaveTypeMap[lt.code] = record.id;
  }
  console.log(`✓ Seeded ${Object.keys(leaveTypeMap).length} Leave Types.`);

  // 3. Seed Leave Groups & Relations
  console.log("\n3. Seeding Leave Groups (9 groups)...");
  for (const grp of leaveGroups) {
    const primaryCategoryId = grp.categoryCodes.length > 0 ? categoryMap[grp.categoryCodes[0]] : null;
    const groupRecord = await prisma.leaveGroup.upsert({
      where: { code: grp.code },
      update: {
        name: grp.name,
        description: grp.description,
        effectiveFrom: grp.effectiveFrom,
        status: grp.status,
        categoryId: primaryCategoryId,
      },
      create: {
        code: grp.code,
        name: grp.name,
        description: grp.description,
        effectiveFrom: grp.effectiveFrom,
        status: grp.status,
        categoryId: primaryCategoryId,
      },
    });

    // Link Categories
    for (const catCode of grp.categoryCodes) {
      const categoryId = categoryMap[catCode];
      if (categoryId) {
        await prisma.leaveGroupCategory.upsert({
          where: {
            leaveGroupId_categoryId: {
              leaveGroupId: groupRecord.id,
              categoryId,
            },
          },
          update: {},
          create: {
            leaveGroupId: groupRecord.id,
            categoryId,
          },
        });
      }
    }

    // Link Leave Types
    for (const typeCode of grp.typeCodes) {
      const leaveTypeId = leaveTypeMap[typeCode];
      if (leaveTypeId) {
        await prisma.leaveGroupItem.upsert({
          where: {
            leaveGroupId_leaveTypeId: {
              leaveGroupId: groupRecord.id,
              leaveTypeId,
            },
          },
          update: {},
          create: {
            leaveGroupId: groupRecord.id,
            leaveTypeId,
          },
        });
      }
    }
  }
  console.log(`✓ Seeded ${leaveGroups.length} Leave Groups with Categories and Types.`);

  // 4. Seed Leave Eligibility Configurations
  console.log("\n4. Seeding Leave Eligibility Configs (19 rules)...");
  for (const elig of leaveEligibilities) {
    const existing = await prisma.leaveEligibility.findFirst({
      where: { eligibilityName: elig.eligibilityName },
    });

    if (existing) {
      await prisma.leaveEligibility.update({
        where: { id: existing.id },
        data: elig,
      });
    } else {
      await prisma.leaveEligibility.create({
        data: elig,
      });
    }
  }
  console.log(`✓ Seeded ${leaveEligibilities.length} Leave Eligibility rules.`);

  // 5. Seed Employees & Employee Leave Eligibility
  console.log("\n5. Seeding Employees & Employee Eligibility Records...");
  const allLeaveTypes = await prisma.leaveType.findMany();

  for (const employee of employees) {
    const gender = employeeGenders[employee.employeeId] || "Male";
    const existingEmp = await prisma.employee.findUnique({
      where: { employeeId: employee.employeeId },
      select: { religion: true },
    });
    const religion = existingEmp?.religion || religions[Math.floor(Math.random() * religions.length)];

    await prisma.employee.upsert({
      where: { employeeId: employee.employeeId },
      update: {
        name: employee.name,
        stream: employee.stream,
        department: employee.department,
        status: employee.status,
        gender,
        religion,
      },
      create: {
        ...employee,
        gender,
        religion,
      },
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
          creditedDays: 0,
          leaveBalance: isEligible ? lt.daysAllowed : 0,
        },
        create: {
          employeeId: employee.employeeId,
          leaveTypeId: lt.id,
          isEligible,
          daysAllowed: isEligible ? lt.daysAllowed : 0,
          creditedDays: 0,
          leaveBalance: isEligible ? lt.daysAllowed : 0,
          gender,
        },
      });
    }
  }
  console.log(`✓ Seeded ${employees.length} Employees with Leave Eligibility links.`);

  // 6. Seed Approvers
  console.log("\n6. Seeding Approvers...");
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
  console.log(`✓ Seeded Approvers.`);

  // 7. Seed Holidays
  console.log("\n7. Seeding Holidays...");
  for (const h of starterHolidays) {
    const existing = await prisma.holiday.findFirst({
      where: { name: h.name, date: h.date },
    });
    if (!existing) {
      await prisma.holiday.create({ data: h });
    }
  }
  console.log(`✓ Seeded Holidays.`);

  // 8. Seed Sample Leave Applications for Demo/Reports
  console.log("\n8. Seeding Leave Applications with new Leave Types...");
  const applications = [
    // EMP-001 (Anandh - SFS)
    { employeeId: "EMP-001", typeCode: "CL_SFS", startDate: new Date("2026-02-10"), endDate: new Date("2026-02-11"), daysCount: 2, reason: "Family Function", status: "Approved", reviewedBy: "CS HOD", remarks: "Granted as requested." },
    { employeeId: "EMP-001", typeCode: "SL_SFS", startDate: new Date("2026-04-05"), endDate: new Date("2026-04-07"), daysCount: 3, reason: "Viral fever and recovery", status: "Approved", reviewedBy: "CS HOD", remarks: "Medical certificate verified." },
    { employeeId: "EMP-001", typeCode: "EL_SFS", startDate: new Date("2026-07-15"), endDate: new Date("2026-07-20"), daysCount: 6, reason: "Annual family travel", status: "Approved", reviewedBy: "Dean of Academics", remarks: "Approved with alternate class arrangement." },
    { employeeId: "EMP-001", typeCode: "CL_SFS", startDate: new Date("2026-09-02"), endDate: new Date("2026-09-03"), daysCount: 2, reason: "Personal urgent errands", status: "Approved", reviewedBy: "CS HOD", remarks: "Approved." },
    { employeeId: "EMP-001", typeCode: "CL_SFS", startDate: new Date("2026-10-20"), endDate: new Date("2026-10-21"), daysCount: 2, reason: "Attending tech conference", status: "Pending", reviewedBy: "CS HOD", remarks: "Under review." },
    // EMP-002 (Arjun - AIDED)
    { employeeId: "EMP-002", typeCode: "CL_A", startDate: new Date("2026-01-15"), endDate: new Date("2026-01-16"), daysCount: 2, reason: "Personal commitment", status: "Approved", reviewedBy: "Commerce HOD", remarks: "Approved." },
    { employeeId: "EMP-002", typeCode: "SL_A", startDate: new Date("2026-03-12"), endDate: new Date("2026-03-14"), daysCount: 3, reason: "Severe migraine and rest", status: "Approved", reviewedBy: "Commerce HOD", remarks: "Approved." },
    { employeeId: "EMP-002", typeCode: "EL_A", startDate: new Date("2026-08-10"), endDate: new Date("2026-08-14"), daysCount: 5, reason: "Personal leave", status: "Rejected", reviewedBy: "Dean", remarks: "Conflict with examination duty schedule." },
    { employeeId: "EMP-002", typeCode: "CL_A", startDate: new Date("2026-10-25"), endDate: new Date("2026-10-26"), daysCount: 2, reason: "Attending seminar", status: "Pending", reviewedBy: "Commerce HOD", remarks: "Awaiting recommendation." },
    // EMP-003 (Diya Menon - SFS)
    { employeeId: "EMP-003", typeCode: "ML_SFS", startDate: new Date("2026-02-01"), endDate: new Date("2026-07-30"), daysCount: 180, reason: "Statutory maternity leave", status: "Approved", reviewedBy: "Principal", remarks: "Statutory leave sanctioned." },
    { employeeId: "EMP-003", typeCode: "CL_SFS", startDate: new Date("2026-09-15"), endDate: new Date("2026-09-16"), daysCount: 2, reason: "Child health checkup", status: "Approved", reviewedBy: "English HOD", remarks: "Approved." },
    // EMP-004 (Venkatesh - AIDED)
    { employeeId: "EMP-004", typeCode: "CL_A", startDate: new Date("2026-02-18"), endDate: new Date("2026-02-19"), daysCount: 2, reason: "Personal work", status: "Approved", reviewedBy: "Mathematics HOD", remarks: "Approved." },
    { employeeId: "EMP-004", typeCode: "SL_A", startDate: new Date("2026-05-11"), endDate: new Date("2026-05-13"), daysCount: 3, reason: "Knee sprain treatment", status: "Approved", reviewedBy: "Mathematics HOD", remarks: "Medical receipt submitted." },
    // EMP-005 (Kavya - SFS)
    { employeeId: "EMP-005", typeCode: "CL_SFS", startDate: new Date("2026-03-05"), endDate: new Date("2026-03-06"), daysCount: 2, reason: "Family wedding ceremony", status: "Approved", reviewedBy: "Physics HOD", remarks: "Granted." },
    { employeeId: "EMP-005", typeCode: "EL_SFS", startDate: new Date("2026-06-10"), endDate: new Date("2026-06-18"), daysCount: 9, reason: "Summer vacation travel", status: "Approved", reviewedBy: "Dean", remarks: "Approved." },
    // EMP-006 (Rohan Das - AIDED)
    { employeeId: "EMP-006", typeCode: "PL_A", startDate: new Date("2026-04-10"), endDate: new Date("2026-04-24"), daysCount: 15, reason: "Paternity statutory leave", status: "Approved", reviewedBy: "CS HOD", remarks: "Childbirth statutory leave." },
    { employeeId: "EMP-006", typeCode: "CL_A", startDate: new Date("2026-08-20"), endDate: new Date("2026-08-21"), daysCount: 2, reason: "Personal emergency", status: "Cancelled", reviewedBy: "CS HOD", remarks: "Cancelled by employee." },
    // EMP-007 (Sneha Thomas - SFS)
    { employeeId: "EMP-007", typeCode: "CL_SFS", startDate: new Date("2026-02-25"), endDate: new Date("2026-02-26"), daysCount: 2, reason: "Family commitment", status: "Approved", reviewedBy: "Commerce HOD", remarks: "Approved." },
    { employeeId: "EMP-007", typeCode: "SL_SFS", startDate: new Date("2026-06-04"), endDate: new Date("2026-06-06"), daysCount: 3, reason: "Seasonal flu recovery", status: "Approved", reviewedBy: "Commerce HOD", remarks: "Approved." },
    // EMP-008 (Vikram - AIDED)
    { employeeId: "EMP-008", typeCode: "CL_A", startDate: new Date("2026-03-15"), endDate: new Date("2026-03-16"), daysCount: 2, reason: "Personal work", status: "Approved", reviewedBy: "English HOD", remarks: "Approved." },
    { employeeId: "EMP-008", typeCode: "EL_A", startDate: new Date("2026-07-01"), endDate: new Date("2026-07-05"), daysCount: 5, reason: "Personal travel", status: "Approved", reviewedBy: "Dean", remarks: "Approved." },
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

  // 9. Seed Approval Test Requests
  console.log("\n9. Seeding Approval Queue Test Requests...");
  const approvalTestRequests = [
    { employeeId: "EMP-001", typeCode: "CL_SFS", startDate: new Date("2026-11-02"), endDate: new Date("2026-11-03"), daysCount: 2, currentApprovalLevel: 1, reason: "[TEST] Level 1 accept or reject" },
    { employeeId: "EMP-002", typeCode: "CL_A", startDate: new Date("2026-11-04"), endDate: new Date("2026-11-05"), daysCount: 2, currentApprovalLevel: 1, reason: "[TEST] Level 1 decision" },
    { employeeId: "EMP-003", typeCode: "SL_SFS", startDate: new Date("2026-11-09"), endDate: new Date("2026-11-10"), daysCount: 2, currentApprovalLevel: 2, reason: "[TEST] Level 2 accept or reject" },
    { employeeId: "EMP-004", typeCode: "EL_A", startDate: new Date("2026-11-16"), endDate: new Date("2026-11-20"), daysCount: 5, currentApprovalLevel: 3, reason: "[TEST] Level 3 accept or reject" },
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
      continue;
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

  // 10. Seed Credit Annual Leave & Credit Medical Leave
  console.log("\n10. Seeding Credit Annual Leave & Credit Medical Leave...");
  await prisma.leaveCredit.deleteMany();
  await prisma.employeeLeaveBalance.deleteMany();

  const creditSeeds = [
    // EMP-001 (Anandh - SFS)
    { employeeId: "EMP-001", category: "ANNUAL", days: 5, date: new Date("2026-01-15") },
    { employeeId: "EMP-001", category: "MEDICAL", days: 3, date: new Date("2026-01-20") },
    // EMP-002 (Arjun - AIDED)
    { employeeId: "EMP-002", category: "ANNUAL", days: 4, date: new Date("2026-01-15") },
    { employeeId: "EMP-002", category: "MEDICAL", days: 2, date: new Date("2026-01-20") },
    // EMP-003 (Diya Menon - SFS)
    { employeeId: "EMP-003", category: "ANNUAL", days: 6, date: new Date("2026-02-01") },
    { employeeId: "EMP-003", category: "MEDICAL", days: 4, date: new Date("2026-02-05") },
    // EMP-004 (Venkatesh - AIDED)
    { employeeId: "EMP-004", category: "ANNUAL", days: 5, date: new Date("2026-01-15") },
    { employeeId: "EMP-004", category: "MEDICAL", days: 3, date: new Date("2026-01-20") },
    // EMP-005 (Kavya - SFS)
    { employeeId: "EMP-005", category: "ANNUAL", days: 3, date: new Date("2026-02-10") },
    { employeeId: "EMP-005", category: "MEDICAL", days: 2, date: new Date("2026-02-15") },
    // EMP-006 (Rohan Das - AIDED)
    { employeeId: "EMP-006", category: "ANNUAL", days: 4, date: new Date("2026-01-15") },
    { employeeId: "EMP-006", category: "MEDICAL", days: 3, date: new Date("2026-01-20") },
    // EMP-007 (Sneha Thomas - SFS)
    { employeeId: "EMP-007", category: "ANNUAL", days: 5, date: new Date("2026-02-01") },
    { employeeId: "EMP-007", category: "MEDICAL", days: 4, date: new Date("2026-02-05") },
    // EMP-008 (Vikram - AIDED)
    { employeeId: "EMP-008", category: "ANNUAL", days: 6, date: new Date("2026-01-15") },
    { employeeId: "EMP-008", category: "MEDICAL", days: 2, date: new Date("2026-01-20") },
  ];

  for (const credit of creditSeeds) {
    let targetLeaveType = null;
    if (credit.category === "ANNUAL") {
      const empCls = await prisma.employeeLeaveEligibility.findMany({
        where: {
          employeeId: credit.employeeId,
          leaveType: {
            status: "ACTIVE",
            OR: [
              { code: { equals: "CL", mode: "insensitive" } },
              { code: { startsWith: "CL_", mode: "insensitive" } },
              { name: { contains: "CASUAL", mode: "insensitive" } },
            ],
          },
        },
        include: { leaveType: true },
      });
      const matched = empCls.find((r) => r.leaveType.code.toUpperCase() === "CL") || empCls[0];
      targetLeaveType = matched?.leaveType || null;
    } else if (credit.category === "MEDICAL") {
      const empMls = await prisma.employeeLeaveEligibility.findMany({
        where: {
          employeeId: credit.employeeId,
          leaveType: {
            status: "ACTIVE",
            NOT: [{ name: { contains: "MATERNITY", mode: "insensitive" } }],
            OR: [
              { code: { equals: "ML", mode: "insensitive" } },
              { code: { startsWith: "ML_", mode: "insensitive" } },
              { name: { contains: "MEDICAL", mode: "insensitive" } },
            ],
          },
        },
        include: { leaveType: true },
      });
      const matched =
        empMls.find((r) => r.leaveType.code.toUpperCase() === "ML") ||
        empMls.find((r) => r.leaveType.name.toUpperCase().includes("MEDICAL")) ||
        empMls[0];
      targetLeaveType = matched?.leaveType || null;
    }

    await prisma.leaveCredit.create({
      data: {
        employeeId: credit.employeeId,
        category: credit.category,
        days: credit.days,
        startDate: credit.date,
        endDate: credit.date,
        leaveTypeId: targetLeaveType ? targetLeaveType.id : null,
      },
    });

    await prisma.employeeLeaveBalance.upsert({
      where: {
        employeeId_category: {
          employeeId: credit.employeeId,
          category: credit.category,
        },
      },
      update: {
        balance: { increment: credit.days },
      },
      create: {
        employeeId: credit.employeeId,
        category: credit.category,
        balance: credit.days,
      },
    });

    if (targetLeaveType) {
      await prisma.employeeLeaveEligibility.update({
        where: {
          employeeId_leaveTypeId: {
            employeeId: credit.employeeId,
            leaveTypeId: targetLeaveType.id,
          },
        },
        data: {
          creditedDays: { increment: credit.days },
          leaveBalance: { increment: credit.days },
        },
      });
    }

    await prisma.employeeNotification.create({
      data: {
        employeeId: credit.employeeId,
        title: `${credit.category === "ANNUAL" ? "Annual" : "Medical"} leave credited`,
        content: `${credit.days} day${credit.days === 1 ? "" : "s"} of ${credit.category.toLowerCase()} leave have been credited to your balance.`,
        type: "LEAVE_CREDITED",
      },
    });
  }
  console.log(`✓ Seeded ${creditSeeds.length} Leave Credits for Annual and Medical leave.`);

  console.log("\n=================================================");
  console.log("✅ SeedData executed successfully!");
  console.log("=================================================");
}

main()
  .catch((error) => {
    console.error("❌ Failed to seed database:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
