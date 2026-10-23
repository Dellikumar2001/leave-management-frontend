"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Eye, Pencil, Trash2, X, ChevronDown } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";
import LeaveCategoryMultiSelect from "../components/LeaveCategoryMultiSelect";

type LeaveGroup = {
  id: number;
  code: string;
  name: string;
  description: string;
  categoryNames: string[];
  categoryIds: string[];
  leaveTypes: string[];
  effectiveFrom: string;
  status: "ACTIVE" | "INACTIVE";
  isUsed?: boolean;
};

type LeaveGroupForm = {
  code: string;
  name: string;
  description: string;
  leaveTypes: string[];
  categoryIds: string[];
  effectiveFrom: string;
  status: "ACTIVE" | "INACTIVE";
};

type LeaveCategoryOption = {
  id: number;
  name: string;
};

type ApiLeaveGroup = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  category?: { id?: number; name?: string | null } | null;
  categories?: { categoryId?: number; category?: { id?: number; name?: string | null } | null }[];
  categoryId?: number | null;
  items?: { leaveType?: { code?: string | null; status?: string } | null }[];
  effectiveFrom: string | Date;
  status: string;
};

type RowActionsProps = {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleteDisabled?: boolean;
};

function RowActions({ onView, onEdit, onDelete, isDeleteDisabled = false }: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }

    const button = actionsButtonRef.current;
    if (!button) return;

    const bounds = button.getBoundingClientRect();
    const menuHeight = 40;
    const menuWidth = 128;
    const spacing = 8;
    const openAbove = bounds.bottom + menuHeight + spacing > window.innerHeight;
    const top = openAbove
      ? bounds.top - menuHeight - spacing
      : bounds.bottom + spacing;

    setMenuPosition({
      top: Math.max(spacing, Math.min(top, window.innerHeight - menuHeight - spacing)),
      left: Math.max(
        spacing,
        Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - spacing),
      ),
    });
    setOpen(true);
  };

  return (
    <div className="relative flex items-center justify-end gap-1">
      <button type="button" onClick={onView} className="p-1.5 text-slate-400 hover:text-slate-700" title="View">
        <Eye size={16} />
      </button>
      <button type="button" onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700" title="Edit">
        <Pencil size={16} />
      </button>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
        title="Delete"
        aria-label="Delete"
      >
        <Trash2 size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="fixed z-40 w-32 rounded-md border border-slate-200 bg-white shadow-lg"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <button
              type="button"
              disabled={isDeleteDisabled}
              onClick={() => {
                if (isDeleteDisabled) return;
                setOpen(false);
                onDelete();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${isDeleteDisabled ? "cursor-not-allowed text-slate-400" : "text-red-600 hover:bg-red-50"
                }`}
              title={isDeleteDisabled ? "This leave group is already in use and cannot be deleted." : "Delete"}
            >
              <Trash2 size={14} />
              <span>{isDeleteDisabled ? "Delete disabled" : "Delete"}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const mapApiLeaveGroup = (group: ApiLeaveGroup): LeaveGroup => ({
  id: Number(group.id),
  code: String(group.code ?? "").toUpperCase(),
  name: String(group.name ?? "").toUpperCase(),
  description: String(group.description ?? ""),
  categoryNames: Array.isArray(group.categories) && group.categories.length > 0
    ? group.categories.map((link) => String(link.category?.name ?? "").toUpperCase()).filter(Boolean)
    : group.category?.name ? [String(group.category.name).toUpperCase()] : [],
  categoryIds: Array.isArray(group.categories) && group.categories.length > 0
    ? group.categories.map((link) => String(link.categoryId ?? link.category?.id ?? "")).filter(Boolean)
    : group.categoryId ? [String(group.categoryId)] : [],
  leaveTypes: Array.isArray(group.items)
    ? group.items
      .filter((item) => item.leaveType?.status === "ACTIVE")
      .map((item) => String(item.leaveType?.code ?? "").toUpperCase())
    : [],
  effectiveFrom: new Date(group.effectiveFrom).toISOString().split("T")[0],
  status: group.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
  isUsed: false,
});

type LeaveTypeOption = {
  value: string;
  label: string;
  name: string;
  leaveCategoryId: number | null;
  leaveCategory: string | null;
};

const fetchLeaveTypeOptions = async (): Promise<LeaveTypeOption[]> => {
  try {
    const response = await fetch("/api/leave-types?status=ACTIVE");
    if (!response.ok) return [];
    const json = await response.json();
    const items = Array.isArray(json) ? json : [];
    return items.map((item: { code?: string | null; name?: string | null; leaveCategoryId?: number | null; leaveCategory?: string | null }) => ({
      value: String(item.code ?? "").toUpperCase(),
      label: `${String(item.code ?? "").toUpperCase()} ${String(item.name ?? "").toUpperCase()}`,
      name: String(item.name ?? "").toUpperCase(),
      leaveCategoryId: item.leaveCategoryId ? Number(item.leaveCategoryId) : null,
      leaveCategory: item.leaveCategory ? String(item.leaveCategory) : null,
    }));
  } catch {
    return [];
  }
};

const fetchLeaveCategoryOptions = async (): Promise<LeaveCategoryOption[]> => {
  try {
    const response = await fetch("/api/leave-categories");
    if (!response.ok) return [];
    const json = await response.json();
    const items = Array.isArray(json?.data) ? json.data : [];
    return items
      .filter((item: { status?: string }) => item.status === "ACTIVE")
      .map((item: { id?: number; name?: string }) => ({
        id: Number(item.id),
        name: String(item.name ?? "").toUpperCase(),
      }));
  } catch {
    return [];
  }
};

const fetchLeaveGroups = async (): Promise<{ data: LeaveGroup[]; error?: string }> => {
  try {
    const response = await fetch("/api/leave-requests");
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      return { data: [], error: err?.error ?? "Unable to load leave groups from the database." };
    }
    const json = await response.json();
    return { data: Array.isArray(json?.data) ? json.data.map(mapApiLeaveGroup) : [] };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "Unable to load leave groups from the database." };
  }
};

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function LeaveTypeMultiSelect({
  values,
  options,
  onChange,
  disabled = false,
}: {
  values: string[];
  options: LeaveTypeOption[];
  onChange: (nextValues: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => !disabled && setOpen((current) => !current)}
        className={`flex min-h-[46px] w-full flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm uppercase text-slate-700 outline-none transition focus:border-blue-300 ${disabled ? "cursor-not-allowed opacity-70" : "hover:border-slate-400"
          }`}
      >
        <div className="flex flex-1 flex-wrap gap-2">
          {values.length > 0 ? (
            values.map((value) => (
              <span key={value} className="inline-flex items-center rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-[11px] font-semibold uppercase text-blue-700">
                {value}
              </span>
            ))
          ) : (
            <span className="text-slate-400">SELECT LEAVE TYPES</span>
          )}
        </div>

        <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <>
          <button
            type="button"
            aria-label="Close leave type options"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {options.length > 0 ? (
              options.map((option) => {
                const checked = values.includes(option.value);

                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 uppercase hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const nextValues = checked
                          ? values.filter((item) => item !== option.value)
                          : [...values, option.value];

                        onChange(nextValues);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
                    />
                    <span className="text-sm font-medium text-slate-700">{option.value}</span>
                    <span className="text-xs text-slate-500">{option.label.replace(`${option.value}`, "")}</span>
                  </label>
                );
              })
            ) : (
              <div className="px-2 py-3 text-sm uppercase text-slate-500">NO LEAVE TYPES AVAILABLE</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function deriveCategoryIdsFromLeaveTypes(
  selectedCodes: string[],
  typeOptions: LeaveTypeOption[],
  categoryOptions: LeaveCategoryOption[]
): string[] {
  const result = new Set<string>();

  selectedCodes.forEach((code) => {
    const opt = typeOptions.find((o) => o.value.toUpperCase() === code.toUpperCase());
    if (!opt) return;

    // 1. Direct match by leaveCategoryId returned by API
    if (opt.leaveCategoryId) {
      const exists = categoryOptions.some((cat) => cat.id === opt.leaveCategoryId);
      if (exists) {
        result.add(String(opt.leaveCategoryId));
        return;
      }
    }

    // 2. Match by category name returned by API
    if (opt.leaveCategory) {
      const match = categoryOptions.find(
        (cat) => cat.name.toUpperCase() === opt.leaveCategory!.toUpperCase()
      );
      if (match) {
        result.add(String(match.id));
        return;
      }
    }

    // 3. Fallback: match by leave type name and known keywords
    const typeName = opt.name.toUpperCase();
    const typeCode = opt.value.toUpperCase();

    categoryOptions.forEach((cat) => {
      const catName = cat.name.toUpperCase();
      if (
        ((typeCode === "CL" || typeName.includes("CASUAL")) && catName.includes("CASUAL")) ||
        ((typeCode === "ML" || typeName.includes("MEDICAL") || typeName.includes("SICK")) && catName.includes("MEDICAL")) ||
        ((typeCode === "EL" || typeName.includes("EARNED") || typeName.includes("ANNUAL")) && catName.includes("ANNUAL")) ||
        ((typeCode === "MLV" || typeCode === "PL" || typeName.includes("MATERNITY") || typeName.includes("PATERNITY")) && catName.includes("SPECIAL")) ||
        (typeName.replace(" LEAVE", "").trim().length > 2 && catName.includes(typeName.replace(" LEAVE", "").trim()))
      ) {
        result.add(String(cat.id));
      }
    });
  });

  return Array.from(result);
}

const today = new Date().toISOString().split("T")[0];
const maxEffectiveFrom = "2100-12-31";

function sanitizeDateInput(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  if (parsed < new Date(`${today}T00:00:00.000Z`)) return "";
  if (parsed > new Date(`${maxEffectiveFrom}T00:00:00.000Z`)) return "";
  return value;
}

function sanitizeEditDateInput(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  if (parsed < new Date("2000-01-01T00:00:00.000Z")) return "";
  if (parsed > new Date("2100-12-31T00:00:00.000Z")) return "";
  return value;
}

export default function StudentLeaveRequestsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<LeaveGroup[]>([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<LeaveTypeOption[]>([]);
  const [leaveCategoryOptions, setLeaveCategoryOptions] = useState<LeaveCategoryOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL STATUS");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [pageError, setPageError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<LeaveGroupForm>({
    code: "",
    name: "",
    description: "",
    leaveTypes: [],
    categoryIds: [],
    effectiveFrom: "",
    status: "ACTIVE",
  });
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<LeaveGroupForm>({
    code: "",
    name: "",
    description: "",
    leaveTypes: [],
    categoryIds: [],
    effectiveFrom: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setPageError("");
        const [options, categories, groupsResult] = await Promise.all([
          fetchLeaveTypeOptions(),
          fetchLeaveCategoryOptions(),
          fetchLeaveGroups(),
        ]);
        setLeaveTypeOptions(options);
        setLeaveCategoryOptions(categories);
        setGroups(groupsResult.data);
        if (groupsResult.error) {
          setPageError(groupsResult.error);
        }
      } catch (err) {
        console.error("Failed to load leave group data", err);
        setPageError("Unable to load leave groups from the database.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, []);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toUpperCase();

    return groups.filter((group) => {
      const matchesSearch =
        !query ||
        group.code.toUpperCase().includes(query) ||
        group.name.toUpperCase().includes(query) ||
        group.description.toUpperCase().includes(query) ||
        group.categoryNames.some((category) => category.includes(query)) ||
        group.leaveTypes.some((type) => type.toUpperCase().includes(query));

      const matchesStatus = statusFilter === "ALL STATUS" || group.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [groups, search, statusFilter]);

  const handleCreateGroup = async () => {
    const nextCode = form.code.trim().toUpperCase();
    const nextName = form.name.trim();
    const nextEffectiveFrom = sanitizeDateInput(form.effectiveFrom);

    if (!nextCode) {
      setError("GROUP CODE IS REQUIRED.");
      return;
    }
    if (!nextEffectiveFrom) {
      setError("FROM DATE IS REQUIRED.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/leave-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: nextCode,
          name: nextName,
          description: form.description.trim().toUpperCase(),
          leaveTypeCodes: form.leaveTypes.map((t) => t.toUpperCase()),
          categoryIds: form.categoryIds.map(Number),
          effectiveFrom: nextEffectiveFrom,
          status: form.status,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        setError(errorPayload?.error?.toUpperCase() ?? "FAILED TO CREATE LEAVE GROUP.");
        return;
      }

      const createdGroup = await response.json();
      setGroups((prev) => [mapApiLeaveGroup(createdGroup.data), ...prev]);
      setForm({
        code: "",
        name: "",
        description: "",
        leaveTypes: [],
        categoryIds: [],
        effectiveFrom: "",
        status: "ACTIVE",
      });
      setError("");
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message.toUpperCase() : "FAILED TO CREATE LEAVE GROUP.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewGroup = (group: LeaveGroup) => {
    router.push(`/leave-requests/${group.id}?mode=view`);
  };

  const handleEditGroup = (group: LeaveGroup) => {
    setEditingGroupId(group.id);
    setEditForm({
      code: group.code,
      name: group.name,
      description: group.description,
      leaveTypes: group.leaveTypes,
      categoryIds: group.categoryIds,
      effectiveFrom: group.effectiveFrom,
      status: group.status,
    });
  };

  const handleSaveGroup = async () => {
    if (editingGroupId === null) return;

    const response = await fetch(`/api/leave-requests/${editingGroupId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: editForm.code.trim().toUpperCase().slice(0, 6),
        name: editForm.name.trim().toUpperCase(),
        description: editForm.description.trim().toUpperCase(),
        leaveTypeCodes: editForm.leaveTypes,
        categoryIds: editForm.categoryIds.map(Number),
        categoryId: editForm.categoryIds[0] ? Number(editForm.categoryIds[0]) : null,
        effectiveFrom: editForm.effectiveFrom,
        status: editForm.status,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error(error?.error ?? "Failed to update leave group");
      return;
    }

    const result = await response.json();
    setGroups((current) => current.map((group) =>
      group.id === editingGroupId ? mapApiLeaveGroup(result.data) : group,
    ));
    setEditingGroupId(null);
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      const response = await fetch(`/api/leave-requests/${groupId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        alert(errorJson?.error ?? "Failed to delete leave group");
        return;
      }

      setGroups((prev) => prev.filter((group) => group.id !== groupId));
    } catch (err) {
      console.error("Failed to delete leave group:", err);
      alert("Failed to delete leave group.");
    }
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="leave-requests" />
      <div className="p-4 min-[801px]:ml-[175px] uppercase">
        <div className="mx-auto max-w-[1400px]">
          {/* Header matched to Leave Eligibility banner */}
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">LEAVE GROUP</h1>
          </header>

          {/* Inline Filter & Action bar */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search Bar in UPPERCASE */}
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH BY GROUP CODE, NAME, OR LEAVE TYPE..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm uppercase text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Status Dropdown in UPPERCASE */}
              <div className="relative min-w-[170px]">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value.toUpperCase())}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 pr-9 text-sm uppercase text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ALL STATUS">ALL STATUS</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              {/* Create Button in UPPERCASE */}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setIsModalOpen(true);
                }}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2f5fbb] px-5 text-sm font-medium uppercase text-white transition-colors hover:bg-[#294f9c]"
              >
                <Plus size={16} />
                CREATE LEAVE GROUP
              </button>
            </div>
          </div>

          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {pageError && (
              <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm uppercase text-red-700">
                {pageError}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-[#f8fafc] text-xs font-semibold uppercase text-slate-600 sm:text-sm">
                    <th className="border-b border-slate-200 px-5 py-4">SNO</th>
                    <th className="border-b border-slate-200 px-5 py-4">GROUP CODE</th>
                    <th className="border-b border-slate-200 px-5 py-4">GROUP NAME</th>
                    <th className="border-b border-slate-200 px-5 py-4">LEAVE CATEGORY</th>
                    <th className="border-b border-slate-200 px-5 py-4">LEAVE TYPES</th>
                    <th className="border-b border-slate-200 px-5 py-4">FROM</th>
                    <th className="border-b border-slate-200 px-5 py-4">STATUS</th>
                    <th className="border-b border-slate-200 px-5 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm uppercase text-slate-500">
                        LOADING LEAVE GROUPS...
                      </td>
                    </tr>
                  ) : filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm uppercase text-slate-500">
                        {search ? "NO LEAVE GROUPS MATCH YOUR FILTER CRITERIA." : "NO LEAVE GROUPS FOUND."}
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group, index) => (
                      <tr key={group.id} className="bg-white text-sm uppercase text-slate-700 even:bg-[#f9fafc] hover:bg-slate-50/70">
                        <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-500">{index + 1}</td>
                        <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-700">{group.code}</td>
                        <td className="border-b border-slate-200 px-5 py-4 text-slate-700">
                          <div>{group.name || "—"}</div>
                          {group.description && (
                            <div className="mt-1 text-xs font-normal text-slate-500">{group.description}</div>
                          )}
                        </td>
                        <td className="border-b border-slate-200 px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {group.categoryNames.length > 0 ? (
                              group.categoryNames.map((type) => (
                                <span
                                  key={`${group.id}-${type}`}
                                  className="inline-flex items-center rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700"
                                >
                                  {type}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="border-b border-slate-200 px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {group.leaveTypes.length > 0 ? (
                              group.leaveTypes.map((type) => (
                                <span
                                  key={`${group.id}-${type}`}
                                  className="inline-flex items-center rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700"
                                >
                                  {type}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="border-b border-slate-200 px-5 py-4 text-slate-700">
                          {new Date(group.effectiveFrom).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }).toUpperCase()}
                        </td>
                        <td className="border-b border-slate-200 px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase ${group.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                              }`}
                          >
                            {group.status}
                          </span>
                        </td>
                        <td className="border-b border-slate-200 px-5 py-4">
                          <RowActions
                            onView={() => handleViewGroup(group)}
                            onEdit={() => handleEditGroup(group)}
                            onDelete={() => handleDeleteGroup(group.id)}
                            isDeleteDisabled={group.status === "INACTIVE" || Boolean(group.isUsed)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-[#f8fafc] px-5 py-4 text-sm uppercase text-slate-500">
              <div>SHOWING 1 TO {filteredGroups.length} OF {filteredGroups.length} ENTRIES</div>

              <div className="flex items-center gap-2">
                <button type="button" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-500 disabled:opacity-50" aria-label="Previous page">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" className="rounded-lg border border-slate-300 bg-[#2f5fbb] px-3 py-1.5 font-medium text-white">
                  1
                </button>
                <button type="button" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-500" aria-label="Next page">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-[1px]">
          <div className="w-full max-w-[640px] rounded-[22px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCreateGroup();
              }}
            >
              <div className="flex items-center justify-between px-6 py-5">
                <h2 className="text-[22px] font-bold uppercase text-slate-800">CREATE LEAVE GROUP</h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div role="alert" className="mx-6 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm uppercase text-red-700">
                  {error}
                </div>
              )}

              <div className="px-6 pb-6 pt-2">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                      GROUP CODE <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      value={form.code}
                      onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase().slice(0, 6) }))}
                      className="h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300"
                      maxLength={6}
                      placeholder="GEN"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                      GROUP NAME
                    </label>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value.toUpperCase() }))}
                      className="h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300"
                      maxLength={32}
                      placeholder="GENERAL LEAVE"
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                      LEAVE TYPES
                    </label>
                    <LeaveTypeMultiSelect
                      values={form.leaveTypes}
                      options={leaveTypeOptions}
                      onChange={(nextValues) => {
                        const upperValues = nextValues.map((t) => t.toUpperCase());

                        // Auto-derive categories that belong to newly selected leave types
                        const autoCategories = deriveCategoryIdsFromLeaveTypes(
                          upperValues,
                          leaveTypeOptions,
                          leaveCategoryOptions
                        );

                        // Preserve any manually added category IDs that aren't tied to deselected leave types
                        const prevAutoCategories = deriveCategoryIdsFromLeaveTypes(
                          form.leaveTypes,
                          leaveTypeOptions,
                          leaveCategoryOptions
                        );
                        const manualCategoryIds = form.categoryIds.filter(
                          (id) => !prevAutoCategories.includes(id)
                        );

                        const mergedCategoryIds = Array.from(
                          new Set([...manualCategoryIds, ...autoCategories])
                        );

                        setForm((prev) => ({
                          ...prev,
                          leaveTypes: upperValues,
                          categoryIds: mergedCategoryIds,
                        }));
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                      LEAVE CATEGORIES
                    </label>
                    <LeaveCategoryMultiSelect
                      values={form.categoryIds}
                      options={leaveCategoryOptions}
                      onChange={(categoryIds) => setForm((prev) => ({ ...prev, categoryIds }))}
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                      FROM <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                        <CalendarIcon />
                      </span>

                      <input
                        required
                        type="date"
                        min={today}
                        max={maxEffectiveFrom}
                        value={form.effectiveFrom}
                        onChange={(event) => {
                          const nextValue = sanitizeDateInput(event.target.value);
                          setForm((prev) => ({ ...prev, effectiveFrom: nextValue }));
                        }}
                        className="h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">STATUS</label>
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value.toUpperCase() as "ACTIVE" | "INACTIVE" }))}
                        className="h-[46px] w-full appearance-none rounded-xl border border-slate-300 bg-slate-50 px-3.5 pr-10 text-sm uppercase text-slate-700 outline-none transition focus:border-blue-300"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">DESCRIPTION</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value.toUpperCase() }))}
                    className="min-h-[78px] w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300"
                    maxLength={61}
                    placeholder="GROUP FOR GENERAL PURPOSE LEAVES LIKE CASUAL, ANNUAL AND EARNED LEAVE."
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 uppercase">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium uppercase text-slate-700 transition hover:bg-slate-50"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl bg-[#2f5fbb] px-5 py-2.5 text-sm font-medium uppercase text-white transition hover:bg-[#294f9c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "CREATING..." : "CREATE"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingGroupId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-[1px] uppercase"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingGroupId(null);
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveGroup();
            }}
            className="my-auto max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-800">EDIT LEAVE GROUP</h2>
                <p className="mt-1 text-sm uppercase text-slate-500">UPDATE THE LEAVE GROUP DETAILS BELOW.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingGroupId(null)}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="CLOSE DIALOG"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-5 px-6 pb-6 pt-2 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">GROUP CODE</label>
                <input
                  required
                  maxLength={6}
                  value={editForm.code}
                  onChange={(event) => setEditForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">GROUP NAME</label>
                <input
                  value={editForm.name}
                  onChange={(event) => setEditForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">DESCRIPTION</label>
                <textarea
                  value={editForm.description}
                  onChange={(event) => setEditForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))}
                  maxLength={61}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">LEAVE TYPES</label>
                <LeaveTypeMultiSelect
                  values={editForm.leaveTypes}
                  options={leaveTypeOptions}
                  onChange={(leaveTypes) => setEditForm((current) => ({ ...current, leaveTypes }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">LEAVE CATEGORIES</label>
                <LeaveCategoryMultiSelect
                  values={editForm.categoryIds}
                  options={leaveCategoryOptions}
                  onChange={(categoryIds) => setEditForm((current) => ({ ...current, categoryIds }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">EFFECTIVE FROM</label>
                <input
                  required
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  value={editForm.effectiveFrom}
                  onChange={(event) => {
                    const effectiveFrom = sanitizeEditDateInput(event.target.value);
                    if (effectiveFrom) {
                      setEditForm((current) => ({ ...current, effectiveFrom }));
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">STATUS</label>
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm((current) => ({
                    ...current,
                    status: event.target.value as LeaveGroup["status"],
                  }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 uppercase sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingGroupId(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#2f5fbb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#294f9c]"
              >
                UPDATE
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}