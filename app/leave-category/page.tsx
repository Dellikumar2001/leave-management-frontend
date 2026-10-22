"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Eye, Trash2, X, ChevronDown } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type LeaveCategory = {
  id: number;
  code: string;
  name: string;
  paymentType: "PAID" | "UNPAID";
  isPaid?: boolean;
  description: string;
  status: "ACTIVE" | "INACTIVE";
};

type LeaveCategoryForm = Omit<LeaveCategory, "id" | "isPaid">;
type DialogMode = "create" | "edit" | "view";

type CategoryRowActionsProps = {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleteDisabled: boolean;
};

function CategoryRowActions({ onView, onEdit, onDelete, isDeleteDisabled }: CategoryRowActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center justify-end gap-1">
      <button type="button" onClick={onView} className="p-1.5 text-slate-400 hover:text-slate-700" title="View" aria-label="View">
        <Eye size={16} />
      </button>
      <button type="button" onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700" title="Edit" aria-label="Edit">
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
          <div className="absolute right-0 top-8 z-20 w-40 rounded-md border border-slate-200 bg-white shadow-lg">
            <button
              type="button"
              disabled={isDeleteDisabled}
              onClick={() => {
                if (isDeleteDisabled) return;
                setOpen(false);
                onDelete();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${isDeleteDisabled ? "cursor-not-allowed text-slate-400" : "text-red-600 hover:bg-red-50"}`}
              title={isDeleteDisabled ? "Inactive leave categories cannot be deleted." : "Delete"}
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

const emptyForm: LeaveCategoryForm = {
  code: "",
  name: "",
  paymentType: "PAID",
  description: "",
  status: "ACTIVE",
};

const mapCategory = (item: {
  id: number;
  code: string;
  name: string;
  paymentType?: string | null;
  isPaid?: boolean | null;
  description?: string | null;
  status: string;
}): LeaveCategory => ({
  id: Number(item.id),
  code: String(item.code ?? "").toUpperCase(),
  name: String(item.name ?? "").toUpperCase(),
  paymentType: (item.paymentType === "UNPAID" || item.isPaid === false) ? "UNPAID" : "PAID",
  isPaid: item.paymentType === "UNPAID" || item.isPaid === false ? false : true,
  description: String(item.description ?? "").toUpperCase(),
  status: item.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
});

export default function LeaveCategoryPage() {
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL STATUS");
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [activeCategory, setActiveCategory] = useState<LeaveCategory | null>(null);
  const [form, setForm] = useState<LeaveCategoryForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch("/api/leave-categories");
        if (!response.ok) throw new Error("Unable to load leave categories.");
        const json = await response.json();
        setCategories(Array.isArray(json?.data) ? json.data.map(mapCategory) : []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load leave categories.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toUpperCase();

    return categories.filter((category) => {
      const matchesSearch =
        !query ||
        category.code.toUpperCase().includes(query) ||
        category.name.toUpperCase().includes(query) ||
        category.description.toUpperCase().includes(query);
      const matchesStatus = statusFilter === "ALL STATUS" || category.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const openDialog = (nextMode: DialogMode, category?: LeaveCategory) => {
    setMode(nextMode);
    setActiveCategory(category ?? null);
    setForm(category ? {
      code: category.code.toUpperCase(),
      name: category.name.toUpperCase(),
      paymentType: category.paymentType,
      description: category.description.toUpperCase(),
      status: category.status,
    } : emptyForm);
    setError("");
  };

  const closeDialog = () => {
    if (isSaving) return;
    setMode(null);
    setActiveCategory(null);
    setForm(emptyForm);
    setError("");
  };

  const handleSave = async () => {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim().toUpperCase(),
      paymentType: form.paymentType,
      isPaid: form.paymentType === "PAID",
      description: form.description.trim().toUpperCase(),
      status: form.status,
    };

    if (!payload.code || !payload.name) {
      setError("ENTER A CATEGORY NAME AND CODE.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const isEditing = mode === "edit" && activeCategory;
      const response = await fetch(
        isEditing ? `/api/leave-categories/${activeCategory.id}` : "/api/leave-categories",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error ?? "Unable to save leave category.");

      const savedCategory = mapCategory(json.data);
      setCategories((current) => isEditing
        ? current.map((category) => category.id === savedCategory.id ? savedCategory : category)
        : [savedCategory, ...current]);
      setMode(null);
      setActiveCategory(null);
      setForm(emptyForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save leave category.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (category: LeaveCategory) => {
    try {
      const response = await fetch(`/api/leave-categories/${category.id}`, { method: "DELETE" });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error ?? "Unable to delete leave category.");
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setError("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete leave category.");
    }
  };

  return (
    <main className="min-h-screen bg-[#e9edf3] p-4 text-slate-800">
      <LeaveSidebar activePage="leave-category" />
      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-350 uppercase">
          {/* Header matched to Leave Eligibility banner */}
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">LEAVE CATEGORY</h1>
          </header>

          {/* Inline Filter & Action bar */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search Bar in UPPERCASE */}
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH CATEGORIES..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value.toUpperCase())}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm uppercase text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Status Dropdown in UPPERCASE */}
              <div className="relative min-w-[170px]">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value.toUpperCase())}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 pr-9 text-sm uppercase text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ALL STATUS">ALL STATUS</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              {/* Create Category Button in UPPERCASE */}
              <button
                type="button"
                onClick={() => openDialog("create")}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2f5fbb] px-5 text-sm font-medium uppercase text-white transition-colors hover:bg-[#294f9c]"
              >
                <Plus size={16} />
                CREATE CATEGORY
              </button>
            </div>
          </div>

          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {error && !mode && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm uppercase text-red-700">{error}</p>}

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-[#f8fafc] text-xs font-semibold uppercase text-slate-600 sm:text-sm">
                    <th className="border-b border-slate-200 px-5 py-4">SNO</th>
                    <th className="border-b border-slate-200 px-5 py-4">CATEGORY CODE</th>
                    <th className="border-b border-slate-200 px-5 py-4">CATEGORY NAME</th>
                    <th className="border-b border-slate-200 px-5 py-4">PAYMENT TYPE</th>
                    <th className="border-b border-slate-200 px-5 py-4">DESCRIPTION</th>
                    <th className="border-b border-slate-200 px-5 py-4">STATUS</th>
                    <th className="border-b border-slate-200 px-5 py-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={7} className="bg-white px-5 py-10 text-center text-sm uppercase text-slate-500">LOADING CATEGORIES...</td></tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr><td colSpan={7} className="bg-white px-5 py-10 text-center text-sm uppercase text-slate-500">NO LEAVE CATEGORIES FOUND.</td></tr>
                  ) : filteredCategories.map((category, index) => (
                    <tr key={category.id} className="bg-white text-sm uppercase text-slate-700 even:bg-[#f9fafc] hover:bg-slate-50/70">
                      <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-500">{index + 1}</td>
                      <td className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-700">{category.code}</td>
                      <td className="border-b border-slate-200 px-5 py-4">{category.name}</td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase ${category.paymentType === "PAID" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          {category.paymentType}
                        </span>
                      </td>
                      <td className="max-w-75 border-b border-slate-200 px-5 py-4 text-slate-500">{category.description || "—"}</td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase ${category.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {category.status}
                        </span>
                      </td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <CategoryRowActions
                          onView={() => openDialog("view", category)}
                          onEdit={() => openDialog("edit", category)}
                          onDelete={() => void handleDelete(category)}
                          isDeleteDisabled={category.status === "INACTIVE"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 bg-[#f8fafc] px-5 py-4 text-sm uppercase text-slate-500">
              SHOWING {filteredCategories.length} OF {categories.length} CATEGORIES
            </div>
          </section>
        </div>
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-[1px] uppercase" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" className="my-auto w-full max-w-160 rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
            <form onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 id="category-dialog-title" className="text-xl font-bold uppercase text-slate-800">
                    {mode === "create" ? "CREATE LEAVE CATEGORY" : mode === "edit" ? "EDIT LEAVE CATEGORY" : "LEAVE CATEGORY DETAILS"}
                  </h2>
                  <p className="mt-1 text-sm uppercase text-slate-500">{mode === "view" ? "CATEGORY CONFIGURATION" : "ENTER THE CATEGORY DETAILS BELOW."}</p>
                </div>
                <button type="button" onClick={closeDialog} className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog"><X size={20} /></button>
              </div>

              <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-sm font-medium uppercase text-slate-700">CATEGORY NAME <span className="text-red-500">*</span></span>
                  <input
                    required
                    maxLength={80}
                    value={form.name}
                    readOnly={mode === "view"}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value.toUpperCase() }))}
                    placeholder="SFS"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-sm font-medium uppercase text-slate-700">CATEGORY CODE <span className="text-red-500">*</span></span>
                  <input
                    required
                    maxLength={12}
                    value={form.code}
                    readOnly={mode === "view"}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s/g, "") }))}
                    placeholder="SFS"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block text-sm font-medium uppercase text-slate-700">PAYMENT TYPE</span>
                  <div className="relative">
                    <select
                      value={form.paymentType}
                      disabled={mode === "view"}
                      onChange={(event) => setForm((current) => ({ ...current, paymentType: event.target.value.toUpperCase() as LeaveCategoryForm["paymentType"] }))}
                      className="w-full appearance-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 pr-9 text-sm uppercase text-slate-700 outline-none transition focus:border-blue-300 disabled:text-slate-500"
                    >
                      <option value="PAID">PAID</option>
                      <option value="UNPAID">UNPAID</option>
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </label>

                <label className="space-y-1.5">
                  <span className="block text-sm font-medium uppercase text-slate-700">STATUS</span>
                  <div className="relative">
                    <select
                      value={form.status}
                      disabled={mode === "view"}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value.toUpperCase() as LeaveCategoryForm["status"] }))}
                      className="w-full appearance-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 pr-9 text-sm uppercase text-slate-700 outline-none transition focus:border-blue-300 disabled:text-slate-500"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="block text-sm font-medium uppercase text-slate-700">DESCRIPTION</span>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={form.description}
                    readOnly={mode === "view"}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value.toUpperCase() }))}
                    placeholder="ADD A SHORT DESCRIPTION"
                    className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500"
                  />
                </label>
                {error && <p role="alert" className="text-sm uppercase text-red-700 sm:col-span-2">{error}</p>}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 uppercase sm:flex-row sm:justify-end">
                <button type="button" onClick={closeDialog} disabled={isSaving} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium uppercase text-slate-700 hover:bg-slate-50 disabled:opacity-50">{mode === "view" ? "CLOSE" : "CANCEL"}</button>
                {mode !== "view" && <button type="submit" disabled={isSaving} className="rounded-xl bg-[#2f5fbb] px-5 py-2.5 text-sm font-semibold uppercase text-white hover:bg-[#294f9c] disabled:cursor-wait disabled:opacity-60">{isSaving ? "SAVING..." : "SAVE"}</button>}
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}