import { calculateLeaveBalance } from "./leave-eligibility";

export type YearEndLeaveType = {
  id: number;
  code: string;
  name: string;
  status: string;
  daysAllowed: number;
  category?: string | null;
  leaveGroup?: string;
};

export type YearEndLeaveRecord = {
  leaveTypeId: number;
  isEligible: boolean;
  leaveBalance: number;
  creditedDays?: number;
  bf?: number;
  joiningDate?: string | Date;
  leaveType?: YearEndLeaveType;
};

export type YearEndEmployee = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  leaveRecords: YearEndLeaveRecord[];
};

export type YearEndLeaveValues = {
  casualUsed: number;
  casualAvailable: number;
  medicalUsed: number;
  medicalAvailable: number;
  medicalCarryForward: number;
  earnedUsed: number;
  earnedAvailable: number;
  restrictedUsed: number;
  restrictedAvailable: number;
};

export type YearEndUsageRecord = {
  leaveTypeId: number;
  status: string;
  startDate: string | Date;
  endDate: string | Date;
};

export function leaveEligibilityValue(
  leaveType: Pick<YearEndLeaveType, "status" | "daysAllowed">,
  record?: Pick<YearEndLeaveRecord, "isEligible">,
) {
  if (leaveType.status !== "ACTIVE" || record?.isEligible === false) return "Inactive";
  return `${leaveType.daysAllowed}`;
}

export function leaveTypeCategory(leaveType: YearEndLeaveType) {
  const label = [
    leaveType.code,
    leaveType.name,
    leaveType.category ?? "",
  ].join(" ").toUpperCase();

  if (/MEDICAL|SICK/.test(label)) return "medical";
  if (/CASUAL|GENERAL|\bCL\b/.test(label)) return "casual";
  if (/RESTRICTED|OPTIONAL HOLIDAY|\bRH\b/.test(label)) return "restricted";
  if (/EARNED|ANNUAL|\bEL\b/.test(label) || leaveType.category?.toUpperCase() === "ANNUAL") return "earned";
  return null;
}

export function getYearEndLeaveValues(
  employee: YearEndEmployee,
  leaveTypes: YearEndLeaveType[],
  usageRecords: YearEndUsageRecord[],
  academicYearStart: number,
  medicalCarryForward: number,
): YearEndLeaveValues {
  const values: YearEndLeaveValues = {
    casualUsed: 0,
    casualAvailable: 0,
    medicalUsed: 0,
    medicalAvailable: 0,
    medicalCarryForward,
    earnedUsed: 0,
    earnedAvailable: 0,
    restrictedUsed: 0,
    restrictedAvailable: 0,
  };
  const periodStart = Date.UTC(academicYearStart, 6, 1);
  const periodEnd = Date.UTC(academicYearStart + 1, 6, 0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const leaveType of leaveTypes) {
    const category = leaveTypeCategory(leaveType);
    if (!category) continue;
    const record = employee.leaveRecords.find(({ leaveTypeId }) => leaveTypeId === leaveType.id);
    const eligible = leaveEligibilityValue(leaveType, record) !== "Inactive";
    const entitled = eligible && record?.joiningDate
      ? calculateLeaveBalance(
          leaveType.daysAllowed,
          new Date(record.joiningDate),
          academicYearStart,
        ) + (record.creditedDays ?? 0) + (record.bf ?? 0)
      : 0;
    const used = usageRecords
      .filter((usage) =>
        usage.leaveTypeId === leaveType.id &&
        usage.status.toUpperCase() === "APPROVED" &&
        new Date(usage.endDate).getTime() < today.getTime(),
      )
      .reduce((total, usage) => {
        const start = Math.max(new Date(usage.startDate).getTime(), periodStart);
        const end = Math.min(new Date(usage.endDate).getTime(), periodEnd);
        return end < start ? total : total + Math.floor((end - start) / 86_400_000) + 1;
      }, 0);
    const available = Math.max(0, entitled - used);

    if (category === "medical") {
      values.medicalUsed += used;
      values.medicalAvailable += available;
    } else if (category === "casual") {
      values.casualUsed += used;
      values.casualAvailable += available;
    } else if (category === "earned") {
      values.earnedUsed += used;
      values.earnedAvailable += available;
    } else if (category === "restricted") {
      values.restrictedUsed += used;
      values.restrictedAvailable += available;
    }
  }

  return values;
}

export function academicYearStartFor(date: Date) {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

export function formatAcademicYear(startYear: number) {
  return `${startYear}-${startYear + 1}`;
}
