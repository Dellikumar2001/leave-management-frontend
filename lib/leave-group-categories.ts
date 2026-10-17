export function parseLeaveGroupCategoryIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;

  const ids: number[] = [];
  for (const valueItem of value) {
    if (
      (typeof valueItem !== "number" && typeof valueItem !== "string") ||
      (typeof valueItem === "string" && !/^\d+$/.test(valueItem))
    ) {
      return null;
    }
    const id = Number(valueItem);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}