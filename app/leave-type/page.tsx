"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Eye, Pencil, Trash2, X } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type LeaveType = {
  id: number;
  code: string;
  name: string;
  leaveGroup: string;
  daysAllowed: number;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  isUsed?: boolean;
};

type LeaveTypeForm = {
  code: string;
  name: string;
  leaveGroup: string;
  daysAllowed: number;
  description: string;
  status: LeaveType["status"];
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
    const openAbove = window.innerHeight - bounds.bottom < menuHeight + 8;
    setMenuPosition({
      top: openAbove ? bounds.top - menuHeight - 8 : bounds.bottom + 8,
      left: Math.min(Math.max(8, bounds.right - menuWidth), window.innerWidth - menuWidth - 8),
    });
    setOpen(true);
  };

  return (
    <div className="relative flex items-center justify-end gap-1">
      <button onClick={onView} className="p-1.5 text-slate-400 hover:text-slate-700" title="View">
        <Eye size={16} />
      </button>
      <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700" title="Edit">
        <Pencil size={16} />
      </button>
      <button
        ref={actionsButtonRef}
        onClick={toggleMenu}
        className="p-1.5 text-slate-400 hover:text-slate-700"
        aria-label="More actions"
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
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${isDeleteDisabled ? "cursor-not-allowed text-slate-400" : "text-red-600 hover:bg-red-50"}`}
              title={isDeleteDisabled ? "Inactive leave types cannot be deleted." : "Delete"}
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
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<LeaveTypeForm>({
    code: "",
    name: "",
    leaveGroup: "",
    daysAllowed: 1,
    description: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError("");
    fetch(`/api/leave-types?status=${statusFilter}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load leave types.");
        return result as LeaveType[];
      })
      .then((result) => {
        if (isMounted) setLeaveTypes(result);
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "Unable to load leave types.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [statusFilter]);

  const filteredLeaveTypes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leaveTypes.filter((leaveType) => {
      const matchesSearch =
        !query ||
        leaveType.code.toLowerCase().includes(query) ||
        leaveType.name.toLowerCase().includes(query) ||
        leaveType.leaveGroup.toLowerCase().includes(query);

      return matchesSearch;
    });
  }, [leaveTypes, search, statusFilter]);

  const handleSaveType = async () => {
    const nextCode = form.code.trim().toUpperCase();
    const nextName = form.name.trim().toUpperCase();
    const nextLeaveGroup = form.leaveGroup.trim().toUpperCase();

    if (
      !nextCode ||
      !nextName ||
      !nextLeaveGroup ||
      !Number.isSafeInteger(form.daysAllowed) ||
      form.daysAllowed < 1
    ) {
      return;
    }

    const newLeaveType = {
      code: nextCode,
      name: nextName,
      leaveGroup: nextLeaveGroup,
      daysAllowed: form.daysAllowed,
      description: form.description.trim().toUpperCase(),
      status: form.status,
    };

    setError("");
    try {
      const response = await fetch("/api/leave-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLeaveType),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save the leave type.");
      setLeaveTypes((prev) => [result as LeaveType, ...prev]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the leave type.");
      return;
    }
    setForm({
      code: "",
      name: "",
      leaveGroup: "",
      daysAllowed: 1,
      description: "",
      status: "ACTIVE",
    });
    setIsModalOpen(false);
  };

  const handleDeleteType = async (leaveId: number) => {
    setError("");
    try {
      const response = await fetch(`/api/leave-types/${leaveId}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Unable to delete the leave type.");
      }
      setLeaveTypes((prev) => prev.filter((leaveType) => leaveType.id !== leaveId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the leave type.");
    }
  };

  const handleViewType = (leaveType: LeaveType) => {
    router.push(`/leave-type/${leaveType.id}?mode=view`);
  };

  const handleEditType = (leaveType: LeaveType) => {
    router.push(`/leave-type/${leaveType.id}?mode=edit`);
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="leave-types" />
      <div className="p-4 min-[801px]:ml-[175px]">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#f5f7fa] px-4 py-3 shadow-sm">
          <div className="flex flex-col justify-start px-5 py-5">
            <h1 className="text-3xl font-bold text-slate-800">Leave Type</h1>
            {/* <p className="mt-1 text-lg text-slate-500">Create and manage leave types to categorize leave types.</p> */}
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
            <div className="relative w-full md:w-[1020px]">
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
              <option value="ALL">ALL STATUS</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              <Plus size={16} />
              ADD LEAVE TYPE
            </button>
          </div>
        </header>

        <main className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-medium">S.NO</th>
                  <th className="px-5 py-3 font-medium">CODE</th>
                  <th className="px-5 py-3 font-medium">LEAVE TYPE</th>
                  <th className="px-5 py-3 font-medium">LEAVE GROUP</th>
                  <th className="px-5 py-3 font-medium">DAYS ALLOWED</th>
                  <th className="px-5 py-3 font-medium">STATUS</th>
                  <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {!isLoading && filteredLeaveTypes.map((leaveType, index) => (
                  <tr key={leaveType.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="px-5 py-4 text-slate-500">{index + 1}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{leaveType.code}</td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{leaveType.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{leaveType.description}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{leaveType.leaveGroup}</td>
                    <td className="px-5 py-4 text-slate-700">{leaveType.daysAllowed}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${leaveType.status === "ACTIVE"
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
                        isDeleteDisabled={leaveType.status !== "ACTIVE"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isLoading && <div className="flex items-center justify-center px-6 py-12 text-slate-500">Loading leave types...</div>}
          {!isLoading && filteredLeaveTypes.length === 0 && (
            <div className="flex items-center justify-center px-6 py-12 text-slate-500">
              No leave types match your current search.
            </div>
          )}
        </main>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveType();
            }}
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                {/* <p className="text-sm font-medium uppercase tracking-wide text-slate-500">CREATE LEAVE TYPE</p> */}
                <h2 className="mt-1 text-3xl font-bold text-slate-800">CREATE NEW LEAVE TYPE</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">LEAVE TYPE CODE <span className="text-red-600">*</span></label>
                <input
                  required
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  placeholder="CL"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">LEAVE TYPE NAME <span className="text-red-600">*</span></label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value.toUpperCase() }))}
                  placeholder="CASUAL LEAVE"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">LEAVE GROUP <span className="text-red-600">*</span></label>
                <input
                  required
                  value={form.leaveGroup}
                  onChange={(event) => setForm((prev) => ({ ...prev, leaveGroup: event.target.value.toUpperCase() }))}
                  placeholder="GENERAL LEAVE"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">DAYS ALLOWED <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={form.daysAllowed || ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, daysAllowed: event.target.value === "" ? 0 : Number(event.target.value) }))}
                  onKeyDown={(event) => {
                    if (["ArrowUp", "ArrowDown", "e", "E", "+", "-", ".", ","].includes(event.key)) event.preventDefault();
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
                  style={{ appearance: "textfield" }}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">STATUS <span className="text-red-600">*</span></label>
                <select
                  required
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as LeaveType["status"] }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">DESCRIPTION</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value.toUpperCase() }))}
                  placeholder="DESCRIBE WHEN THIS LEAVE TYPE CAN BE USED."
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                CREATE
              </button>
            </div>
          </form>
        </div>
      )}
      </div>
    </div>
  );
}
