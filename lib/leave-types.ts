export const leaveCategories = ["Annual", "Medical", "Casual", "Emergency", "Special"] as const;

export type LeaveTypeInput = {
  code: string;
  name: string;
  leaveGroup: string;
  leaveGroupId?: number;
  leaveCategoryId?: number;
  daysAllowed: number;
  description: string;
  status: "ACTIVE" | "INACTIVE";
};

export function parseLeaveTypeInput(value: unknown): LeaveTypeInput | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const { code, name, leaveGroup, leaveGroupId, leaveCategoryId, daysAllowed, description, status } = input;

  // Previously mandatory validation:
  // if (
  //   typeof code !== "string" || !code.trim() ||
  //   typeof name !== "string" || !name.trim() ||
  //   typeof leaveGroup !== "string" || !leaveGroup.trim() ||
  //   (leaveGroupId !== undefined && (!Number.isSafeInteger(leaveGroupId) || Number(leaveGroupId) <= 0)) ||
  //   typeof daysAllowed !== "number" || !Number.isSafeInteger(daysAllowed) || daysAllowed < 1 ||
  //   typeof description !== "string" ||
  //   (status !== "ACTIVE" && status !== "INACTIVE" && status !== "Active" && status !== "Inactive")
  // ) {
  //   return null;
  // }

  // Code, daysAllowed, description, and status remain validated; name, leaveGroup, and leaveGroupId are optional:
  if (
    typeof code !== "string" || !code.trim() ||
    typeof daysAllowed !== "number" || !Number.isSafeInteger(daysAllowed) || daysAllowed < 1 ||
    typeof description !== "string" ||
    (status !== "ACTIVE" && status !== "INACTIVE" && status !== "Active" && status !== "Inactive")
  ) {
    return null;
  }

  const trimmedName = typeof name === "string" ? name.trim().toUpperCase() : "";
  const trimmedLeaveGroup = typeof leaveGroup === "string" ? leaveGroup.trim().toUpperCase() : "";
  const validLeaveGroupId =
    leaveGroupId !== undefined && leaveGroupId !== null && Number.isSafeInteger(Number(leaveGroupId)) && Number(leaveGroupId) > 0
      ? Number(leaveGroupId)
      : undefined;
  const validLeaveCategoryId =
    leaveCategoryId !== undefined && leaveCategoryId !== null && Number.isSafeInteger(Number(leaveCategoryId)) && Number(leaveCategoryId) > 0
      ? Number(leaveCategoryId)
      : undefined;

  return {
    code: code.trim().toUpperCase(),
    name: trimmedName,
    leaveGroup: trimmedLeaveGroup,
    ...(validLeaveGroupId === undefined ? {} : { leaveGroupId: validLeaveGroupId }),
    ...(validLeaveCategoryId === undefined ? {} : { leaveCategoryId: validLeaveCategoryId }),
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
  groupItems?: {
    leaveGroup: {
      id: number;
      name: string;
      categoryId?: number | null;
      category?: { id: number; name: string } | null;
    };
  }[];
}>(leaveType: T) {
  const groups = leaveType.groupItems?.map((item) => item.leaveGroup) ?? [];
  const category = groups.find((g) => g.category?.name)?.category ?? null;

  return {
    id: leaveType.id,
    code: leaveType.code,
    name: leaveType.name,
    leaveGroup: groups.length ? groups.map((group) => group.name).join(", ") : leaveType.leaveGroup,
    leaveGroupId: groups[0]?.id ?? null,
    leaveCategory: category?.name ?? null,
    leaveCategoryId: category?.id ?? groups[0]?.categoryId ?? null,
    daysAllowed: leaveType.daysAllowed,
    description: leaveType.description ?? "",
    status: leaveType.status.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isUsed: leaveType.isUsed,
  };
}
