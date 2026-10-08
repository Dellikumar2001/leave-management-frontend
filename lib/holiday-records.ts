export const holidayTypes = ["national", "special", "festival"] as const;
export const holidayStatuses = ["active", "inactive"] as const;

export type HolidayInput = {
  date: Date;
  name: string;
  type: (typeof holidayTypes)[number];
  description: string;
  status: (typeof holidayStatuses)[number];
  repeatEveryYear: boolean;
  isHoliday: boolean;
};

export type HolidayRecord = {
  id: number;
  date: Date;
  name: string;
  type: string;
  description: string;
  status: string;
  repeatEveryYear: boolean;
  isHoliday: boolean;
};

export function parseHolidayInput(value: unknown): HolidayInput | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const { date, name, type, description, status, repeatEveryYear, isHoliday } = input;

  if (
    typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime()) ||
    new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date ||
    typeof name !== "string" || !name.trim() || name.trim().length > 80 ||
    typeof type !== "string" || !holidayTypes.includes(type as HolidayInput["type"]) ||
    typeof description !== "string" || description.length > 500 ||
    typeof status !== "string" || !holidayStatuses.includes(status as HolidayInput["status"]) ||
    typeof repeatEveryYear !== "boolean" ||
    (isHoliday !== undefined && typeof isHoliday !== "boolean")
  ) {
    return null;
  }

  return {
    date: new Date(`${date}T00:00:00.000Z`),
    name: name.trim(),
    type: type as HolidayInput["type"],
    description: description.trim(),
    status: status as HolidayInput["status"],
    repeatEveryYear,
    isHoliday: typeof isHoliday === "boolean" ? isHoliday : type !== "special",
  };
}

export function serializeHoliday(record: HolidayRecord) {
  return {
    ...record,
    date: record.date.toISOString().slice(0, 10),
  };
}

export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}