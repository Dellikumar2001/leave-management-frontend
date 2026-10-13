"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, LoaderCircle, Minus, Plus, Search } from "lucide-react";
import LeaveSidebar from "../LeaveSidebar";
import EmployeeTable, { EmployeeRow } from "./EmployeeTable";
import FilterMultiSelect from "./FilterMultiSelect";
import LeaveRecordDialog, { BlockedDateRecord, CreditRecord } from "./LeaveRecordDialog";

type Mode = "block" | "credit";
type Category = "ANNUAL" | "MEDICAL";
type HistoryAction = "view" | "edit" | "delete";
type HistoryTarget = { employee: EmployeeRow; action: HistoryAction };

function todayInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function formatDate(value: string) {
  const date = parseDate(value.slice(0, 10));
  return date ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium" }).format(date) : "";
}

function totalDays(start: string, end: string) {
  const first = parseDate(start);
  const last = parseDate(end);
  if (!first || !last || last < first) return 0;
  return Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;
}

function employeeGroupLabel(selected: EmployeeRow[], allEmployees: EmployeeRow[]) {
  if (!selected.length) return "";
  const pairs = new Set(selected.map(({ department, stream }) => `${department} - ${stream}`));
  const streams = new Set(selected.map(({ stream }) => stream.toUpperCase()));
  if (pairs.size === 1) return `from ${[...pairs][0]}`;
  if (streams.size === 1) {
    const stream = [...streams][0];
    const streamEmployees = allEmployees.filter((employee) => employee.stream.toUpperCase() === stream);
    if (streamEmployees.length > 0 && streamEmployees.every(({ employeeId }) =>
      selected.some((employee) => employee.employeeId === employeeId)
    )) {
      return `from all ${stream} departments`;
    }
    return "from selected employees";
  }

  const aidedAndSfs = allEmployees.filter(({ stream }) => ["AIDED", "SFS"].includes(stream.toUpperCase()));
  if (
    streams.size === 2 &&
    streams.has("AIDED") &&
    streams.has("SFS") &&
    aidedAndSfs.length > 0 &&
    aidedAndSfs.every(({ employeeId }) => selected.some((employee) => employee.employeeId === employeeId))
  ) {
    return "from all AIDED and SFS departments";
  }
  return "from selected employees";
}

async function readJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  const text = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(text) as unknown;
  } catch {
    throw new Error(text.trim() || `The server returned an empty or invalid response (${response.status}).`);
  }
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Unable to load leave administration data.";
    throw new Error(message);
  }
  return result as T;
}

async function fetchPageData(category: Category) {
  const responses = await Promise.all([
    fetch(`/api/block-leave?category=${category}`, { cache: "no-store" }),
    fetch(`/api/leave-credit?category=${category}`, { cache: "no-store" }),
  ]);
  const [blockData, creditData] = await Promise.all([
    readJson<{
      streams: string[];
      departments: string[];
      employees: EmployeeRow[];
      blockedLeaves: BlockedDateRecord[];
    }>(responses[0]),
    readJson<{ credits: CreditRecord[] }>(responses[1]),
  ]);
  return {
    streams: blockData.streams,
    departments: blockData.departments,
    employees: blockData.employees,
    blockedLeaves: blockData.blockedLeaves,
    credits: creditData.credits,
  };
}

