"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

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

const initialLeaveTypes: LeaveType[] = [
  { id: 1, code: "CL", name: "Casual Leave", category: "Casual", days: 7, description: "Short-duration leave for personal and emergency needs.", status: "Active", isUsed: true },
  { id: 2, code: "AL", name: "Annual Leave", category: "Annual", days: 15, description: "Paid annual leave accrued as part of the yearly leave cycle.", status: "Active", isUsed: true },
  { id: 3, code: "ML", name: "Medical Leave", category: "Medical", days: 10, description: "Leave provided for illness and treatment-related absences.", status: "Active", isUsed: false },
  { id: 4, code: "EL", name: "Earned Leave", category: "Annual", days: 12, description: "Leave accumulated based on service duration and eligibility.", status: "Inactive", isUsed: false },
];

const categoryOptions: LeaveType["category"][] = ["Annual", "Medical", "Casual", "Emergency", "Special"];

export default function LeaveTypeDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params?.id ?? 0);
  const isViewMode = searchParams.get("mode") === "view";

  const leaveType = useMemo(() => {
    if (typeof window === "undefined") return initialLeaveTypes.find((item) => item.id === id) ?? null;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as LeaveType[]) : initialLeaveTypes;
      return Array.isArray(parsed)
        ? (parsed.find((item) => item.id === id) ?? null)
        : (initialLeaveTypes.find((item) => item.id === id) ?? null);
    } catch {
      return initialLeaveTypes.find((item) => item.id === id) ?? null;
    }
  }, [id]);

  const [form, setForm] = useState<LeaveType | null>(leaveType ?? null);

  const handleChange = <K extends keyof LeaveType>(field: K, value: LeaveType[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = () => {
    if (!form || !leaveType || typeof window === "undefined") return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    const currentList = saved ? (JSON.parse(saved) as LeaveType[]) : initialLeaveTypes;
    const updatedList = currentList.map((item) => (item.id === form.id ? form : item));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    router.push("/leave-type");
  };

  if (!leaveType || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-800">Leave type not found</h1>
          <p className="mt-2 text-sm text-slate-500">The selected leave type does not exist or was removed.</p>
          <button
            type="button"
            onClick={() => router.push("/leave-type")}
            className="mt-6 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to leave types
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#edf2f7] p-4 text-slate-800">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {isViewMode ? "Leave type details" : "Edit leave type"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{leaveType.name}</h1>
          </div>

          <button
            type="button"
            onClick={() => router.push("/leave-type")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Code</span>
            <input value={form.code} readOnly={isViewMode} disabled={isViewMode} onChange={(e) => handleChange("code", e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Leave name</span>
            <input value={form.name} readOnly={isViewMode} disabled={isViewMode} onChange={(e) => handleChange("name", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Category</span>
            <select value={form.category} disabled={isViewMode} onChange={(e) => handleChange("category", e.target.value as LeaveType["category"])} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500">
              {categoryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Days</span>
            <input type="number" min={1} value={form.days} readOnly={isViewMode} disabled={isViewMode} onChange={(e) => handleChange("days", Number(e.target.value) || 1)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea rows={4} value={form.description} readOnly={isViewMode} disabled={isViewMode} onChange={(e) => handleChange("description", e.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select value={form.status} disabled={isViewMode} onChange={(e) => handleChange("status", e.target.value as LeaveType["status"])} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={() => router.push("/leave-type")} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {isViewMode ? "Back to list" : "Cancel"}
          </button>

          {!isViewMode && (
            <button type="button" onClick={handleSave} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Save size={16} />
              Save changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
