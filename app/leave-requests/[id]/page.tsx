"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

const STORAGE_KEY = "leave-group-list";

type LeaveGroup = {
  id: number;
  code: string;
  name: string;
  leaveTypes: string[];
  effectiveFrom: string;
  status: "Active" | "Inactive";
  isUsed?: boolean;
};

const initialGroups: LeaveGroup[] = [
  {
    id: 1,
    code: "GEN",
    name: "General Leave",
    leaveTypes: ["CL", "AL", "EL"],
    effectiveFrom: "2024-01-01",
    status: "Active",
    isUsed: true,
  },
  {
    id: 2,
    code: "MED",
    name: "Medical Leave",
    leaveTypes: ["ML", "SL"],
    effectiveFrom: "2024-01-01",
    status: "Active",
    isUsed: false,
  },
  {
    id: 3,
    code: "UNP",
    name: "Unpaid Leave",
    leaveTypes: ["LOP"],
    effectiveFrom: "2024-01-01",
    status: "Active",
    isUsed: true,
  },
  {
    id: 4,
    code: "SPE",
    name: "Special Leave",
    leaveTypes: ["PL", "CO"],
    effectiveFrom: "2024-01-01",
    status: "Active",
    isUsed: false,
  },
];

export default function LeaveRequestDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params?.id ?? 0);
  const isViewMode = searchParams.get("mode") === "view";

  const leaveGroup = useMemo(() => {
    if (typeof window === "undefined") return initialGroups.find((item) => item.id === id) ?? null;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? (JSON.parse(saved) as LeaveGroup[]) : initialGroups;
      return Array.isArray(parsed)
        ? (parsed.find((item) => item.id === id) ?? null)
        : (initialGroups.find((item) => item.id === id) ?? null);
    } catch {
      return initialGroups.find((item) => item.id === id) ?? null;
    }
  }, [id]);

  const [form, setForm] = useState<LeaveGroup | null>(leaveGroup ?? null);

  const handleChange = <K extends keyof LeaveGroup>(field: K, value: LeaveGroup[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = () => {
    if (!form || !leaveGroup || typeof window === "undefined") return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    const currentList = saved ? (JSON.parse(saved) as LeaveGroup[]) : initialGroups;
    const updatedList = currentList.map((item) => (item.id === form.id ? form : item));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    router.push("/leave-requests");
  };

  if (!leaveGroup || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-800">Leave group not found</h1>
          <p className="mt-2 text-sm text-slate-500">The selected leave group does not exist or was removed.</p>
          <button
            type="button"
            onClick={() => router.push("/leave-requests")}
            className="mt-6 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to leave groups
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
              {isViewMode ? "Leave group details" : "Edit leave group"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{leaveGroup.name}</h1>
          </div>

          <button
            type="button"
            onClick={() => router.push("/leave-requests")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Group code</span>
            <input
              value={form.code}
              readOnly={isViewMode}
              disabled={isViewMode}
              onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Group name</span>
            <input
              value={form.name}
              readOnly={isViewMode}
              disabled={isViewMode}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Leave types</span>
            <input
              value={form.leaveTypes.join(", ")}
              readOnly={isViewMode}
              disabled={isViewMode}
              onChange={(e) =>
                handleChange(
                  "leaveTypes",
                  e.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                )
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Effective from</span>
            <input
              type="date"
              value={form.effectiveFrom}
              readOnly={isViewMode}
              disabled={isViewMode}
              onChange={(e) => handleChange("effectiveFrom", e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={form.status}
              disabled={isViewMode}
              onChange={(e) => handleChange("status", e.target.value as LeaveGroup["status"])}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={() => router.push("/leave-requests")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {isViewMode ? "Back to list" : "Cancel"}
          </button>

          {!isViewMode && (
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Save size={16} />
              Save changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
