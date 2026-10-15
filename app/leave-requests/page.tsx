"use client";

import { useEffect, useMemo, useState } from "react";
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

  return (
    <div className="relative flex items-center justify-end gap-1">
      <button type="button" onClick={onView} className="p-1.5 text-slate-400 hover:text-slate-700" title="View">
        <Eye size={16} />
      </button>
      <button type="button" onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700" title="Edit">
        <Pencil size={16} />
      </button>
      <button type="button" onClick={() => setOpen((value) => !value)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="More actions">
        <Trash2 size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-32 rounded-md border border-slate-200 bg-white shadow-lg">
            <button
              type="button"
              disabled={isDeleteDisabled}
              onClick={() => {
                if (isDeleteDisabled) return;
                setOpen(false);
                onDelete();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm uppercase ${isDeleteDisabled ? "cursor-not-allowed text-slate-400" : "text-red-600 hover:bg-red-50"
                }`}
              title={isDeleteDisabled ? "This leave group is already in use and cannot be deleted." : "Delete"}
            >
              <Trash2 size={14} />
              <span>{isDeleteDisabled ? "DELETE DISABLED" : "DELETE"}</span>
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
  leaveTypes: Array.isArray(group.items)
    ? group.items
      .filter((item) => item.leaveType?.status === "ACTIVE")
      .map((item) => String(item.leaveType?.code ?? "").toUpperCase())
    : [],
  effectiveFrom: new Date(group.effectiveFrom).toISOString().split("T")[0],
  status: group.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
  isUsed: false,
});

const fetchLeaveTypeOptions = async (): Promise<{ value: string; label: string }[]> => {
  try {
    const response = await fetch("/api/leave-types?status=ACTIVE");
    if (!response.ok) return [];
    const json = await response.json();
    const items = Array.isArray(json) ? json : [];
    return items.map((item: { code?: string | null; name?: string | null }) => ({
      value: String(item.code ?? "").toUpperCase(),
      label: `${String(item.code ?? "").toUpperCase()} ${String(item.name ?? "").toUpperCase()}`,
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

const fetchLeaveGroups = async (): Promise<LeaveGroup[]> => {
  try {
    const response = await fetch("/api/leave-requests");
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json?.data) ? json.data.map(mapApiLeaveGroup) : [];
  } catch {
    return [];
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
  options: { value: string; label: string }[];
  onChange: (nextValues: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
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

        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`}>
          <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && !disabled && (
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
      )}
    </div>
  );
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

export default function StudentLeaveRequestsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<LeaveGroup[]>([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [leaveCategoryOptions, setLeaveCategoryOptions] = useState<LeaveCategoryOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL STATUS");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<LeaveGroupForm>({
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
        const [options, categories, groupsData] = await Promise.all([
          fetchLeaveTypeOptions(),
          fetchLeaveCategoryOptions(),
          fetchLeaveGroups(),
        ]);
        setLeaveTypeOptions(options);
        setLeaveCategoryOptions(categories);
        setGroups(groupsData);
      } catch (error) {
        console.error("Failed to load leave group data", error);
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

    // Mandatory validation commented out to allow creating a leave group without Group Name, Leave Types, or Leave Category:
    // if (!nextCode || !nextName || form.leaveTypes.length === 0 || !categoryId || !nextEffectiveFrom) {
    //   return;
    // }

    if (!nextCode || !nextEffectiveFrom) {
      return;
    }

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
      console.error("Failed to create leave group:", errorPayload?.error ?? response.statusText);
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
    setIsModalOpen(false);
  };

  const handleViewGroup = (group: LeaveGroup) => {
    router.push(`/leave-requests/${group.id}?mode=view`);
  };

  const handleEditGroup = (group: LeaveGroup) => {
    router.push(`/leave-requests/${group.id}?mode=edit`);
  };

  const handleDeleteGroup = async (groupId: number) => {
    const response = await fetch(`/api/leave-requests/${groupId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      console.error(errorJson?.error ?? "Failed to delete leave group");
      return;
    }

    setGroups((prev) => prev.filter((group) => group.id !== groupId));
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
                  onChange={(e) => setSearch(e.target.value.toUpperCase())}
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
                onClick={() => setIsModalOpen(true)}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2f5fbb] px-5 text-sm font-medium uppercase text-white transition-colors hover:bg-[#294f9c]"
              >
                <Plus size={16} />
                CREATE LEAVE GROUP
              </button>
            </div>
          </div>

          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-[#f8fafc] text-xs font-semibold uppercase text-slate-600 sm:text-sm">
                    <th className="border-b border-slate-200 px-5 py-4">SNO</th>
                    <th className="border-b border-slate-200 px-5 py-4">GROUP CODE</th>
                    <th className="border-b border-slate-200 px-5 py-4">GROUP NAME</th>
                    <th className="border-b border-slate-200 px-5 py-4">LEAVE CATEGORY</th>
                    <th className="border-b border-slate-200 px-5 py-4">LEAVE TYPES</th>
                    <th className="border-b border-slate-200 px-5 py-4">EFFECTIVE FROM</th>
                    <th className="border-b border-slate-200 px-5 py-4">STATUS</th>
                    <th className="border-b border-slate-200 px-5 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group, index) => (
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
                  ))}
                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm uppercase text-slate-500">
                        NO LEAVE GROUPS MATCH YOUR FILTER CRITERIA.
                      </td>
                    </tr>
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
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                      maxLength={6}
                      placeholder="GEN"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Group Name {/* Mandatory indicator commented out: <span className="text-red-500">*</span> */}
                    </label>
                    <input
                      /* required attribute commented out to allow empty group name */
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value.toUpperCase() }))}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                      maxLength={32}
                      placeholder="GENERAL LEAVE"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Leave Types {/* Mandatory indicator commented out: <span className="text-red-500">*</span> */}
                    </label>

                    {/* Previously required validation for leave types:
                    <input
                      type="hidden"
                      required
                      value={form.leaveTypes.join(",")}
                      aria-label="Leave types required"
                    /> */}

                    <LeaveTypeMultiSelect
                      values={form.leaveTypes}
                      options={leaveTypeOptions}
                      onChange={(nextValues) =>
                        setForm((prev) => ({
                          ...prev,
                          leaveTypes: nextValues.map((t) => t.toUpperCase()),
                        }))
                      }
                    />

                    <div className="mt-2 text-xs uppercase text-slate-500">SELECT ONE OR MORE LEAVE TYPES</div>
                  </div>
                  <div className="mt-5">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Leave Category {/* Mandatory indicator commented out: <span className="text-red-500">*</span> */}
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
                      EFFECTIVE FROM <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
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
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">STATUS</label>
                    <select
                      value={form.status}
                      onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value.toUpperCase() as "ACTIVE" | "INACTIVE" }))}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">DESCRIPTION</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value.toUpperCase() }))}
                    className="min-h-[78px] w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base uppercase text-slate-700 outline-none focus:border-blue-300"
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
                    className="rounded-xl bg-[#2f5fbb] px-5 py-2.5 text-sm font-medium uppercase text-white transition hover:bg-[#294f9c]"
                  >
                    CREATE
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}