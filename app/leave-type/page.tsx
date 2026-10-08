"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Eye, Pencil, Trash2, X } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type LeaveType = {
  id: number;
  code: string;
  name: string;
  leaveGroup: string;
  leaveGroupId: number | null;
  daysAllowed: number;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  isUsed?: boolean;
};

type LeaveTypeForm = {
  code: string;
  name: string;
  leaveGroupId: string;
  daysAllowed: number;
  description: string;
  status: LeaveType["status"];
};

type LeaveGroupOption = {
  id: number;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
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
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveGroups, setLeaveGroups] = useState<LeaveGroupOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "view" | "edit">("create");
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<number | null>(null);
  const [form, setForm] = useState<LeaveTypeForm>({
    code: "",
    name: "",
    leaveGroupId: "",
    daysAllowed: 1,
    description: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/leave-types?status=${statusFilter}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load leave types.");
        return result as LeaveType[];
      })
      .then((types) => {
        if (isMounted) setLeaveTypes(types);
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

  useEffect(() => {
    let isMounted = true;
    fetch("/api/leave-requests")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load leave groups.");
        if (!Array.isArray(result?.data)) throw new Error("Unable to load leave groups.");
        return result.data as LeaveGroupOption[];
      })
      .then((groups) => {
        if (isMounted) setLeaveGroups(groups);
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "Unable to load leave groups.");
      });
    return () => {
      isMounted = false;
    };
  }, []);

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
    const leaveGroupId = Number(form.leaveGroupId);
    const selectedGroup = leaveGroups.find((group) => group.id === leaveGroupId);

    if (
      !nextCode ||
      !nextName ||
      !selectedGroup ||
      !Number.isSafeInteger(form.daysAllowed) ||
      form.daysAllowed < 1
    ) {
      return;
    }

    const newLeaveType = {
      code: nextCode,
      name: nextName,
      leaveGroup: selectedGroup.name,
      leaveGroupId,
      daysAllowed: form.daysAllowed,
      description: form.description.trim().toUpperCase(),
      status: form.status,
    };

    setError("");
    try {
      const isEditing = modalMode === "edit" && selectedLeaveTypeId !== null;
      const response = await fetch(isEditing ? `/api/leave-types/${selectedLeaveTypeId}` : "/api/leave-types", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLeaveType),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save the leave type.");
      if (isEditing) {
        const updatedLeaveType = result as LeaveType;
        setLeaveTypes((prev) => [
          updatedLeaveType,
          ...prev.filter((leaveType) =>
            leaveType.id !== updatedLeaveType.id &&
            (statusFilter === "ALL" || updatedLeaveType.status === statusFilter),
          ),
        ].filter((leaveType) => statusFilter === "ALL" || leaveType.status === statusFilter));
      } else {
        setLeaveTypes((prev) => [result as LeaveType, ...prev]);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the leave type.");
      return;
    }
    setForm({
      code: "",
      name: "",
      leaveGroupId: "",
      daysAllowed: 1,
      description: "",
      status: "ACTIVE",
    });
    setIsModalOpen(false);
    setSelectedLeaveTypeId(null);
    setModalMode("create");
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

  const openLeaveTypeModal = (leaveType: LeaveType, mode: "view" | "edit") => {
    setSelectedLeaveTypeId(leaveType.id);
    setModalMode(mode);
    const legacyGroup = leaveGroups.find((group) =>
      group.name.toUpperCase() === leaveType.leaveGroup.toUpperCase() ||
      group.code.toUpperCase() === leaveType.leaveGroup.toUpperCase(),
    );
    setForm({
      code: leaveType.code,
      name: leaveType.name,
      leaveGroupId: String(leaveType.leaveGroupId ?? legacyGroup?.id ?? ""),
      paymentType: leaveType.paymentType,
      daysAllowed: leaveType.daysAllowed,
      description: leaveType.description,
      status: leaveType.status,
    });
    setError("");
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setSelectedLeaveTypeId(null);
    setModalMode("create");
    setForm({
      code: "",
      name: "",
      leaveGroupId: "",
      paymentType: "PAID",
      daysAllowed: 1,
      description: "",
      status: "ACTIVE",
    });
    setError("");
    setIsModalOpen(true);
  };

  return (
    <main className="min-h-screen bg-[#e9edf3] p-4 text-slate-800">
      <LeaveSidebar activePage="leave-types" />
      <div className="p-4 min-[801px]:ml-43.75 uppercase">
        <div className="mx-auto max-w-350">
          <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#f5f7fa] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-90">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search leave types..."
                aria-label="Search leave types"
                className="w-full rounded-xl border border-slate-300 bg-[#f8f9fb] py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300"
              />
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
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
            <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-800 sm:text-[38px]">Leave Type</h1>
                <p className="mt-1 text-sm text-slate-500 sm:text-base">Create and manage leave types.</p>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f5fbb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#294f9c]"
              >
                <Plus size={16} />
                Add Leave Type
              </button>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-[#eef2f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">{filteredLeaveTypes.length} leave types</p>
              <label className="relative w-full sm:w-auto">
                <span className="sr-only">Filter by status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setIsLoading(true);
                    setError("");
                    setStatusFilter(event.target.value);
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-700 outline-none focus:border-blue-300 sm:w-auto"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500" aria-hidden="true">⌄</span>
              </label>
            </div>

            {error && <p role="alert" className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-[#eef2f7] text-xs font-semibold uppercase text-slate-600 sm:text-sm">
                    <th className="border-b border-slate-200 px-5 py-4">Sno</th>
                    <th className="border-b border-slate-200 px-5 py-4">Code</th>
                    <th className="border-b border-slate-200 px-5 py-4">Leave Type</th>
                    <th className="border-b border-slate-200 px-5 py-4">Leave Group</th>
                    <th className="border-b border-slate-200 px-5 py-4">Days Allowed</th>
                    <th className="border-b border-slate-200 px-5 py-4">Status</th>
                    <th className="border-b border-slate-200 px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} className="bg-white px-5 py-10 text-center text-sm text-slate-500">Loading leave types...</td></tr>
                  ) : filteredLeaveTypes.length === 0 ? (
                    <tr><td colSpan={7} className="bg-white px-5 py-10 text-center text-sm text-slate-500">No leave types match your current search.</td></tr>
                  ) : filteredLeaveTypes.map((leaveType, index) => (
                    <tr key={leaveType.id} className="bg-white text-sm text-slate-700 even:bg-[#f9fafc]">
                      <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-500">{index + 1}</td>
                      <td className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-700">{leaveType.code}</td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <div>
                          <p className="font-medium text-slate-800">{leaveType.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{leaveType.description}</p>
                        </div>
                      </td>
                      <td className="border-b border-slate-200 px-5 py-4 text-slate-700">{leaveType.leaveGroup}</td>
                      <td className="border-b border-slate-200 px-5 py-4 text-slate-700">{leaveType.daysAllowed}</td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${leaveType.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                          }`}>
                          {leaveType.status}
                        </span>
                      </td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <RowActions
                          onView={() => openLeaveTypeModal(leaveType, "view")}
                          onEdit={() => openLeaveTypeModal(leaveType, "edit")}
                          onDelete={() => handleDeleteType(leaveType.id)}
                          isDeleteDisabled={leaveType.status !== "ACTIVE"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 bg-[#eef2f7] px-5 py-4 text-sm text-slate-500">
              Showing {filteredLeaveTypes.length} of {leaveTypes.length} leave types
            </div>
          </section>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-[1px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (modalMode !== "view") void handleSaveType();
            }}
            className="my-auto max-h-[90vh] w-full max-w-160 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {modalMode === "create" ? "Create Leave Type" : modalMode === "edit" ? "Edit Leave Type" : "Leave Type Details"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{modalMode === "view" ? "Leave type configuration" : "Enter the leave type details below."}</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Leave type code <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.code}
                  readOnly={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  placeholder="CL"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Leave type name <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.name}
                  readOnly={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value.toUpperCase() }))}
                  placeholder="CASUAL LEAVE"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Leave group <span className="text-red-500">*</span></label>
                <select
                  required
                  value={form.leaveGroupId}
                  disabled={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, leaveGroupId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 disabled:text-slate-500"
                >
                  <option value="">Select a leave group</option>
                  {leaveGroups
                    .filter((group) => group.status === "ACTIVE" || String(group.id) === form.leaveGroupId)
                    .map((group) => (
                      <option key={group.id} value={group.id} disabled={group.status !== "ACTIVE"}>
                        {group.name} ({group.code}){group.status !== "ACTIVE" ? " - INACTIVE" : ""}
                      </option>
                    ))}
                </select>
                {leaveGroups.every((group) => group.status !== "ACTIVE") && modalMode === "create" && (
                  <p className="mt-1.5 text-xs text-slate-500">Create an active leave group before adding a leave type.</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Paid or unpaid leave <span className="text-red-500">*</span></label>
                <select
                  required
                  value={form.paymentType}
                  disabled={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, paymentType: event.target.value as LeaveType["paymentType"] }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 disabled:text-slate-500"
                >
                  <option value="PAID">PAID</option>
                  <option value="UNPAID">UNPAID</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Days allowed <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={form.daysAllowed || ""}
                  readOnly={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, daysAllowed: event.target.value === "" ? 0 : Number(event.target.value) }))}
                  onKeyDown={(event) => {
                    if (["ArrowUp", "ArrowDown", "e", "E", "+", "-", ".", ","].includes(event.key)) event.preventDefault();
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                  style={{ appearance: "textfield" }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Status <span className="text-red-500">*</span></label>
                <select
                  required
                  value={form.status}
                  disabled={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as LeaveType["status"] }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 disabled:text-slate-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  readOnly={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value.toUpperCase() }))}
                  placeholder="DESCRIBE WHEN THIS LEAVE TYPE CAN BE USED."
                  rows={4}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                />
              </div>
              {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {modalMode === "view" ? "Close" : "Cancel"}
              </button>
              {modalMode !== "view" && <button
                type="submit"
                className="rounded-xl bg-[#2f5fbb] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#294f9c]"
              >
                {modalMode === "edit" ? "Save Changes" : "Create"}
              </button>}
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
