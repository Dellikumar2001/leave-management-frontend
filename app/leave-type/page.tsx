"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Eye, Pencil, Trash2, X, MoreVertical } from "lucide-react";

const STORAGE_KEY = "leave-type-list";

type LeaveType = {
  id: number;
  code: string;
  name: string;
  category: "Annual" | "Medical" | "Casual" | "Emergency" | "Special";
  days: number;
  description: string;
  status: "Active" | "Inactive";
  isUsed?: boolean;
};

type LeaveTypeForm = {
  code: string;
  name: string
  category: LeaveType["category"];
  days: number;
  description: string;
  status: "Active" | "Inactive";
};

type RowActionsProps = {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleteDisabled?: boolean;
};

const categoryOptions: LeaveType["category"][] = [
  "Annual",
  "Medical",
  "Casual",
  "Emergency",
  "Special",
];

const initialLeaveTypes: LeaveType[] = [
  {
    id: 1,
    code: "CL",
    name: "Casual Leave",
    category: "Casual",
    days: 7,
    description: "Short-duration leave for personal and emergency needs.",
    status: "Active",
    isUsed: true,
  },
  {
    id: 2,
    code: "AL",
    name: "Annual Leave",
    category: "Annual",
    days: 15,
    description: "Paid annual leave accrued as part of the yearly leave cycle.",
    status: "Active",
    isUsed: true,
  },
  {
    id: 3,
    code: "ML",
    name: "Medical Leave",
    category: "Medical",
    days: 10,
    description: "Leave provided for illness and treatment-related absences.",
    status: "Active",
    isUsed: false,
  },
  {
    id: 4,
    code: "EL",
    name: "Earned Leave",
    category: "Annual",
    days: 12,
    description: "Leave accumulated based on service duration and eligibility.",
    status: "Inactive",
    isUsed: false,
  },
];

const getStoredLeaveTypes = (): LeaveType[] => {
  if (typeof window === "undefined") return initialLeaveTypes;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialLeaveTypes;

    const parsed = JSON.parse(saved) as LeaveType[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : initialLeaveTypes;
  } catch {
    return initialLeaveTypes;
  }
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
      <button
        onClick={() => setOpen((value) => !value)}
        className="p-1.5 text-slate-400 hover:text-slate-700"
        aria-label="More actions"
      >
        <MoreVertical size={16} />
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
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${
                isDeleteDisabled ? "cursor-not-allowed text-slate-400" : "text-red-600 hover:bg-red-50"
              }`}
              title={isDeleteDisabled ? "This leave type is already in use and cannot be deleted." : "Delete"}
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

export default function LeaveTypePage() {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(getStoredLeaveTypes);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<LeaveTypeForm>({
    code: "",
    name: "",
    category: "Annual",
    days: 1,
    description: "",
    status: "Active",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leaveTypes));
    }
  }, [leaveTypes]);

  const filteredLeaveTypes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leaveTypes.filter((leaveType) => {
      const matchesSearch =
        !query ||
        leaveType.code.toLowerCase().includes(query) ||
        leaveType.name.toLowerCase().includes(query) ||
        leaveType.category.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "All Status" || leaveType.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leaveTypes, search, statusFilter]);

  const handleSaveType = () => {
    const nextCode = form.code.trim().toUpperCase();
    const nextName = form.name.trim();

    if (!nextCode || !nextName || !form.description.trim() || form.days <= 0) {
      return;
    }

    const newLeaveType: LeaveType = {
      id: leaveTypes.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1,
      code: nextCode,
      name: nextName,
      category: form.category,
      days: form.days,
      description: form.description.trim(),
      status: form.status,
    };

    setLeaveTypes((prev) => [newLeaveType, ...prev]);
    setForm({
      code: "",
      name: "",
      category: "Annual",
      days: 1,
      description: "",
      status: "Active",
    });
    setIsModalOpen(false);
  };

  const handleDeleteType = (leaveId: number) => {
    setLeaveTypes((prev) => prev.filter((leaveType) => leaveType.id !== leaveId));
  };

  const handleViewType = (leaveType: LeaveType) => {
    router.push(`/leave-type/${leaveType.id}?mode=view`);
  };

  const handleEditType = (leaveType: LeaveType) => {
    router.push(`/leave-type/${leaveType.id}?mode=edit`);
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] p-4 text-slate-800">
      <div className="mx-auto max-w-[1400px]">
          <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#f5f7fa] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative w-[360px]">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              </span>
              <input
                value={search}
                // onChange={(event) => setSearch(event.target.value)}
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
        <header className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-[#f5f7fa] px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leave type..."
                className="w-full rounded-xl border border-slate-300 bg-[#f8f9fb] py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Leave Type
            </button>
          </div>
        </header>

        <main className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Leave Type</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Days</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredLeaveTypes.map((leaveType) => (
                  <tr key={leaveType.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-5 py-4 font-semibold text-slate-800">{leaveType.code}</td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{leaveType.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{leaveType.description}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {leaveType.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{leaveType.days} days</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          leaveType.status === "Active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {leaveType.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <RowActions
                        onView={() => handleViewType(leaveType)}
                        onEdit={() => handleEditType(leaveType)}
                        onDelete={() => handleDeleteType(leaveType.id)}
                        isDeleteDisabled={Boolean(leaveType.isUsed)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLeaveTypes.length === 0 && (
            <div className="flex items-center justify-center px-6 py-12 text-slate-500">
              No leave types match your current search.
            </div>
          )}
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Add Leave Type</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Leave Code</label>
                <input
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="CL"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Leave Category</label>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, category: event.target.value as LeaveType["category"] }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Leave Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Casual Leave"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Days Allowed</label>
                <input
                  type="number"
                  min={1}
                  value={form.days}
                  onChange={(event) => setForm((prev) => ({ ...prev, days: Number(event.target.value) || 0 }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value as "Active" | "Inactive" }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Describe when this leave type can be used."
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveType}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save Leave Type
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
