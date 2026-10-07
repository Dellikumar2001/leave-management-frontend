"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

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

export default function LeaveTypeDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params?.id ?? 0);
  const isViewMode = searchParams.get("mode") === "view";

  const [leaveType, setLeaveType] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<LeaveType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/leave-types/${id}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load the leave type.");
        return result as LeaveType;
      })
      .then((record) => {
        if (!isMounted) return;
        setLeaveType(record);
        setForm(record);
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "Unable to load the leave type.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleChange = <K extends keyof LeaveType>(field: K, value: LeaveType[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!form || !leaveType) return;
    if (
      !form.code.trim() ||
      !form.name.trim() ||
      !form.leaveGroup.trim() ||
      !form.status ||
      !Number.isSafeInteger(form.daysAllowed) ||
      form.daysAllowed < 1
    ) return;

    setError("");
    try {
      const response = await fetch(`/api/leave-types/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update the leave type.");
      router.push("/leave-type");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update the leave type.");
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-500">Loading leave type...</div>;
  }

  if (!leaveType || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-800">Leave type not found</h1>
          <p role="alert" className="mt-2 text-sm text-slate-500">{error || "The selected leave type does not exist or was removed."}</p>
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
              {isViewMode ? "LEAVE TYPE DETAILS" : "EDIT LEAVE TYPE"}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{leaveType.name}</h1>
          </div>

          <button
            type="button"
            onClick={() => router.push("/leave-type")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            BACK
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
        {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">{error}</p>}
        <div className="grid gap-6 p-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">LEAVE TYPE CODE <span className="text-red-600">*</span></span>
            <input required={!isViewMode} value={form.code} readOnly={isViewMode} disabled={isViewMode} onChange={(e) => handleChange("code", e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">LEAVE TYPE NAME <span className="text-red-600">*</span></span>
            <input required={!isViewMode} value={form.name} readOnly={isViewMode} disabled={isViewMode} onChange={(e) => handleChange("name", e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">LEAVE GROUP <span className="text-red-600">*</span></span>
            <input required={!isViewMode} value={form.leaveGroup} readOnly={isViewMode} disabled={isViewMode} onChange={(e) => handleChange("leaveGroup", e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">DAYS ALLOWED <span className="text-red-600">*</span></span>
            <input required={!isViewMode} type="number" min={1} step={1} value={form.daysAllowed || ""} readOnly={isViewMode} disabled={isViewMode} onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "e", "E", "+", "-", ".", ","].includes(event.key)) event.preventDefault(); }} onChange={(e) => handleChange("daysAllowed", e.target.value === "" ? 0 : Number(e.target.value))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" style={{ appearance: "textfield" }} />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">DESCRIPTION</span>
            <textarea rows={4} value={form.description} readOnly={isViewMode} disabled={isViewMode} onChange={(e) => handleChange("description", e.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">STATUS <span className="text-red-600">*</span></span>
            <select required={!isViewMode} value={form.status} disabled={isViewMode} onChange={(e) => handleChange("status", e.target.value as LeaveType["status"])} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500">
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={() => router.push("/leave-type")} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {isViewMode ? "BACK TO LIST" : "CANCEL"}
          </button>

          {!isViewMode && (
            <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Save size={16} />
              SAVE CHANGES
            </button>
          )}
        </div>
        </form>
      </div>
    </div>
  );
}
