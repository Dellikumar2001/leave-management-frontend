"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, X } from "lucide-react";
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

type EligibilityForm = Omit<Eligibility, "id" | "status">;

const emptyForm: EligibilityForm = {
  eligibilityName: "",
  description: "",
  employeeType: "",
  employmentType: "",
  managementStream: "",
  leaveGroup: "",
};

const inputClassName = "h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm uppercase text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white";

export default function CreateEligibilityPage() {
  const [eligibilities, setEligibilities] = useState<Eligibility[]>([]);
  const [form, setForm] = useState<EligibilityForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");

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
    <main className="min-h-screen bg-[#e9edf3] p-4 text-slate-800">
      <LeaveSidebar activePage="create-eligibility" />
      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px] uppercase">
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">Create Leave Eligibility</h1>
          </header>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value.toUpperCase())}
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
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2f5fbb] px-5 text-sm font-medium text-white transition-colors hover:bg-[#294f9c]"
              >
                <Plus size={16} />
                Add Eligibility
              </button>
            </div>
          </div>

          <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {error && !isModalOpen && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm uppercase text-red-700">{error}</p>}
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-[#f8fafc] text-xs font-semibold uppercase text-slate-600 sm:text-sm">
                    <th className="border-b border-slate-200 px-5 py-4">Sno</th>
                    <th className="border-b border-slate-200 px-5 py-4">Eligibility Name</th>
                    <th className="border-b border-slate-200 px-5 py-4">Description</th>
                    <th className="border-b border-slate-200 px-5 py-4">Employee Type</th>
                    <th className="border-b border-slate-200 px-5 py-4">Employment Type</th>
                    <th className="border-b border-slate-200 px-5 py-4">Management Stream</th>
                    <th className="border-b border-slate-200 px-5 py-4">Leave Group</th>
                    <th className="border-b border-slate-200 px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="bg-white px-5 py-10 text-center text-sm uppercase text-slate-500">Loading eligibility...</td></tr>
                  ) : filteredEligibilities.length === 0 ? (
                    <tr><td colSpan={8} className="bg-white px-5 py-10 text-center text-sm uppercase text-slate-500">{search ? "No eligibility records match your search." : "No leave eligibility records yet."}</td></tr>
                  ) : filteredEligibilities.map((item, index) => (
                    <tr key={item.id} className="bg-white text-sm text-slate-700 even:bg-[#f9fafc] hover:bg-slate-50/70">
                      <td className="border-b border-slate-200 px-5 py-4 font-medium text-slate-500">{index + 1}</td>
                      <td className="border-b border-slate-200 px-5 py-4 font-semibold uppercase text-slate-800">{item.eligibilityName}</td>
                      <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.description || "-"}</td>
                      <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.employeeType}</td>
                      <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.employmentType}</td>
                      <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.managementStream || "-"}</td>
                      <td className="border-b border-slate-200 px-5 py-4 uppercase">{item.leaveGroup}</td>
                      <td className="border-b border-slate-200 px-5 py-4">
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase text-emerald-700">{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 bg-[#f8fafc] px-5 py-4 text-sm uppercase text-slate-500">
              Showing {filteredEligibilities.length} of {eligibilities.length} eligibility records
            </div>
          </section>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-[1px]">
          <form onSubmit={handleSubmit} className="my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-800">Create Leave Eligibility</h2>
                <p className="mt-1 text-sm uppercase text-slate-500">Enter the eligibility details below.</p>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog">
                <X size={20} />
              </button>
            </div>

            {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm uppercase text-red-700">{error}</p>}
            <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
              <div>
                <label htmlFor="eligibilityName" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">Eligibility name <span className="text-red-500">*</span></label>
                <input
                  id="eligibilityName"
                  required
                  maxLength={120}
                  value={form.eligibilityName}
                  onChange={(event) => setForm((previous) => ({ ...previous, eligibilityName: event.target.value.toUpperCase() }))}
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="description" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">Description</label>
                <input
                  id="description"
                  maxLength={500}
                  value={form.description}
                  onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value.toUpperCase() }))}
                  className={inputClassName}
                />
              </div>
              <div>
                <label htmlFor="employeeType" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">Employee type <span className="text-red-500">*</span></label>
                <select
                  id="employeeType"
                  required
                  value={form.employeeType}
                  onChange={(event) => setForm((previous) => ({ ...previous, employeeType: event.target.value.toUpperCase() }))}
                  className={inputClassName}
                >
                  <option value="">SELECT EMPLOYEE TYPE</option>
                  <option value="TEACHING">TEACHING</option>
                  <option value="NON-TEACHING">NON-TEACHING</option>
                  <option value="STUDENT">STUDENT</option>
                </select>
              </div>
              <div>
                <label htmlFor="employmentType" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">Employment type <span className="text-red-500">*</span></label>
                <select
                  id="employmentType"
                  required
                  value={form.employmentType}
                  onChange={(event) => setForm((previous) => ({ ...previous, employmentType: event.target.value.toUpperCase() }))}
                  className={inputClassName}
                >
                  <option value="">SELECT EMPLOYMENT TYPE</option>
                  <option value="PERMANENT">PERMANENT</option>
                  <option value="CONTRACT">CONTRACT</option>
                  <option value="TEMPORARY">TEMPORARY</option>
                </select>
              </div>
              <div>
                <label htmlFor="managementStream" className="mb-1.5 block text-sm font-medium uppercase text-slate-700">Management stream</label>
                <select
                  id="managementStream"
                  value={form.managementStream}
                  onChange={(event) => setForm((previous) => ({ ...previous, managementStream: event.target.value.toUpperCase() }))}
                  className={inputClassName}
                >
                  <option value="">SELECT STREAM</option>
                  <option value="ALL">ALL</option>
                  <option value="ACADEMIC">ACADEMIC</option>
                  <option value="ADMINISTRATION">ADMINISTRATION</option>
                </select>
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
                  <option value="">SELECT LEAVE GROUP</option>
                  <option value="TEACHING STAFF LEAVE GROUP">TEACHING STAFF LEAVE GROUP</option>
                  <option value="NON TEACHING STAFF LEAVE GROUP">NON TEACHING STAFF LEAVE GROUP</option>
                  <option value="GENERAL STAFF LEAVE GROUP">GENERAL STAFF LEAVE GROUP</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 uppercase">
              <button type="button" onClick={() => setIsModalOpen(false)} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#2f5fbb] px-5 text-sm font-medium text-white transition-colors hover:bg-[#294f9c] disabled:cursor-wait disabled:opacity-60">
                <Save size={16} />
                {isSaving ? "Saving..." : "Submit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}