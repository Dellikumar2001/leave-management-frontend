"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Eye, Pencil, Trash2, X, ChevronDown } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type LeaveType = {
  id: number;
  code: string;
  name: string;
  leaveGroup: string;
  leaveGroupId: number | null;
  leaveCategory?: string | null;
  leaveCategoryId?: number | null;
  paymentType?: "PAID" | "UNPAID";
  daysAllowed: number;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  isUsed?: boolean;
};

type LeaveTypeForm = {
  code: string;
  name: string;
  leaveGroupId: string;
  leaveCategoryId: string;
  paymentType: "PAID" | "UNPAID";
  daysAllowed: number;
  description: string;
  status: LeaveType["status"];
};

type LeaveGroupOption = {
  id: number;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  categoryId?: number | null;
  categoryIds?: number[];
  category?: {
    id: number;
    name: string;
    code: string;
  } | null;
};

type LeaveCategoryOption = {
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
      <button type="button" onClick={onView} className="p-1.5 text-slate-400 hover:text-slate-700" title="VIEW">
        <Eye size={16} />
      </button>
      <button type="button" onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700" title="EDIT">
        <Pencil size={16} />
      </button>
      <button
        type="button"
        ref={actionsButtonRef}
        onClick={toggleMenu}
        className="p-1.5 text-slate-400 hover:text-slate-700"
        aria-label="MORE ACTIONS"
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
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm uppercase ${isDeleteDisabled ? "cursor-not-allowed text-slate-400" : "text-red-600 hover:bg-red-50"
                }`}
              title={isDeleteDisabled ? "INACTIVE LEAVE TYPES CANNOT BE DELETED." : "DELETE"}
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

export default function LeaveTypePage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveGroups, setLeaveGroups] = useState<LeaveGroupOption[]>([]);
  const [leaveCategories, setLeaveCategories] = useState<LeaveCategoryOption[]>([]);
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
    leaveCategoryId: "",
    paymentType: "PAID",
    daysAllowed: 1,
    description: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    if (isModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isModalOpen]);

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/leave-types?status=${statusFilter}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "UNABLE TO LOAD LEAVE TYPES.");
        return result as LeaveType[];
      })
      .then((types) => {
        if (isMounted) {
          setLeaveTypes(
            types.map((type) => ({
              ...type,
              code: String(type.code ?? "").toUpperCase(),
              name: String(type.name ?? "").toUpperCase(),
              leaveGroup: String(type.leaveGroup ?? "").toUpperCase(),
              leaveCategory: type.leaveCategory ? String(type.leaveCategory).toUpperCase() : null,
              description: String(type.description ?? "").toUpperCase(),
              status: type.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
            }))
          );
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message.toUpperCase() : "UNABLE TO LOAD LEAVE TYPES.");
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
        return result.data.map((group: LeaveGroupOption & {
          categories?: { categoryId?: number }[];
        }) => {
          const categoryIds = group.categories?.map(({ categoryId }) => Number(categoryId))
            .filter(Number.isSafeInteger) ?? [];
          if (group.categoryId && !categoryIds.includes(group.categoryId)) categoryIds.push(group.categoryId);
          return { ...group, categoryIds };
        });
      })
      .then((groups) => {
        if (isMounted) {
          setLeaveGroups(
            groups.map((group) => ({
              ...group,
              code: String(group.code ?? "").toUpperCase(),
              name: String(group.name ?? "").toUpperCase(),
              status: group.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
            }))
          );
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message.toUpperCase() : "UNABLE TO LOAD LEAVE GROUPS.");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/leave-categories")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "UNABLE TO LOAD LEAVE CATEGORIES.");
        if (!Array.isArray(result?.data)) return [];
        return result.data as LeaveCategoryOption[];
      })
      .then((categories) => {
        if (isMounted) {
          setLeaveCategories(
            categories
              .filter((c) => c.status === "ACTIVE")
              .map((c) => ({
                ...c,
                code: String(c.code ?? "").toUpperCase(),
                name: String(c.name ?? "").toUpperCase(),
                status: "ACTIVE",
              }))
          );
        }
      })
      .catch((loadError: unknown) => {
        console.error("Unable to load leave categories:", loadError);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLeaveTypes = useMemo(() => {
    const query = search.trim().toUpperCase();

    return leaveTypes.filter((leaveType) => {
      const matchesSearch =
        !query ||
        leaveType.code.toUpperCase().includes(query) ||
        leaveType.name.toUpperCase().includes(query) ||
        leaveType.leaveGroup.toUpperCase().includes(query) ||
        (leaveType.leaveCategory && leaveType.leaveCategory.toUpperCase().includes(query));

      return matchesSearch;
    });
  }, [leaveTypes, search]);

  const handleSaveType = async () => {
    const nextCode = form.code.trim().toUpperCase();
    const nextName = form.name.trim().toUpperCase();
    const leaveGroupId = form.leaveGroupId ? Number(form.leaveGroupId) : undefined;
    const leaveCategoryId = form.leaveCategoryId ? Number(form.leaveCategoryId) : undefined;
    const selectedGroup = leaveGroupId ? leaveGroups.find((group) => group.id === leaveGroupId) : undefined;

    if (
      !nextCode ||
      !Number.isSafeInteger(form.daysAllowed) ||
      form.daysAllowed < 1
    ) {
      return;
    }

    const newLeaveType = {
      code: nextCode,
      name: nextName,
      leaveGroup: selectedGroup ? selectedGroup.name.toUpperCase() : "",
      ...(leaveGroupId ? { leaveGroupId } : {}),
      ...(leaveCategoryId ? { leaveCategoryId } : {}),
      paymentType: form.paymentType,
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
      if (!response.ok) throw new Error(result.error ?? "UNABLE TO SAVE THE LEAVE TYPE.");
      if (isEditing) {
        const updatedLeaveType = {
          ...(result as LeaveType),
          code: String(result.code ?? "").toUpperCase(),
          name: String(result.name ?? "").toUpperCase(),
          leaveGroup: String(result.leaveGroup ?? "").toUpperCase(),
          leaveCategory: result.leaveCategory ? String(result.leaveCategory).toUpperCase() : null,
          description: String(result.description ?? "").toUpperCase(),
        };
        setLeaveTypes((prev) => [
          updatedLeaveType,
          ...prev.filter((leaveType) =>
            leaveType.id !== updatedLeaveType.id &&
            (statusFilter === "ALL" || updatedLeaveType.status === statusFilter),
          ),
        ].filter((leaveType) => statusFilter === "ALL" || leaveType.status === statusFilter));
      } else {
        const createdLeaveType = {
          ...(result as LeaveType),
          code: String(result.code ?? "").toUpperCase(),
          name: String(result.name ?? "").toUpperCase(),
          leaveGroup: String(result.leaveGroup ?? "").toUpperCase(),
          leaveCategory: result.leaveCategory ? String(result.leaveCategory).toUpperCase() : null,
          description: String(result.description ?? "").toUpperCase(),
        };
        setLeaveTypes((prev) => [createdLeaveType, ...prev]);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message.toUpperCase() : "UNABLE TO SAVE THE LEAVE TYPE.");
      return;
    }
    setForm({
      code: "",
      name: "",
      leaveGroupId: "",
      leaveCategoryId: "",
      paymentType: "PAID",
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
        throw new Error(result.error ?? "UNABLE TO DELETE THE LEAVE TYPE.");
      }
      setLeaveTypes((prev) => prev.filter((leaveType) => leaveType.id !== leaveId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message.toUpperCase() : "UNABLE TO DELETE THE LEAVE TYPE.");
    }
  };

  const openLeaveTypeModal = (leaveType: LeaveType, mode: "view" | "edit") => {
    setSelectedLeaveTypeId(leaveType.id);
    setModalMode(mode);
    const legacyGroup = leaveGroups.find((group) =>
      group.name.toUpperCase() === leaveType.leaveGroup.toUpperCase() ||
      group.code.toUpperCase() === leaveType.leaveGroup.toUpperCase(),
    );
    const groupId = leaveType.leaveGroupId ?? legacyGroup?.id ?? null;
    const matchedGroup = leaveGroups.find((g) => g.id === groupId);
    const categoryId = leaveType.leaveCategoryId ?? matchedGroup?.categoryId ?? null;

    setForm({
      code: leaveType.code.toUpperCase(),
      name: leaveType.name.toUpperCase(),
      leaveGroupId: String(groupId ?? ""),
      leaveCategoryId: String(categoryId ?? ""),
      paymentType: (leaveType.paymentType ?? "PAID").toUpperCase() as "PAID" | "UNPAID",
      daysAllowed: leaveType.daysAllowed,
      description: leaveType.description.toUpperCase(),
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
      leaveCategoryId: "",
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
      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px] uppercase">
          {/* Header */}
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">LEAVE TYPE</h1>
          </header>

          {/* Inline Filter & Action bar */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH LEAVE TYPES..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value.toUpperCase())}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm uppercase text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Status Dropdown */}
              <div className="relative min-w-[170px]">
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setIsLoading(true);
                    setError("");
                    setStatusFilter(event.target.value.toUpperCase());
                  }}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 pr-9 text-sm uppercase text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ALL">ALL STATUS</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              {/* Add Leave Type Button */}
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2f5fbb] px-5 text-sm font-medium uppercase text-white transition-colors hover:bg-[#294f9c]"
              >
                <Plus size={16} />
                CREATE LEAVE TYPE
              </button>
            </div>
          </div>

          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm uppercase text-red-700">{error}</p>}

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-[#f8fafc] text-xs font-semibold uppercase text-slate-600 sm:text-sm">
                    <th className="border-b border-slate-200 px-5 py-4">SNO</th>
                    <th className="border-b border-slate-200 px-5 py-4">CODE</th>
                    <th className="border-b border-slate-200 px-5 py-4">LEAVE TYPE</th>
                    <th className="border-b border-slate-200 px-5 py-4">LEAVE GROUP</th>
                    <th className="border-b border-slate-200 px-5 py-4">LEAVE CATEGORY</th>
                    <th className="border-b border-slate-200 px-5 py-4">DAYS ALLOWED</th>
                    <th className="border-b border-slate-200 px-5 py-4">STATUS</th>
                    <th className="border-b border-slate-200 px-5 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="bg-white px-5 py-10 text-center text-sm uppercase text-slate-500">LOADING LEAVE TYPES...</td></tr>
                  ) : filteredLeaveTypes.length === 0 ? (
                    <tr><td colSpan={8} className="bg-white px-5 py-10 text-center text-sm uppercase text-slate-500">NO LEAVE TYPES MATCH YOUR CURRENT SEARCH.</td></tr>
                  ) : filteredLeaveTypes.map((leaveType, index) => (
                    <tr key={leaveType.id} className="bg-white text-sm uppercase text-slate-700 even:bg-[#f9fafc] hover:bg-slate-50/70">
                      <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-500">{index + 1}</td>
                      <td className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-700">{leaveType.code}</td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <div>
                          <p className="font-medium text-slate-800">{leaveType.name || "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">{leaveType.description}</p>
                        </div>
                      </td>
                      <td className="border-b border-slate-200 px-5 py-4 text-slate-700">{leaveType.leaveGroup || "—"}</td>
                      <td className="border-b border-slate-200 px-5 py-4 text-slate-700">{leaveType.leaveCategory || "—"}</td>
                      <td className="border-b border-slate-200 px-5 py-4 text-slate-700">{leaveType.daysAllowed}</td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase ${leaveType.status === "ACTIVE"
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
            <div className="border-t border-slate-200 bg-[#f8fafc] px-5 py-4 text-sm uppercase text-slate-500">
              SHOWING {filteredLeaveTypes.length} OF {leaveTypes.length} LEAVE TYPES
            </div>
          </section>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-[1px] uppercase overscroll-contain">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (modalMode !== "view") void handleSaveType();
            }}
            className="my-auto max-h-[90vh] w-full max-w-160 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)] overscroll-contain"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-800">
                  {modalMode === "create" ? "CREATE LEAVE TYPE" : modalMode === "edit" ? "EDIT LEAVE TYPE" : "LEAVE TYPE DETAILS"}
                </h2>
                <p className="mt-1 text-sm uppercase text-slate-500">{modalMode === "view" ? "LEAVE TYPE CONFIGURATION" : "ENTER THE LEAVE TYPE DETAILS BELOW."}</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="CLOSE DIALOG">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">LEAVE TYPE CODE <span className="text-red-500">*</span></label>
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
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">PAYMENT TYPE</label>
                <select
                  value={form.paymentType}
                  disabled={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({
                    ...prev,
                    paymentType: event.target.value.toUpperCase() as LeaveTypeForm["paymentType"],
                  }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 disabled:text-slate-500"
                >
                  <option value="PAID">PAID</option>
                  <option value="UNPAID">UNPAID</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">LEAVE TYPE NAME</label>
                <input
                  value={form.name}
                  readOnly={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value.toUpperCase() }))}
                  placeholder="CASUAL LEAVE"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">LEAVE GROUP</label>
                <select
                  value={form.leaveGroupId}
                  disabled={modalMode === "view"}
                  onChange={(event) => {
                    const nextGroupId = event.target.value;
                    const group = leaveGroups.find((g) => String(g.id) === nextGroupId);
                    setForm((prev) => ({
                      ...prev,
                      leaveGroupId: nextGroupId,
                      ...(
                        group && !group.categoryIds?.includes(Number(prev.leaveCategoryId))
                          ? { leaveCategoryId: String(group.categoryIds?.[0] ?? group.categoryId ?? "") }
                          : {}
                      ),
                    }));
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 disabled:text-slate-500"
                >
                  <option value="">SELECT A LEAVE GROUP</option>
                  {leaveGroups
                    .filter((group) => {
                      const isActive = group.status === "ACTIVE" || String(group.id) === form.leaveGroupId;
                      if (!form.leaveCategoryId) return isActive;
                      return isActive && (
                        group.categoryIds?.includes(Number(form.leaveCategoryId)) ||
                        group.categoryId === Number(form.leaveCategoryId) ||
                        String(group.id) === form.leaveGroupId
                      );
                    })
                    .map((group) => (
                      <option key={group.id} value={group.id} disabled={group.status !== "ACTIVE"}>
                        {group.name} ({group.code}){group.status !== "ACTIVE" ? " - INACTIVE" : ""}
                      </option>
                    ))}
                </select>
                {leaveGroups.every((group) => group.status !== "ACTIVE") && modalMode === "create" && (
                  <p className="mt-1.5 text-xs uppercase text-slate-500">CREATE AN ACTIVE LEAVE GROUP BEFORE ADDING A LEAVE TYPE.</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">LEAVE CATEGORY</label>
                <select
                  value={form.leaveCategoryId}
                  disabled={modalMode === "view"}
                  onChange={(event) => {
                    const nextCatId = event.target.value;
                    setForm((prev) => {
                      const currentGroup = leaveGroups.find((g) => String(g.id) === prev.leaveGroupId);
                      const groupMatches = nextCatId && (
                        currentGroup?.categoryIds?.includes(Number(nextCatId)) ||
                        currentGroup?.categoryId === Number(nextCatId)
                      );
                      return {
                        ...prev,
                        leaveCategoryId: nextCatId,
                        leaveGroupId: groupMatches ? prev.leaveGroupId : "",
                      };
                    });
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 disabled:text-slate-500"
                >
                  <option value="">SELECT A LEAVE CATEGORY</option>
                  {leaveCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">DAYS ALLOWED <span className="text-red-500">*</span></label>
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                  style={{ appearance: "textfield" }}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">STATUS <span className="text-red-500">*</span></label>
                <select
                  required
                  value={form.status}
                  disabled={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value.toUpperCase() as LeaveType["status"] }))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 disabled:text-slate-500"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium uppercase text-slate-700">DESCRIPTION</label>
                <textarea
                  value={form.description}
                  readOnly={modalMode === "view"}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value.toUpperCase() }))}
                  placeholder="DESCRIBE WHEN THIS LEAVE TYPE CAN BE USED."
                  rows={4}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                />
              </div>
              {error && <p role="alert" className="text-sm uppercase text-red-700 sm:col-span-2">{error}</p>}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium uppercase text-slate-700 hover:bg-slate-50"
              >
                {modalMode === "view" ? "CLOSE" : "CANCEL"}
              </button>
              {modalMode !== "view" && (
                <button
                  type="submit"
                  className="rounded-xl bg-[#2f5fbb] px-5 py-2.5 text-sm font-semibold uppercase text-white hover:bg-[#294f9c]"
                >
                  {modalMode === "edit" ? "SAVE CHANGES" : "CREATE"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </main>
  );
}