export default function LeaveAdministrationPage({ mode }: { mode: Mode }) {
  const [category, setCategory] = useState<Category>("ANNUAL");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [streams, setStreams] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [blockedLeaves, setBlockedLeaves] = useState<BlockedDateRecord[]>([]);
  const [credits, setCredits] = useState<CreditRecord[]>([]);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(todayInputValue);
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState(0);
  const [counterOpen, setCounterOpen] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  const [historyError, setHistoryError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const data = await fetchPageData(category);
      setError("");
      setStreams(data.streams);
      setDepartments(data.departments);
      setEmployees(data.employees);
      setBlockedLeaves(data.blockedLeaves);
      setCredits(data.credits);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load leave administration data.");
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const data = await fetchPageData(category);
        if (cancelled) return;
        setError("");
        setStreams(data.streams);
        setDepartments(data.departments);
        setEmployees(data.employees);
        setBlockedLeaves(data.blockedLeaves);
        setCredits(data.credits);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leave administration data.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    if (!counterOpen) return;
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !counterRef.current?.contains(event.target)) setCounterOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [counterOpen]);

  const search = employeeSearch.trim().toLowerCase();
  const visibleEmployees = useMemo(() => employees.filter((employee) =>
    (!selectedStreams.length || selectedStreams.includes(employee.stream)) &&
    (!selectedDepartments.length || selectedDepartments.includes(employee.department)) &&
    (!search || employee.name.toLowerCase().includes(search) || employee.employeeId.toLowerCase().includes(search))
  ), [employees, search, selectedDepartments, selectedStreams]);
  const showEmployees = selectedStreams.length > 0 || selectedDepartments.length > 0 || search.length > 0;
  const selectedEmployees = employees.filter(({ employeeId }) => selectedEmployeeIds.includes(employeeId));
  const daysToBlock = totalDays(startDate, endDate || startDate);
  const canSubmit = selectedEmployeeIds.length > 0 && (mode === "block" ? daysToBlock > 0 : days > 0);
  const showSummary = selectedEmployees.length > 0 && (mode === "credit" || daysToBlock > 0);
  const groupLabel = employeeGroupLabel(selectedEmployees, employees);
  const summary = mode === "block"
    ? `${daysToBlock} day${daysToBlock === 1 ? "" : "s"}, from ${formatDate(startDate)} to ${formatDate(endDate || startDate)}, will be blocked for ${selectedEmployees.length} employee${selectedEmployees.length === 1 ? "" : "s"} (${groupLabel}).`
    : `${days} day${days === 1 ? "" : "s"} will be credited for ${selectedEmployees.length} employee${selectedEmployees.length === 1 ? "" : "s"} (${groupLabel}).`;
  const employeeRows = useMemo(() => visibleEmployees.map((employee) => ({
    ...employee,
    blockedLeaveCount: blockedLeaves.filter((item) => item.employeeId === employee.employeeId).length,
    creditCount: credits.filter((item) => item.employeeId === employee.employeeId).length,
  })), [blockedLeaves, credits, visibleEmployees]);
  const historyRecords = historyTarget
    ? mode === "block"
      ? blockedLeaves.filter((record) => record.employeeId === historyTarget.employee.employeeId)
      : credits.filter((record) => record.employeeId === historyTarget.employee.employeeId)
    : [];

  const handleAction = async () => {
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch(mode === "block" ? "/api/block-leave" : "/api/leave-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "block"
          ? { employeeIds: selectedEmployeeIds, startDate, endDate: endDate || startDate }
          : { employeeIds: selectedEmployeeIds, credit: { category, days } }),
      });
      const result = await readJson<{ blockedCount: number; creditedCount: number }>(response);
      setSuccess(mode === "block"
        ? `Blocked leave dates for ${result.blockedCount} employee-date record${result.blockedCount === 1 ? "" : "s"}.`
        : `Credited leave for ${result.creditedCount} employee${result.creditedCount === 1 ? "" : "s"}.`);
      setSelectedEmployeeIds([]);
      setConfirmOpen(false);
      setIsLoading(true);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save leave administration changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const manageRecord = async (method: "PATCH" | "DELETE", body: object) => {
    setIsSaving(true);
    setHistoryError("");
    try {
      const response = await fetch(mode === "block" ? "/api/block-leave" : "/api/leave-credit", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = await readJson<{ error?: string }>(response);
        throw new Error(result.error ?? "Unable to update the leave record.");
      }
      setHistoryTarget(null);
      setIsLoading(true);
      await loadData();
    } catch (saveError) {
      setHistoryError(saveError instanceof Error ? saveError.message : "Unable to update the leave record.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((current) => current.includes(employeeId)
      ? current.filter((id) => id !== employeeId)
      : [...current, employeeId]);
  };

  const toggleVisibleEmployees = () => {
    const shownIds = employeeRows.map(({ employeeId }) => employeeId);
    const allSelected = shownIds.length > 0 && shownIds.every((id) => selectedEmployeeIds.includes(id));
    setSelectedEmployeeIds((current) => allSelected
      ? current.filter((id) => !shownIds.includes(id))
      : [...new Set([...current, ...shownIds])]);
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage={mode === "block" ? "block-leave" : "credit-leave"} />
      <main className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px]">
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Leave Admin</p>
            <h1 className="text-3xl font-bold text-slate-800">{mode === "block" ? "Block Leave" : "Credit Leave"}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "block" ? "Set dates when employees cannot submit leave requests." : "Add available annual or medical leave days to employee balances."}
            </p>
          </header>

          {mode === "credit" && (
            <nav aria-label="Credit leave category" className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              {(["ANNUAL", "MEDICAL"] as const).map((value) => (
                <button key={value} type="button" onClick={() => {
                  if (category === value) return;
                  setCategory(value);
                  setSelectedEmployeeIds([]);
                  setSuccess("");
                  setError("");
                  setIsLoading(true);
                }} aria-current={category === value ? "page" : undefined}
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold ${category === value ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                  Credit {value === "ANNUAL" ? "Annual" : "Medical"} Leave
                </button>
              ))}
            </nav>
          )}

          <section aria-label="Employee filters and leave controls" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${mode === "block"
              ? "xl:grid-cols-[minmax(120px,1fr)_minmax(140px,1.1fr)_minmax(180px,1.35fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_auto]"
              : "xl:grid-cols-[minmax(130px,1fr)_minmax(150px,1.1fr)_minmax(200px,1.5fr)_minmax(160px,1fr)_auto]"}`}>
              <FilterMultiSelect label="Stream" options={streams} selected={selectedStreams} onChange={setSelectedStreams} />
              <FilterMultiSelect label="Department" options={departments} selected={selectedDepartments} onChange={setSelectedDepartments} />
              <label className="block min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Employee</span>
                <span className="relative block">
                  <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    }}
                    placeholder="Search by name or ID"
                    aria-label="Search employee by name or ID"
                    className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
                  />
                </span>
              </label>
              {mode === "block" ? (
                <>
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Set Date</span>
                    <input type="date" value={startDate} onChange={(event) => {
                      setStartDate(event.target.value);
                      if (endDate && endDate < event.target.value) setEndDate(event.target.value);
                    }} aria-label="Set leave block start date" className="h-11 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-emerald-500" />
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">End Date</span>
                    <input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Set leave block end date"
                      className="h-11 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-emerald-500" />
                  </label>
                </>
              ) : (
                <div ref={counterRef} className={`relative min-w-0 ${counterOpen ? "z-30" : ""}`}>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Number of days</span>
                  <button type="button" aria-expanded={counterOpen} onClick={() => setCounterOpen((open) => !open)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === "Escape") {
                        event.preventDefault();
                        setCounterOpen(false);
                      }
                    }}
                    className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 px-3 text-sm hover:border-slate-400">
                    {days} day{days === 1 ? "" : "s"} <ChevronDown size={16} />
                  </button>
                  {counterOpen && (
                    <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" aria-label="Decrease days" onClick={() => setDays((value) => Math.max(0, value - 1))} className="grid size-10 place-items-center rounded-lg border border-slate-300 hover:bg-slate-50"><Minus size={18} /></button>
                        <input type="number" min={0} value={days} aria-label="Credit days" onChange={(event) => setDays(Math.max(0, Number(event.target.value) || 0))}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              setDays((value) => value + 1);
                            } else if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setDays((value) => Math.max(0, value - 1));
                            } else if (event.key === "Enter" || event.key === "Escape") {
                              setCounterOpen(false);
                            }
                          }}
                          className="h-12 w-24 appearance-none rounded-lg border border-slate-300 text-center text-xl font-semibold outline-none focus:border-emerald-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                        <button type="button" aria-label="Increase days" onClick={() => setDays((value) => value + 1)} className="grid size-10 place-items-center rounded-lg border border-slate-300 hover:bg-slate-50"><Plus size={18} /></button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {([["+5 days", 5], ["+10 days", 10], ["+1 week", 7]] as const).map(([label, amount]) => (
                          <button key={label} type="button" onClick={() => setDays((value) => value + amount)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">{label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button type="button" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                <CalendarDays size={16} aria-hidden="true" />{mode === "block" ? "Block Leaves" : "Credit Leave"}
              </button>
            </div>
          </section>

          {showSummary && (
            <p aria-live="polite" className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">{summary}</p>
          )}
          {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
          {isLoading && <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-10 text-sm text-slate-500"><LoaderCircle size={17} className="animate-spin" />Loading leave administration data...</div>}

          {showEmployees && !isLoading && (
            <EmployeeTable
              employees={employeeRows}
              selectedIds={selectedEmployeeIds}
              onToggleEmployee={toggleEmployee}
              onToggleVisible={toggleVisibleEmployees}
              onHistory={(employee, action) => {
                setHistoryError("");
                setHistoryTarget({ employee, action });
              }}
              mode={mode}
            />
          )}
        </div>
      </main>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) setConfirmOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-label={`Confirm ${mode === "block" ? "block leave" : "credit leave"}`} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800">Confirm {mode === "block" ? "block leave" : "credit leave"}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">{summary}</p>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <footer className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" disabled={isSaving} onClick={() => setConfirmOpen(false)} className="h-10 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700">CANCEL</button>
              <button type="button" disabled={isSaving} onClick={() => void handleAction()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                {isSaving && <LoaderCircle size={15} className="animate-spin" />}
                {isSaving ? (mode === "block" ? "BLOCKING..." : "CREDITING...") : (mode === "block" ? "BLOCK LEAVE" : "CREDIT LEAVE")}
              </button>
            </footer>
          </section>
        </div>
      )}

      {historyTarget && (
        <LeaveRecordDialog
          mode={mode}
          action={historyTarget.action}
          category={category}
          employee={historyTarget.employee}
          records={historyRecords}
          error={historyError}
          saving={isSaving}
          onClose={() => setHistoryTarget(null)}
          onSave={(id, value) => manageRecord("PATCH", mode === "block" ? { id, date: value } : { id, days: value })}
          onDelete={(id) => manageRecord("DELETE", { id })}
        />
      )}
    </div>
  );
}
