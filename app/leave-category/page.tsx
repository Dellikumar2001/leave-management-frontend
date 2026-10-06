"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Eye, Trash2, X } from "lucide-react";

type LeaveCategory = {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
  description: string;
  status: "Active" | "Inactive";
};

type LeaveCategoryForm = Omit<LeaveCategory, "id">;
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
      <button type="button" onClick={onView} className="p-1.5 text-slate-400 hover:text-slate-700" title="View category" aria-label="View category">
        <Eye size={16} />
      </button>
      <button type="button" onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-700" title="Edit category" aria-label="Edit category">
        <Pencil size={16} />
      </button>
      <button type="button" onClick={() => setOpen((value) => !value)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="More actions">
        <Trash2 size={14} />
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
  isPaid: true,
  description: "",
  status: "Active",
};

const mapCategory = (item: {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
  description?: string | null;
  status: string;
}): LeaveCategory => ({
  id: Number(item.id),
  code: String(item.code),
  name: String(item.name),
  isPaid: Boolean(item.isPaid),
  description: String(item.description ?? ""),
  status: item.status === "ACTIVE" ? "Active" : "Inactive",
});

export default function LeaveCategoryPage() {
  const [categories, setCategories] = useState<LeaveCategory[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
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
    const query = search.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesSearch =
        !query ||
        category.code.toLowerCase().includes(query) ||
        category.name.toLowerCase().includes(query) ||
        category.description.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "All Status" || category.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const openDialog = (nextMode: DialogMode, category?: LeaveCategory) => {
    setMode(nextMode);
    setActiveCategory(category ?? null);
    setForm(category ? {
      code: category.code,
      name: category.name,
      isPaid: category.isPaid,
      description: category.description,
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
      name: form.name.trim(),
      isPaid: form.isPaid,
      description: form.description.trim(),
      status: form.status.toUpperCase(),
    };

    if (!payload.code || !payload.name) {
      setError("Enter a category name and code.");
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
      <div className="mx-auto max-w-350 uppercase">
        <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#f5f7fa] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">

          {/* Search */}
          <div className="relative w-full sm:max-w-90">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
              size={16}
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories..."
              aria-label="Search leave categories"
              className="w-full rounded-xl border border-slate-300 bg-[#f8f9fb] py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300"
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 self-end sm:self-auto">

            {/* Notification */}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
              aria-label="Notifications"
            >
              <span className="relative">
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                >
                  <path
                    d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 20a2 2 0 0 0 4 0"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>

            {/* Profile */}
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
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 sm:text-[38px]">Leave Category</h1>
              <p className="mt-1 text-sm text-slate-500 sm:text-base">Create and manage different leave categories.</p>
            </div>
            <button
              type="button"
              onClick={() => openDialog("create")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f5fbb] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#294f9c]"
            >
              <Plus size={16} />
              Create Category
            </button>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-[#eef2f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">{categories.length} categories</p>
            <label className="relative w-full sm:w-auto">
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm text-slate-700 outline-none focus:border-blue-300 sm:w-auto"
              >
                <option>All Status</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500" aria-hidden="true">⌄</span>
            </label>
          </div>

          {error && !mode && <p role="alert" className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-[#eef2f7] text-xs font-semibold uppercase text-slate-600 sm:text-sm">
                  <th className="border-b border-slate-200 px-5 py-4">Sno</th>
                  <th className="border-b border-slate-200 px-5 py-4">Category Code</th>
                  <th className="border-b border-slate-200 px-5 py-4">Category Name</th>
                  <th className="border-b border-slate-200 px-5 py-4">Payment</th>
                  <th className="border-b border-slate-200 px-5 py-4">Description</th>
                  <th className="border-b border-slate-200 px-5 py-4">Status</th>
                  <th className="border-b border-slate-200 px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="bg-white px-5 py-10 text-center text-sm text-slate-500">Loading categories...</td></tr>
                ) : filteredCategories.length === 0 ? (
                  <tr><td colSpan={7} className="bg-white px-5 py-10 text-center text-sm text-slate-500">No leave categories found.</td></tr>
                ) : filteredCategories.map((category, index) => (
                  <tr key={category.id} className="bg-white text-sm text-slate-700 even:bg-[#f9fafc]">
                    <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-500">{index + 1}</td>
                    <td className="border-b border-slate-200 px-5 py-4 font-semibold text-slate-700">{category.code}</td>
                    <td className="border-b border-slate-200 px-5 py-4">{category.name}</td>
                    <td className="border-b border-slate-200 px-5 py-4">{category.isPaid ? "Paid" : "Unpaid"}</td>
                    <td className="max-w-75 border-b border-slate-200 px-5 py-4 text-slate-500">{category.description || "—"}</td>
                    <td className="border-b border-slate-200 px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${category.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {category.status}
                      </span>
                    </td>
                    <td className="border-b border-slate-200 px-5 py-4">
                      <CategoryRowActions
                        onView={() => openDialog("view", category)}
                        onEdit={() => openDialog("edit", category)}
                        onDelete={() => void handleDelete(category)}
                        isDeleteDisabled={category.status === "Inactive"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 bg-[#eef2f7] px-5 py-4 text-sm text-slate-500">
            Showing {filteredCategories.length} of {categories.length} categories
          </div>
        </section>
      </div>

      {mode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-[1px] uppercase" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" className="my-auto w-full max-w-160 rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
            <form onSubmit={(event) => { event.preventDefault(); void handleSave(); }}>
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 id="category-dialog-title" className="text-xl font-bold text-slate-800">
                    {mode === "create" ? "Create Leave Category" : mode === "edit" ? "Edit Leave Category" : "Leave Category Details"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{mode === "view" ? "Category configuration" : "Enter the category details below."}</p>
                </div>
                <button type="button" onClick={closeDialog} className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog"><X size={20} /></button>
              </div>

              <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-sm font-medium text-slate-700">Category name <span className="text-red-500">*</span></span>
                  <input required maxLength={80} value={form.name} readOnly={mode === "view"} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="SFS" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500" />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-sm font-medium text-slate-700">Category code <span className="text-red-500">*</span></span>
                  <input required maxLength={12} value={form.code} readOnly={mode === "view"} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s/g, "") }))} placeholder="SFS" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500" />
                </label>

                <fieldset className="space-y-2 sm:col-span-2" disabled={mode === "view"}>
                  <legend className="mb-2 text-sm font-medium text-slate-700">Payment type</legend>
                  <div className="flex flex-wrap gap-3">
                    {[{ label: "Paid", value: true }, { label: "Unpaid", value: false }].map((option) => (
                      <label key={option.label} className={`flex min-w-32 cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${form.isPaid === option.value ? "border-blue-300 bg-blue-50 text-blue-800" : "border-slate-300 bg-white text-slate-700"}`}>
                        <input type="radio" name="paymentType" checked={form.isPaid === option.value} onChange={() => setForm((current) => ({ ...current, isPaid: option.value }))} className="h-4 w-4 accent-[#2f5fbb]" />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="space-y-1.5">
                  <span className="block text-sm font-medium text-slate-700">Status</span>
                  <select value={form.status} disabled={mode === "view"} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as LeaveCategoryForm["status"] }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 disabled:text-slate-500">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
                <div aria-hidden="true" className="hidden sm:block" />

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="block text-sm font-medium text-slate-700">Description</span>
                  <textarea rows={4} maxLength={500} value={form.description} readOnly={mode === "view"} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Add a short description" className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-300 read-only:text-slate-500" />
                </label>
                {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeDialog} disabled={isSaving} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{mode === "view" ? "Close" : "Cancel"}</button>
                {mode !== "view" && <button type="submit" disabled={isSaving} className="rounded-xl bg-[#2f5fbb] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#294f9c] disabled:cursor-wait disabled:opacity-60">{isSaving ? "Saving..." : "Save"}</button>}
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}