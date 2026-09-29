export const leaveCategories = ["Annual", "Medical", "Casual", "Emergency", "Special"] as const;

export type LeaveTypeInput = {
  code: string;
  name: string;
  leaveGroup: string;
  paymentType: "PAID" | "UNPAID";
  daysAllowed: number;
  description: string;
  status: "ACTIVE" | "INACTIVE";
};

export function parseLeaveTypeInput(value: unknown): LeaveTypeInput | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const { code, name, leaveGroup, paymentType, daysAllowed, description, status } = input;

  if (
    typeof code !== "string" || !code.trim() ||
    typeof name !== "string" || !name.trim() ||
    typeof leaveGroup !== "string" || !leaveGroup.trim() ||
    (paymentType !== "PAID" && paymentType !== "UNPAID") ||
    typeof daysAllowed !== "number" || !Number.isSafeInteger(daysAllowed) || daysAllowed < 1 ||
    typeof description !== "string" ||
    (status !== "Active" && status !== "Inactive")
  ) {
    return null;
  }

  return {
    code: code.trim().toUpperCase(),
    name: name.trim().toUpperCase(),
    leaveGroup: leaveGroup.trim().toUpperCase(),
    paymentType,
    daysAllowed,
    description: description.trim().toUpperCase(),
    status: status === "Inactive" ? "INACTIVE" : "ACTIVE",
  };
}

export function serializeLeaveType<T extends {
  id: number;
  code: string;
  name: string;
  leaveGroup: string;
  paymentType: string;
  daysAllowed: number;
  description: string;
  status: string;
  isUsed: boolean;
}>(leaveType: T) {
  return {
    id: leaveType.id,
    code: leaveType.code,
    name: leaveType.name,
    leaveGroup: leaveType.leaveGroup,
    paymentType: leaveType.paymentType,
    daysAllowed: leaveType.daysAllowed,
    description: leaveType.description,
    status: leaveType.status.toUpperCase() === "INACTIVE" ? "Inactive" : "Active",
    isUsed: leaveType.isUsed,
  };
}
