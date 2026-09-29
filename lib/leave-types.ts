export type LeaveTypeInput = {
  code: string;
  name: string;
  leaveGroup: string;
  paymentType: "PAID" | "UNPAID";
  daysAllowed: number;
  description: string;
  status: "ACTIVE" | "INACTIVE";
};

export type LeaveTypeRecord = LeaveTypeInput & {
  id: number;
  isUsed: boolean;
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
    (status !== "ACTIVE" && status !== "INACTIVE")
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
    status,
  };
}
