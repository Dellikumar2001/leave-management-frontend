"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Eye, Pencil, Trash2, X, MoreVertical } from "lucide-react";

type SavedLeaveType = {
  id: number;
  code: string;
  name: string;
  category: "Annual" | "Medical" | "Casual" | "Emergency" | "Special";
  days: number;
  description: string;
  status: "Active" | "Inactive";
  isUsed?: boolean;
};


type LeaveGroup = {
  id: number;
  code: string;
  name: string;
  leaveTypes: string[];
  effectiveFrom: string;
  status: "Active" | "Inactive";
  isUsed?: boolean;
};

type LeaveGroupForm = {
  code: string;
  name: string;
  description: string;
  leaveTypes: string[];
  categoryId: string;
  effectiveFrom: string;
  status: "Active" | "Inactive";
};

type LeaveCategoryOption = {
  id: number;
  name: string;
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
      <button onClick={onView} className="p-1.5 text-slate-400 hover:text-slate-700" title="View">
        <Eye size={16} />
      </button>
      <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700" title="Edit">
        <Pencil size={16} />
      </button>
      <button onClick={() => setOpen((value) => !value)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="More actions">
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

// ---- Seed data (replace with API data) -------------------------------------
// const initialGroups: LeaveGroup[] = [
//   {
//     id: 1,
//     code: "GEN",
//     name: "General Leave",
//     leaveTypes: ["CL", "AL", "EL"],
//     effectiveFrom: "2024-01-01",
//     status: "Active",
//     isUsed: true,
//   },
//   {
//     id: 2,
//     code: "MED",
//     name: "Medical Leave",
//     leaveTypes: ["ML", "SL"],
//     effectiveFrom: "2024-01-01",
//     status: "Active",
//     isUsed: false,
//   },
//   {
//     id: 3,
//     code: "UNP",
//     name: "Unpaid Leave",
//     leaveTypes: ["LOP"],
//     effectiveFrom: "2024-01-01",
//     status: "Active",
//     isUsed: true,
//   },
//   {
//     id: 4,
//     code: "SPE",
//     name: "Special Leave",
//     leaveTypes: ["PL", "CO"],
//     effectiveFrom: "2024-01-01",
//     status: "Active",
//     isUsed: false,
//   },
// ];

const mapApiLeaveType = (item: any): SavedLeaveType => ({
  id: Number(item.id),
  code: String(item.code),
  name: String(item.name),
  category: item.category === "ANNUAL" ? "Annual" : item.category === "MEDICAL" ? "Medical" : item.category === "CASUAL" ? "Casual" : item.category === "EMERGENCY" ? "Emergency" : "Special",
  days: Number(item.days),
  description: String(item.description ?? ""),
  status: item.status === "ACTIVE" ? "Active" : "Inactive",
  isUsed: false,
});

const mapApiLeaveGroup = (group: any): LeaveGroup => ({
  id: Number(group.id),
  code: String(group.code),
  name: String(group.name),
  leaveTypes: Array.isArray(group.items)
    ? group.items.map((item: { leaveType?: { code?: string | null } | null }) => item.leaveType?.code ?? "")
    : [],
  effectiveFrom: new Date(group.effectiveFrom).toISOString().split("T")[0],
  status: group.status === "ACTIVE" ? "Active" : "Inactive",
  isUsed: false,
});

const fetchLeaveTypeOptions = async (): Promise<{ value: string; label: string }[]> => {
  const response = await fetch("/api/leave-types");
  if (!response.ok) {
    throw new Error("Failed to load leave types");
  }

  const json = await response.json();
  const items = Array.isArray(json?.data) ? json.data : [];
  return items.map((item: { code?: string | null; name?: string | null }) => ({
    value: String(item.code ?? ""),
    label: `${item.code ?? ""} - ${item.name ?? ""}`,
  }));
};

const fetchLeaveCategoryOptions = async (): Promise<LeaveCategoryOption[]> => {
  const response = await fetch("/api/leave-categories");
  if (!response.ok) {
    throw new Error("Failed to load leave categories");
  }

  const json = await response.json();
  const items = Array.isArray(json?.data) ? json.data : [];
  return items
    .filter((item: { status?: string }) => item.status === "ACTIVE")
    .map((item: { id?: number; name?: string }) => ({
      id: Number(item.id),
      name: String(item.name ?? ""),
    }));
};

const fetchLeaveGroups = async (): Promise<LeaveGroup[]> => {
  const response = await fetch("/api/leave-requests");
  if (!response.ok) {
    throw new Error("Failed to load leave groups");
  }

  const json = await response.json();
  return Array.isArray(json?.data) ? json.data.map(mapApiLeaveGroup) : [];
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
        className={`flex w-full min-h-[46px] flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 outline-none transition focus:border-blue-300 ${disabled ? "cursor-not-allowed opacity-70" : "hover:border-slate-400"}`}
      >
        <div className="flex flex-1 flex-wrap gap-2">
          {values.length > 0 ? (
            values.map((value) => (
              <span key={value} className="inline-flex items-center rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                {value}
              </span>
            ))
          ) : (
            <span className="text-slate-400">Select leave types</span>
          )}
        </div>

        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`}>
          <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {options.length > 0 ? (
            options.map((option) => {
              const checked = values.includes(option.value);

              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
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
                  <span className="text-xs text-slate-500">{option.label.replace(`${option.value} - `, "")}</span>
                </label>
              );
            })
          ) : (
            <div className="px-2 py-3 text-sm text-slate-500">No leave types available</div>
          )}
        </div>
      )}
    </div>
  );
}

const today = new Date().toISOString().split("T")[0];
const maxEffectiveFrom = "2100-12-31";

function sanitizeDateInput(value: string): string {
  if (!value) return "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  if (parsed < new Date(`${today}T00:00:00.000Z`)) {
    return "";
  }

  if (parsed > new Date(`${maxEffectiveFrom}T00:00:00.000Z`)) {
    return "";
  }

  return value;
}

export default function StudentLeaveRequestsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<LeaveGroup[]>([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [leaveCategoryOptions, setLeaveCategoryOptions] = useState<LeaveCategoryOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<LeaveGroupForm>({
    code: "",
    name: "",
    description: "",
    leaveTypes: [],
    categoryId: "",
    effectiveFrom: "",
    status: "Active",
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

    loadData();
  }, []);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return groups.filter((group) => {
      const matchesSearch =
        !query ||
        group.code.toLowerCase().includes(query) ||
        group.name.toLowerCase().includes(query) ||
        group.leaveTypes.some((type) => type.toLowerCase().includes(query));

      const matchesStatus = statusFilter === "All Status" || group.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [groups, search, statusFilter]);

  const handleCreateGroup = async () => {
    const nextCode = form.code.trim().toUpperCase();
    const nextName = form.name.trim();
    const categoryId = Number(form.categoryId);
    const nextEffectiveFrom = sanitizeDateInput(form.effectiveFrom);

    if (!nextCode || !nextName || form.leaveTypes.length === 0 || !categoryId || !nextEffectiveFrom) {
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
        description: form.description.trim(),
        leaveTypeCodes: form.leaveTypes,
        categoryId,
        effectiveFrom: nextEffectiveFrom,
        status: form.status.toUpperCase(),
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
      categoryId: "",
      effectiveFrom: "",
      status: "Active",
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
    <div className="min-h-screen bg-[#e9edf3] p-4 text-slate-800 uppercase">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#f5f7fa] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative w-[360px]">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search menu, employee, reports..."
                className="w-full rounded-xl border border-slate-300 bg-[#f8f9fb] py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
              aria-label="Notifications"
            >
              <span className="relative">
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
                </svg>
              </span>
            </button>

            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d9d9d9] text-xs font-bold text-slate-700">
                CA
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-slate-700">Charles A</div>
                <div className="text-[11px] text-slate-500">Admin</div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-slate-500">
                <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </header>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-[#f5f7fa] shadow-sm">
          <div className="flex items-center justify-between px-5 py-5">
            <div>
              <h1 className="text-[42px] font-bold tracking-[-0.05em] text-slate-800">Leave Group</h1>
              <p className="mt-1 text-lg text-slate-500">Create and manage leave groups to categorize leave types.</p>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2f5fbb] px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#294f9c]"
            >
              <Plus size={16} />
              Create Leave Group
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-[#eef2f7] px-5 py-4">
            {/* <div className="relative w-[420px]">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by group code or name..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300"
              />
            </div> */}
            <div className ="mt-1 text-sl text-slate-500">{filteredGroups.length} Groups</div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-700 outline-none focus:border-blue-300"
              >
                <option>All Status</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-[#eef2f7] text-sm font-semibold text-slate-700">
                  <th className="border-b border-slate-200 px-5 py-4">Sno</th>
                  <th className="border-b border-slate-200 px-5 py-4">Group Code</th>
                  <th className="border-b border-slate-200 px-5 py-4">Group Name</th>
                  <th className="border-b border-slate-200 px-5 py-4">Leave Types</th>
                  <th className="border-b border-slate-200 px-5 py-4">Effective From</th>
                  <th className="border-b border-slate-200 px-5 py-4">Status</th>
                  <th className="border-b border-slate-200 px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((group, index) => (
                  <tr key={group.id} className="bg-white text-sm text-slate-700 even:bg-[#f9fafc]">
                    <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-500">{index + 1}</td>
                    <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-700">{group.code}</td>
                    <td className="border-b border-slate-200 px-5 py-4 text-slate-700">{group.name}</td>
                    <td className="border-b border-slate-200 px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {group.leaveTypes.map((type) => (
                          <span
                            key={`${group.id}-${type}`}
                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="border-b border-slate-200 px-5 py-4 text-slate-700">
                      {new Date(group.effectiveFrom).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="border-b border-slate-200 px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${group.status === "Active"
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
                        isDeleteDisabled={group.status === "Inactive" || Boolean(group.isUsed)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-[#eef2f7] px-5 py-4 text-sm text-slate-500">
            <div>Showing 1 to {filteredGroups.length} of {filteredGroups.length} entries</div>

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
                <h2 className="text-[22px] font-bold text-slate-800">Create Leave Group</h2>
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
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Group Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      value={form.code}
                      onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase().slice(0, 5) }))}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base text-slate-700 outline-none focus:border-blue-300"
                      maxLength={5}
                      placeholder="GEN"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Group Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base text-slate-700 outline-none focus:border-blue-300"
                      maxLength={32}
                      placeholder="General Leave"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Leave Types <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="hidden"
                      required
                      value={form.leaveTypes.join(",")}
                      aria-label="Leave types required"
                    />

                    <LeaveTypeMultiSelect
                      values={form.leaveTypes}
                      options={leaveTypeOptions}
                      onChange={(nextValues) =>
                        setForm((prev) => ({
                          ...prev,
                          leaveTypes: nextValues,
                        }))
                      }
                    />

                    <div className="mt-2 text-xs text-slate-500">Select one or more leave types</div>
                  </div>
                  <div className="mt-5">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Leave Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={form.categoryId}
                      onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base text-slate-700 outline-none focus:border-blue-300"
                    >
                      <option value="">Select category name</option>
                      {leaveCategoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Effective From <span className="text-red-500">*</span>
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
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-base text-slate-700 outline-none focus:border-blue-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                    <select
                      value={form.status}
                      onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "Active" | "Inactive" }))}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base text-slate-700 outline-none focus:border-blue-300"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-[78px] w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-base text-slate-700 outline-none focus:border-blue-300"
                    maxLength={61}
                    placeholder="Group for general purpose leaves like Casual, Annual and Earned Leave."
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#2f5fbb] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#294f9c]"
                  >
                    Create
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

