const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function calculateLeaveBalance(annualEntitlement: number, joiningDate: Date, leaveYear: number) {
  const yearStart = Date.UTC(leaveYear, 0, 1);
  const yearEnd = Date.UTC(leaveYear + 1, 0, 1) - DAY_IN_MILLISECONDS;
  const joiningDay = Date.UTC(
    joiningDate.getUTCFullYear(),
    joiningDate.getUTCMonth(),
    joiningDate.getUTCDate(),
  );

  if (joiningDay > yearEnd) return 0;

  const eligibleStart = Math.max(joiningDay, yearStart);
  const remainingDays = Math.floor((yearEnd - eligibleStart) / DAY_IN_MILLISECONDS) + 1;
  const daysInYear = Math.round((yearEnd - yearStart) / DAY_IN_MILLISECONDS) + 1;

  return Math.round((annualEntitlement * remainingDays) / daysInYear);
}