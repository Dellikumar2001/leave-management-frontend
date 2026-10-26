export const leaveCategories = ["Annual", "Medical", "Casual", "Emergency", "Special"] as const;

export type LeaveTypeInput = {
  code: string;
  name: string;
  leaveGroup: string;
  leaveGroupId?: number;
  leaveCategoryId?: number;
  paymentType: "PAID" | "UNPAID";
  daysAllowed: number;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  carryForward: boolean;
};

export function parseLeaveTypeInput(value: unknown): LeaveTypeInput | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const {
    code,
    name,
    leaveGroup,
    leaveGroupId,
    leaveCategoryId,
    paymentType = "PAID",
    daysAllowed,
    description,
    status,
    carryForward,
  } = input;

  if (
    typeof code !== "string" || !code.trim() ||
    (leaveGroupId !== undefined && leaveGroupId !== null && (!Number.isSafeInteger(Number(leaveGroupId)) || Number(leaveGroupId) <= 0)) ||
    (paymentType !== "PAID" && paymentType !== "UNPAID") ||
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

  const isCarryForward = carryForward === true || carryForward === "YES" || carryForward === "true";

  return {
    code: code.trim().toUpperCase(),
    name: trimmedName,
    leaveGroup: trimmedLeaveGroup,
    ...(validLeaveGroupId === undefined ? {} : { leaveGroupId: validLeaveGroupId }),
    ...(validLeaveCategoryId === undefined ? {} : { leaveCategoryId: validLeaveCategoryId }),
    paymentType,
    daysAllowed,
    description: description.trim().toUpperCase(),
    status: status.toUpperCase() as LeaveTypeInput["status"],
    carryForward: isCarryForward,
  };
}

export function serializeLeaveType<T extends {
  id: number;
  code: string;
  name: string;
  leaveGroup: string;
  paymentType: string | null;
  daysAllowed: number;
  description: string | null;
  status: string;
  isUsed: boolean;
  carryForward?: boolean;
  categoryMaster?: { id: number; name: string; code: string } | null;
  groupItems?: {
    leaveGroup: {
      id: number;
      name: string;
      categoryId?: number | null;
      category?: { id: number; name: string } | null;
      categories?: {
        categoryId: number;
        category?: { id: number; name: string } | null;
      }[];
    };
  }[];
}>(leaveType: T) {
  const groups = leaveType.groupItems?.map((item) => item.leaveGroup) ?? [];
  const category = leaveType.categoryMaster ?? groups
    .flatMap((group) => [
      ...(group.category?.name ? [group.category] : []),
      ...(group.categories?.map((item) => item.category).filter((item) => item?.name) ?? []),
    ])[0] ?? null;

  return {
    id: leaveType.id,
    code: leaveType.code,
    name: leaveType.name,
    leaveGroup: groups.length ? groups.map((group) => group.name).join(", ") : leaveType.leaveGroup,
    leaveGroupId: groups[0]?.id ?? null,
    leaveCategory: category?.name ?? null,
    leaveCategoryId: leaveType.categoryMaster?.id ?? category?.id ?? groups[0]?.categoryId ?? null,
    paymentType: leaveType.paymentType === "UNPAID" ? "UNPAID" : "PAID",
    daysAllowed: leaveType.daysAllowed,
    description: leaveType.description ?? "",
    status: leaveType.status.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isUsed: leaveType.isUsed,
    carryForward: Boolean(leaveType.carryForward),
  };
}
