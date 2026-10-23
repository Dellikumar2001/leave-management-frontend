"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Save, Search, X } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type Eligibility = {
  id: number;
  eligibilityName: string;
  description: string;
  employeeType: string;
  employmentType: string;
  managementStream: string;
  leaveGroup: string;
  status: "ACTIVE" | "INACTIVE";
};

type LeaveGroupOption = {
  id: number;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

type EligibilityForm = Omit<Eligibility, "id" | "status">;

const emptyForm: EligibilityForm = {
  eligibilityName: "",
  description: "",
  employeeType: "",
  employmentType: "",
  managementStream: "",
  leaveGroup: "",
};

const inputClassName =
  "h-[46px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm uppercase text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white";
const selectClassName =
  "h-[46px] w-full appearance-none rounded-xl border border-slate-300 bg-slate-50 px-3.5 pr-10 text-sm uppercase text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white";

export default function CreateEligibilityPage() {
  const [eligibilities, setEligibilities] = useState<Eligibility[]>([]);
  const [leaveGroups, setLeaveGroups] = useState<LeaveGroupOption[]>([]);
  const [form, setForm] = useState<EligibilityForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLeaveGroups, setIsLoadingLeaveGroups] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");

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
    fetch("/api/eligibility")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load leave eligibility.");
        return result as Eligibility[];
      })
      .then((records) => {
        if (isMounted) setEligibilities(records);
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "Unable to load leave eligibility.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    // Also fetch active leave groups for the dropdown
    fetch("/api/leave-requests")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && Array.isArray(json?.data)) {
          const names = json.data
            .filter((g: { status?: string }) => g.status === "ACTIVE")
            .map((g: { name?: string }) => String(g.name ?? "").toUpperCase())
            .filter(Boolean);
          if (names.length > 0) {
            setLeaveGroupOptions(names);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingLeaveGroups(true);
    fetch("/api/leave-requests")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load leave groups.");
        if (!Array.isArray(result?.data)) throw new Error("Unable to load leave groups.");
        return result.data;
      })
      .then((groups) => {
        if (isMounted) {
          setLeaveGroups(
            groups.map((group: { id: number; code?: string; name?: string; status?: string }) => ({
              id: group.id,
              code: String(group.code ?? "").toUpperCase(),
              name: String(group.name ?? "").toUpperCase(),
              status: group.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
            }))
          );
        }
      })
      .catch((loadError: unknown) => {
        console.error("Failed to load leave groups:", loadError);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLeaveGroups(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEligibilities = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return eligibilities;
    return eligibilities.filter((item) =>
      [item.eligibilityName, item.description, item.employeeType, item.employmentType, item.managementStream, item.leaveGroup]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [eligibilities, search]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eligibilityName: form.eligibilityName.trim().toUpperCase(),
          description: form.description.trim().toUpperCase(),
          employeeType: form.employeeType.trim().toUpperCase(),
          employmentType: form.employmentType.trim().toUpperCase(),
          managementStream: form.managementStream.trim().toUpperCase(),
          leaveGroup: form.leaveGroup.trim().toUpperCase(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save leave eligibility.");
      setEligibilities((previous) => [result as Eligibility, ...previous]);
      setForm(emptyForm);
      setIsModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save leave eligibility.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="create-eligibility" />
      <div className="p-4 min-[801px]:ml-[175px] uppercase">
        <div className="mx-auto max-w-[1400px]">
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">CREATE LEAVE ELIGIBILITY</h1>
          </header>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  type="search"
                  placeholder="SEARCH ELIGIBILITY..."
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm uppercase text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setForm(emptyForm);
                  setIsModalOpen(true);
                }}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2f5fbb] px-5 text-sm font-medium uppercase text-white transition-colors hover:bg-[#294f9c]"
              >
                <Plus size={16} />
                CREATE LEAVE ELIGIBILITY  
              </button>
            </div>
          </div>

          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {error && !isModalOpen && (
              <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm uppercase text-red-700">
                {error}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-[#f8fafc] text-xs font-semibold uppercase text-slate-600 sm:text-sm">
                    <th className="border-b border-slate-200 px-5 py-4">SNO</th>
                    <th className="border-b border-slate-200 px-5 py-4">ELIGIBILITY NAME</th>
                    <th className="border-b border-slate-200 px-5 py-4">DESCRIPTION</th>
                    <th className="border-b border-slate-200 px-5 py-4">EMPLOYEE TYPE</th>
                    <th className="border-b border-slate-200 px-5 py-4">EMPLOYMENT TYPE</th>
                    <th className="border-b border-slate-200 px-5 py-4">MANAGEMENT STREAM</th>
                    <th className="border-b border-slate-200 px-5 py-4">LEAVE GROUP</th>
                    <th className="border-b border-slate-200 px-5 py-4">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="bg-white px-5 py-10 text-center text-sm uppercase text-slate-500">
                        LOADING ELIGIBILITY...
                      </td>
                    </tr>
                  ) : filteredEligibilities.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="bg-white px-5 py-10 text-center text-sm uppercase text-slate-500">
                        {search ? "NO ELIGIBILITY RECORDS MATCH YOUR SEARCH." : "NO LEAVE ELIGIBILITY RECORDS YET."}
                      </td>
                    </tr>
                  ) : (
                    filteredEligibilities.map((item, index) => (
                      <tr key={item.id} className="bg-white text-sm text-slate-700 even:bg-[#f9fafc] hover:bg-slate-50/70">
                        <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-500">{index + 1}</td>
                        <td className="border-b border-slate-200 px-5 py-4 font-semibold uppercase text-slate-800">
                          {item.eligibilityName}
                        </td>
                        <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.description || "-"}</td>
                        <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.employeeType}</td>
                        <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.employmentType}</td>
                        <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.managementStream || "-"}</td>
                        <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.leaveGroup}</td>
                        <td className="border-b border-slate-200 px-5 py-4">
                          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase text-emerald-700">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-[#f8fafc] px-5 py-4 text-sm uppercase text-slate-500">
              <div>
                SHOWING 1 TO {filteredEligibilities.length} OF {eligibilities.length} ENTRIES
              </div>
            </div>
          </section>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-[1px] overscroll-contain">
          <form onSubmit={handleSubmit} className="my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)] overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-[22px] font-bold uppercase text-slate-800">CREATE LEAVE ELIGIBILITY</h2>
                <p className="mt-1 text-sm uppercase text-slate-500">ENTER THE ELIGIBILITY DETAILS BELOW.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <p role="alert" className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm uppercase text-red-700">
                {error}
              </p>
            )}

            <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
              <div>
                <label htmlFor="eligibilityName" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                  ELIGIBILITY NAME <span className="text-red-500">*</span>
                </label>
                <input
                  id="eligibilityName"
                  required
                  maxLength={120}
                  placeholder="ACADEMIC FACULTY ELIGIBILITY"
                  value={form.eligibilityName}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, eligibilityName: event.target.value.toUpperCase() }))
                  }
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                  DESCRIPTION
                </label>
                <input
                  id="description"
                  maxLength={500}
                  placeholder="ELIGIBILITY CRITERIA DESCRIPTION"
                  value={form.description}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, description: event.target.value.toUpperCase() }))
                  }
                  className={inputClassName}
                />
              </div>

              <div>
                <label htmlFor="employeeType" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                  EMPLOYEE TYPE <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="employeeType"
                    required
                    value={form.employeeType}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, employeeType: event.target.value.toUpperCase() }))
                    }
                    className={selectClassName}
                  >
                    <option value="">SELECT EMPLOYEE TYPE</option>
                    <option value="TEACHING">TEACHING</option>
                    <option value="NON-TEACHING">NON-TEACHING</option>
                    <option value="STUDENT">STUDENT</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="employmentType" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                  EMPLOYMENT TYPE <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="employmentType"
                    required
                    value={form.employmentType}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, employmentType: event.target.value.toUpperCase() }))
                    }
                    className={selectClassName}
                  >
                    <option value="">SELECT EMPLOYMENT TYPE</option>
                    <option value="PERMANENT">PERMANENT</option>
                    <option value="CONTRACT">CONTRACT</option>
                    <option value="TEMPORARY">TEMPORARY</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="managementStream" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">
                  MANAGEMENT STREAM
                </label>
                <div className="relative">
                  <select
                    id="managementStream"
                    value={form.managementStream}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, managementStream: event.target.value.toUpperCase() }))
                    }
                    className={selectClassName}
                  >
                    <option value="">SELECT STREAM</option>
                    <option value="ALL">ALL</option>
                    <option value="ACADEMIC">ACADEMIC</option>
                    <option value="ADMINISTRATION">ADMINISTRATION</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="leaveGroup" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">Leave group <span className="text-red-500">*</span></label>
                <select
                  id="leaveGroup"
                  required
                  value={form.leaveGroup}
                  onChange={(event) => setForm((previous) => ({ ...previous, leaveGroup: event.target.value.toUpperCase() }))}
                  className={inputClassName}
                >
                  <option value="">{isLoadingLeaveGroups ? "LOADING LEAVE GROUPS..." : "SELECT LEAVE GROUP"}</option>
                  {form.leaveGroup && !leaveGroups.some((group) => group.name === form.leaveGroup) && (
                    <option value={form.leaveGroup}>{form.leaveGroup}</option>
                  )}
                  {leaveGroups.map((group) => (
                    <option key={group.id} value={group.name} disabled={group.status !== "ACTIVE"}>
                      {group.name}{group.code ? ` (${group.code})` : ""}{group.status !== "ACTIVE" ? " - INACTIVE" : ""}
                    </option>
                  ))}
                </select>
                {leaveGroups.length === 0 && !isLoadingLeaveGroups && (
                  <p className="mt-1.5 text-xs uppercase text-slate-500">No leave groups found. Please create a leave group first.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 uppercase">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-10 rounded-xl border border-slate-300 px-5 text-sm font-medium uppercase text-slate-700 transition hover:bg-slate-50"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2f5fbb] px-5 text-sm font-medium uppercase text-white transition-colors hover:bg-[#294f9c] disabled:cursor-wait disabled:opacity-60"
              >
                <Save size={16} />
                {isSaving ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}