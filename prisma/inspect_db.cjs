/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Delete orphaned employee_leave_eligibilities rows (leave_type_ids that don't exist in LeaveType)
  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM employee_leave_eligibilities
    WHERE leave_type_id NOT IN (SELECT id FROM "LeaveType")
  `);
  console.log('Deleted orphaned employee_leave_eligibilities rows:', deleted);

  // Delete orphaned LeaveGroupItem rows
  const deletedLGI = await prisma.$executeRawUnsafe(`
    DELETE FROM "LeaveGroupItem"
    WHERE "leaveTypeId" NOT IN (SELECT id FROM "LeaveType")
  `);
  console.log('Deleted orphaned LeaveGroupItem rows:', deletedLGI);

  console.log('Done! Now run: npm run db:generate && npm run db:push');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
