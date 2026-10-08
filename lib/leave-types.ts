export const leaveCategories = ["Annual", "Medical", "Casual", "Emergency", "Special"] as const;

export type LeaveTypeInput = {
  code: string;
  name: string;
  leaveGroup: string;
  leaveGroupId?: number;
  daysAllowed: number;
  description: string;
  status: "ACTIVE" | "INACTIVE";
};

export function parseLeaveTypeInput(value: unknown): LeaveTypeInput | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const { code, name, leaveGroup, leaveGroupId, daysAllowed, description, status } = input;

  if (
    typeof code !== "string" || !code.trim() ||
    typeof name !== "string" || !name.trim() ||
    typeof leaveGroup !== "string" || !leaveGroup.trim() ||
    (leaveGroupId !== undefined && (!Number.isSafeInteger(leaveGroupId) || Number(leaveGroupId) <= 0)) ||
    typeof daysAllowed !== "number" || !Number.isSafeInteger(daysAllowed) || daysAllowed < 1 ||
    typeof description !== "string" ||
    (status !== "ACTIVE" && status !== "INACTIVE" && status !== "Active" && status !== "Inactive")
  ) {
    return null;
  }

  return {
    code: code.trim().toUpperCase(),
    name: name.trim().toUpperCase(),
    leaveGroup: leaveGroup.trim().toUpperCase(),
    ...(leaveGroupId === undefined ? {} : { leaveGroupId: Number(leaveGroupId) }),
    daysAllowed,
    description: description.trim().toUpperCase(),
    status: status.toUpperCase() as LeaveTypeInput["status"],
  };
}

export function serializeLeaveType<T extends {
  id: number;
  code: string;
  name: string;
  leaveGroup: string;
  daysAllowed: number;
  description: string | null;
  status: string;
  isUsed: boolean;
  groupItems?: { leaveGroup: { id: number; name: string } }[];
}>(leaveType: T) {
  const groups = leaveType.groupItems?.map((item) => item.leaveGroup) ?? [];

  return {
    id: leaveType.id,
    code: leaveType.code,
    name: leaveType.name,
    leaveGroup: groups.length ? groups.map((group) => group.name).join(", ") : leaveType.leaveGroup,
    leaveGroupId: groups[0]?.id ?? null,
    daysAllowed: leaveType.daysAllowed,
    description: leaveType.description ?? "",
    status: leaveType.status.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isUsed: leaveType.isUsed,
  };
}
