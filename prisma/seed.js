const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.leaveGroupItem.deleteMany();
  await prisma.leaveGroup.deleteMany();
  await prisma.leaveType.deleteMany();

  const types = [
    {
      code: 'CL',
      name: 'Casual Leave',
      category: 'CASUAL',
      days: 7,
      description: 'Short-duration leave for personal and emergency needs.',
      status: 'ACTIVE',
      applicableTo: ['STUDENT'],
    },
    {
      code: 'AL',
      name: 'Annual Leave',
      category: 'ANNUAL',
      days: 15,
      description: 'Paid annual leave accrued as part of the yearly leave cycle.',
      status: 'ACTIVE',
      applicableTo: ['STUDENT'],
    },
    {
      code: 'EL',
      name: 'Earned Leave',
      category: 'ANNUAL',
      days: 12,
      description: 'Leave accumulated based on service duration and eligibility.',
      status: 'INACTIVE',
      applicableTo: ['STUDENT'],
    },
    {
      code: 'ML',
      name: 'Medical Leave',
      category: 'MEDICAL',
      days: 10,
      description: 'Leave provided for illness and treatment-related absences.',
      status: 'ACTIVE',
      applicableTo: ['STUDENT'],
    },
    {
      code: 'SL',
      name: 'Sick Leave',
      category: 'MEDICAL',
      days: 5,
      description: 'Short-term health-related leave for illness recovery.',
      status: 'ACTIVE',
      applicableTo: ['STUDENT'],
    },
    {
      code: 'LOP',
      name: 'Loss of Pay',
      category: 'SPECIAL',
      days: 0,
      description: 'Unpaid leave without salary accrual.',
      status: 'ACTIVE',
      applicableTo: ['STUDENT'],
    },
    {
      code: 'PL',
      name: 'Privilege Leave',
      category: 'SPECIAL',
      days: 8,
      description: 'Additional leave permitted under the institutional policy.',
      status: 'ACTIVE',
      applicableTo: ['STUDENT'],
    },
    {
      code: 'CO',
      name: 'Compensatory Off',
      category: 'SPECIAL',
      days: 3,
      description: 'Compensation leave for extra time worked.',
      status: 'ACTIVE',
      applicableTo: ['STUDENT'],
    },
  ];

  const createdTypes = await Promise.all(
    types.map((item) =>
      prisma.leaveType.create({
        data: { ...item },
      })
    )
  );

  const typeByCode = Object.fromEntries(createdTypes.map((type) => [type.code, type]));

  const groups = [
    {
      code: 'GEN',
      name: 'General Leave',
      description: 'General leave package combining casual, annual and earned leave.',
      effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
      leaveTypes: ['CL', 'AL', 'EL'],
    },
    {
      code: 'MED',
      name: 'Medical Leave',
      description: 'Medical and sick leave group.',
      effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
      leaveTypes: ['ML', 'SL'],
    },
    {
      code: 'UNP',
      name: 'Unpaid Leave',
      description: 'Unpaid leave category.',
      effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
      leaveTypes: ['LOP'],
    },
    {
      code: 'SPE',
      name: 'Special Leave',
      description: 'Special leave and compensatory time.',
      effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
      status: 'ACTIVE',
      leaveTypes: ['PL', 'CO'],
    },
  ];

  for (const group of groups) {
    const createdGroup = await prisma.leaveGroup.create({
      data: {
        code: group.code,
        name: group.name,
        description: group.description,
        effectiveFrom: group.effectiveFrom,
        status: group.status,
        items: {
          create: group.leaveTypes.map((code) => ({
            leaveType: {
              connect: { code },
            },
          })),
        },
      },
      include: {
        items: {
          include: {
            leaveType: true,
          },
        },
      },
    });

    console.log(`Created group: ${createdGroup.code}`);
  }

  const sampleTypes = await prisma.leaveType.findMany({
    orderBy: { code: 'asc' },
  });

  const sampleGroups = await prisma.leaveGroup.findMany({
    include: {
      items: {
        include: { leaveType: true },
      },
    },
    orderBy: { code: 'asc' },
  });

  console.log('Seeded leave types:', JSON.stringify(sampleTypes, null, 2));
  console.log('Seeded leave groups:', JSON.stringify(sampleGroups, null, 2));
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
