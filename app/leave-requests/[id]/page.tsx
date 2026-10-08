"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

const MIN_EFFECTIVE_FROM = "2000-01-01";
const MAX_EFFECTIVE_FROM = "2100-12-31";

function sanitizeDateInput(value: string): string {
  if (!value) return "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  if (parsed < new Date(`${MIN_EFFECTIVE_FROM}T00:00:00.000Z`)) {
    return "";
  }

  if (parsed > new Date(`${MAX_EFFECTIVE_FROM}T00:00:00.000Z`)) {
    return "";
  }

  return value;
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

type LeaveGroup = {
  id: number;
  code: string;
  name: string;
  leaveTypes: string[];
  categoryId: string;
  effectiveFrom: string;
  status: "Active" | "Inactive";
  isUsed?: boolean;
};

type LeaveCategoryOption = {
  id: number;
  name: string;
};

export default function LeaveRequestDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = Number(params?.id ?? 0);
  const isViewMode = searchParams.get("mode") === "view";

  const [leaveGroup, setLeaveGroup] = useState<LeaveGroup | null>(null);
  const [form, setForm] = useState<LeaveGroup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [leaveCategoryOptions, setLeaveCategoryOptions] = useState<LeaveCategoryOption[]>([]);

  useEffect(() => {
    const loadLeaveGroup = async () => {
      if (!id) {
        setLeaveGroup(null);
        setForm(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/leave-requests/${id}`);
        if (!response.ok) {
          setLeaveGroup(null);
          setForm(null);
          return;
        }

        const json = await response.json();
        const item = json?.data;
        if (!item) {
          setLeaveGroup(null);
          setForm(null);
          return;
        }

        const mappedGroup: LeaveGroup = {
          id: Number(item.id),
          code: String(item.code ?? ""),
          name: String(item.name ?? ""),
          leaveTypes: Array.isArray(item.items)
            ? item.items
              .filter((entry: { leaveType?: { code?: string | null; status?: string } | null }) => entry.leaveType?.status === "ACTIVE")
              .map((entry: { leaveType?: { code?: string | null; status?: string } | null }) => entry.leaveType?.code ?? "")
            : [],
          categoryId: String(item.categoryId ?? ""),
          effectiveFrom: new Date(item.effectiveFrom).toISOString().split("T")[0],
          status: item.status === "ACTIVE" ? "Active" : "Inactive",
        };

        setLeaveGroup(mappedGroup);
        setForm(mappedGroup);
      } catch (error) {
        console.error("Failed to load leave group details", error);
        setLeaveGroup(null);
        setForm(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadLeaveGroup();
  }, [id]);

  useEffect(() => {
    const loadLeaveTypeOptions = async () => {
      try {
        const response = await fetch("/api/leave-types?status=ACTIVE");
        if (!response.ok) {
          setLeaveTypeOptions([]);
          return;
        }

        const json = await response.json();
        const items = Array.isArray(json) ? json : [];
        setLeaveTypeOptions(
          items.map((item: { code?: string | null; name?: string | null }) => ({
            value: String(item.code ?? ""),
            label: `${item.code ?? ""} - ${item.name ?? ""}`,
          }))
        );
      } catch (error) {
        console.error("Failed to load leave type options", error);
        setLeaveTypeOptions([]);
      }
    };

    loadLeaveTypeOptions();
  }, []);

  useEffect(() => {
    const loadLeaveCategoryOptions = async () => {
      try {
        const response = await fetch("/api/leave-categories");
        if (!response.ok) {
          setLeaveCategoryOptions([]);
          return;
        }

        const json = await response.json();
        const items = Array.isArray(json?.data) ? json.data : [];
        setLeaveCategoryOptions(items.map((item: { id?: number; name?: string }) => ({
          id: Number(item.id),
          name: String(item.name ?? ""),
        })));
      } catch (error) {
        console.error("Failed to load leave category options", error);
        setLeaveCategoryOptions([]);
      }
    };

    loadLeaveCategoryOptions();
  }, []);

  const handleChange = <K extends keyof LeaveGroup>(field: K, value: LeaveGroup[K]) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!form || !leaveGroup) return;

    const response = await fetch(`/api/leave-requests/${form.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        description: "",
        leaveTypeCodes: form.leaveTypes,
        categoryId: Number(form.categoryId),
        effectiveFrom: form.effectiveFrom,
        status: form.status.toUpperCase(),
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error(error?.error ?? "Failed to update leave group");
      return;
    }

    router.push("/leave-requests");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm">
          Loading leave group...
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-[#edf2f7] p-4 text-slate-800 uppercase">
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
            <LeaveTypeMultiSelect
              values={form.leaveTypes}
              options={leaveTypeOptions}
              disabled={isViewMode}
              onChange={(nextValues) => handleChange("leaveTypes", nextValues)}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Leave category</span>
            <select
              value={form.categoryId}
              disabled={isViewMode}
              required
              onChange={(event) => handleChange("categoryId", event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <option value="">Select category name</option>
              {leaveCategoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Effective from</span>
            <input
              type="date"
              min={MIN_EFFECTIVE_FROM}
              max={MAX_EFFECTIVE_FROM}
              value={form.effectiveFrom}
              readOnly={isViewMode}
              disabled={isViewMode}
              onChange={(event) => {
                const nextValue = sanitizeDateInput(event.target.value);
                if (nextValue) {
                  handleChange("effectiveFrom", nextValue);
                }
              }}
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
