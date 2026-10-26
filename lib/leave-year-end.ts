export type CycleInfo = {
  code: string;
  label: string;
  startDate: string;
  endDate: string;
  academicYear: string;
};

export type LeaveRuleConfig = {
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  rule: "CARRY_FORWARD" | "RESET";
  maxCarryForwardDays: number | null;
  defaultDays: number;
};

export const AVAILABLE_CYCLES: CycleInfo[] = [
  {
    code: "2023-2024",
    label: "2023-2024 (01 Jun 2023 - 31 May 2024)",
    startDate: "2023-06-01",
    endDate: "2024-05-31",
    academicYear: "2023-2024",
  },
  {
    code: "2024-2025",
    label: "2024-2025 (01 Jun 2024 - 31 May 2025)",
    startDate: "2024-06-01",
    endDate: "2025-05-31",
    academicYear: "2024-2025",
  },
  {
    code: "2025-2026",
    label: "2025-2026 (01 Jun 2025 - 31 May 2026)",
    startDate: "2025-06-01",
    endDate: "2026-05-31",
    academicYear: "2025-2026",
  },
  {
    code: "2026-2027",
    label: "2026-2027 (01 Jun 2026 - 31 May 2027)",
    startDate: "2026-06-01",
    endDate: "2027-05-31",
    academicYear: "2026-2027",
  },
  {
    code: "2027-2028",
    label: "2027-2028 (01 Jun 2027 - 31 May 2028)",
    startDate: "2027-06-01",
    endDate: "2028-05-31",
    academicYear: "2027-2028",
  },
  {
    code: "2028-2029",
    label: "2028-2029 (01 Jun 2028 - 31 May 2029)",
    startDate: "2028-06-01",
    endDate: "2029-05-31",
    academicYear: "2028-2029",
  },
];

export function getCycleInfo(code: string): CycleInfo | null {
  const found = AVAILABLE_CYCLES.find((c) => c.code === code);
  if (found) return found;

  const parts = code.split("-");
  if (parts.length === 2) {
    const startYear = parseInt(parts[0], 10);
    const endYear = parseInt(parts[1], 10);
    if (!Number.isNaN(startYear) && !Number.isNaN(endYear)) {
      return {
        code,
        label: `${code} (01 Jun ${startYear} - 31 May ${endYear})`,
        startDate: `${startYear}-06-01`,
        endDate: `${endYear}-05-31`,
        academicYear: code,
      };
    }
  }
  return null;
}

export function getDefaultNextCycle(currentCycleCode: string): string {
  const parts = currentCycleCode.split("-");
  if (parts.length === 2) {
    const startYear = parseInt(parts[0], 10);
    const endYear = parseInt(parts[1], 10);
    if (!Number.isNaN(startYear) && !Number.isNaN(endYear)) {
      return `${startYear + 1}-${endYear + 1}`;
    }
  }
  return "2026-2027";
}

export function getDefaultRuleForLeaveType(
  code: string,
  name: string,
  carryForward?: boolean
): "CARRY_FORWARD" | "RESET" {
  if (typeof carryForward === "boolean") {
    return carryForward ? "CARRY_FORWARD" : "RESET";
  }

  const c = code.trim().toUpperCase();
  const n = name.trim().toUpperCase();

  // Maternity and Paternity statutory leaves must reset
  if (c === "MLV" || c === "PL" || n.includes("MATERNITY") || n.includes("PATERNITY")) {
    return "RESET";
  }

  // Casual leaves lapse/reset at year-end
  if (c === "CL" || n.includes("CASUAL")) {
    return "RESET";
  }

  // Earned / Annual leaves carry forward
  if (c === "EL" || n.includes("EARNED") || n.includes("ANNUAL")) {
    return "CARRY_FORWARD";
  }

  // Medical / Sick leaves carry forward up to limit
  if (c === "ML" || n.includes("MEDICAL") || n.includes("SICK")) {
    return "CARRY_FORWARD";
  }

  return "RESET";
}

export function getDefaultMaxCarryForward(
  code: string,
  name: string,
  carryForward?: boolean
): number | null {
  const rule = getDefaultRuleForLeaveType(code, name, carryForward);
  if (rule === "RESET") return null;

  const c = code.trim().toUpperCase();
  const n = name.trim().toUpperCase();

  if (c === "EL" || n.includes("EARNED") || n.includes("ANNUAL")) {
    return 30; // standard 30 days limit
  }
  if (c === "ML" || n.includes("MEDICAL") || n.includes("SICK")) {
    return 15; // standard 15 days limit
  }

  return 30;
}
