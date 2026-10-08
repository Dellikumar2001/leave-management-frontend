"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Search, Check, ChevronDown, X } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

/* ─── Types ─────────────────────────────────────────────── */

type LeaveType = {
  code: string;
  daysAllowed: number;
  id: number;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

type EmployeeLeaveRecord = {
  leaveTypeId: number;
  isEligible: boolean;
  daysAllowed: number;
  leaveBalance: number;
};

type Employee = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  leaveRecords: EmployeeLeaveRecord[];
};

type LeaveData = {
  employees: Employee[];
  leaveTypes: LeaveType[];
};

/* ─── Helpers ────────────────────────────────────────────── */

function getEligibilityValue(employee: Employee, leaveType: LeaveType) {
  const record = employee.leaveRecords.find((r) => r.leaveTypeId === leaveType.id);
  if (leaveType.status !== "ACTIVE" || record?.isEligible === false) return "Inactive";
  return `${leaveType.daysAllowed}`;
}

async function fetchData(signal?: AbortSignal): Promise<LeaveData> {
  const response = await fetch("/api/leave-refresh", { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to load data.");
  return result as LeaveData;
}

/* ─── Multi-select Dropdown ──────────────────────────────── */

type MultiSelectProps = {
  id: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
};

function MultiSelect({ id, placeholder, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const removeOption = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus search when opening
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-[180px]">
      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-10 w-full items-center justify-between gap-1 rounded-md border px-3 text-sm transition-colors ${
          open ? "border-blue-400 ring-1 ring-blue-300" : "border-slate-300"
        } bg-white text-slate-700 outline-none`}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 overflow-hidden">
          {selected.length === 0 ? (
            <span className="truncate text-slate-400">{placeholder}</span>
          ) : (
            selected.map((v) => (
              <span
                key={v}
                className="flex max-w-[110px] shrink-0 items-center gap-0.5 truncate rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800"
              >
                <span className="truncate">{v}</span>
                <X
                  size={10}
                  className="shrink-0 cursor-pointer"
                  onClick={(e) => removeOption(v, e)}
                  aria-label={`Remove ${v}`}
                />
              </span>
            ))
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-full rounded-md border border-slate-200 bg-white shadow-lg">
          {/* Inner search */}
          <div className="border-b border-slate-100 px-2 py-1.5">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-2 text-slate-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-6 w-full rounded bg-slate-50 pl-6 pr-2 text-[11px] outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <ul
            role="listbox"
            aria-multiselectable="true"
            className="max-h-52 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-slate-400">No results</li>
            ) : (
              filtered.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <li
                    key={option}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleOption(option)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[12.5px] transition-colors ${
                      isSelected
                        ? "bg-emerald-50 font-medium text-emerald-800"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${
                        isSelected ? "border-emerald-600 bg-emerald-600" : "border-slate-300"
                      }`}
                    >
                      {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{option}</span>
                  </li>
                );
              })
            )}
          </ul>

          {/* Select all / clear */}
          {options.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange([...options])}
                className="text-[11px] font-medium text-emerald-700 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] font-medium text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function LeaveRefreshPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [error, setError] = useState("");
  const [recalcSuccess, setRecalcSuccess] = useState("");

  // ── Filter states
  const [streamFilter, setStreamFilter] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedEmployeeNames, setSelectedEmployeeNames] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // ── Derived option lists (all unique values)
  const allDepartments = [...new Set(employees.map((e) => e.department))].sort();
  const allEmployeeIds = [...new Set(employees.map((e) => e.employeeId))].sort();
  const allEmployeeNames = [...new Set(employees.map((e) => e.name))].sort();

  const leaveTypeColumnCount = Math.max(leaveTypes.length, 1);
  const normalizedSearch = search.trim().toLowerCase();

  // ── Filtered employees (multi-select: if nothing selected = show all)
  const visibleEmployees = employees.filter((emp) => {
    if (streamFilter && emp.stream !== streamFilter) return false;
    if (selectedDepartments.length > 0 && !selectedDepartments.includes(emp.department)) return false;
    if (selectedEmployeeIds.length > 0 && !selectedEmployeeIds.includes(emp.employeeId)) return false;
    if (selectedEmployeeNames.length > 0 && !selectedEmployeeNames.includes(emp.name)) return false;
    if (normalizedSearch && !emp.name.toLowerCase().includes(normalizedSearch) && !emp.employeeId.toLowerCase().includes(normalizedSearch)) return false;
    return true;
  });

  // ── Recalculate is enabled only when at least one employee is visible & selected
  const canRecalculate =
    !isLoading &&
    !isRecalculating &&
    visibleEmployees.length > 0 &&
    (streamFilter !== "" || selectedDepartments.length > 0 || selectedEmployeeIds.length > 0 || selectedEmployeeNames.length > 0);

  // ── Load data
  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError("");
    try {
      const result = await fetchData(signal);
      setEmployees(result.employees);
      setLeaveTypes(result.leaveTypes);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // ── Recalculate handler
  const handleRecalculate = async () => {
    if (!canRecalculate) return;
    setIsRecalculating(true);
    setError("");
    setRecalcSuccess("");
    try {
      const employeeIdsToUpdate = visibleEmployees.map((e) => e.employeeId);
      const response = await fetch("/api/leave-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: employeeIdsToUpdate }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Recalculation failed.");
      const data = result as LeaveData;
      setEmployees(data.employees);
      setLeaveTypes(data.leaveTypes);
      setRecalcSuccess(
        `Successfully recalculated leave balances for ${employeeIdsToUpdate.length} employee${employeeIdsToUpdate.length !== 1 ? "s" : ""}.`,
      );
      setTimeout(() => setRecalcSuccess(""), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Recalculation failed.");
    } finally {
      setIsRecalculating(false);
    }
  };

  // ── Export handler
  const handleExport = () => {
    const rows = [
      [
        "EMPLOYEE ID",
        "EMPLOYEE NAME",
        "STREAM",
        "DEPARTMENT",
        ...leaveTypes.map((lt) => `ELIGIBILITY: ${lt.code}`),
        ...leaveTypes.map((lt) => `BALANCE: ${lt.code}`),
      ],
      ...visibleEmployees.map((emp) => [
        emp.employeeId,
        emp.name,
        emp.stream,
        emp.department,
        ...leaveTypes.map((lt) => getEligibilityValue(emp, lt)),
        ...leaveTypes.map(
          (lt) => emp.leaveRecords.find((r) => r.leaveTypeId === lt.id)?.leaveBalance ?? "N/A",
        ),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "leave-refresh.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="leave-refresh" />
      <div className="p-4 min-[801px]:ml-[175px] uppercase">
        <div className="mx-auto max-w-[1400px]">

          {/* Page header */}
          <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Leave Refresh</h1>
              <p className="mt-1 text-[13px] font-normal normal-case text-slate-500">
                Recalculate and refresh leave balances in the employee leave eligibilities table.
              </p>
            </div>
            <button
              type="button"
              id="leave-recalculate-btn"
              onClick={handleRecalculate}
              disabled={!canRecalculate}
              title={
                canRecalculate
                  ? `Recalculate leave balances for ${visibleEmployees.length} filtered employee(s)`
                  : "Select at least one filter (Stream, Department, Employee ID, or Employee Name) to enable recalculation"
              }
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-5 text-sm font-semibold transition-all ${
                canRecalculate
                  ? "bg-emerald-700 text-white shadow-md hover:bg-emerald-800 active:scale-[0.98]"
                  : "cursor-not-allowed bg-slate-200 text-slate-400"
              }`}
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={isRecalculating ? "animate-spin" : ""}
              />
              {isRecalculating ? "Recalculating…" : "Leave Recalculate"}
            </button>
          </header>

          {/* Filter bar */}
          <section
            aria-label="Employee filters"
            className="mt-4 flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {/* Stream single-select */}
            <select
              id="filter-stream"
              aria-label="Filter by stream"
              value={streamFilter}
              onChange={(e) => setStreamFilter(e.target.value)}
              className="h-10 min-w-[120px] rounded-md border border-slate-300 bg-white px-3 text-sm normal-case text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="">All Streams</option>
              <option value="SFS">SFS</option>
              <option value="AIDED">AIDED</option>
            </select>

            {/* Departments multi-select */}
            <MultiSelect
              id="filter-departments"
              placeholder="All Departments"
              options={allDepartments}
              selected={selectedDepartments}
              onChange={setSelectedDepartments}
            />

            {/* Employee IDs multi-select */}
            <MultiSelect
              id="filter-employee-ids"
              placeholder="All Employee IDs"
              options={allEmployeeIds}
              selected={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
            />

            {/* Employee Names multi-select */}
            <MultiSelect
              id="filter-employee-names"
              placeholder="All Employee Names"
              options={allEmployeeNames}
              selected={selectedEmployeeNames}
              onChange={setSelectedEmployeeNames}
            />

            {/* Search */}
            <label className="relative min-w-[200px] flex-1">
              <Search
                aria-hidden="true"
                size={16}
                className="pointer-events-none absolute left-3 top-3 text-slate-400"
              />
              <input
                type="search"
                aria-label="Search employees"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm normal-case text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
              />
            </label>

            {/* Export */}
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
            >
              <Download size={16} aria-hidden="true" />
              Export
            </button>
          </section>

          {/* Success banner */}
          {recalcSuccess && (
            <div
              role="status"
              className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm normal-case text-emerald-800"
            >
              <Check size={16} className="shrink-0 text-emerald-600" />
              {recalcSuccess}
            </div>
          )}

          {/* Recalculate hint */}
          {!canRecalculate && !isLoading && (
            <p className="mt-3 text-[12px] normal-case text-slate-500">
              <span className="font-medium text-amber-600">Tip:</span> Select at least one Stream, Department, Employee ID, or Employee Name to enable the{" "}
              <strong>Leave Recalculate</strong> button.
            </p>
          )}

          {/* Table */}
          <main className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {error && (
              <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm normal-case text-red-700">
                {error}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th rowSpan={2} className="whitespace-nowrap px-5 py-3 font-medium">EMPLOYEE ID</th>
                    <th rowSpan={2} className="whitespace-nowrap px-5 py-3 font-medium">EMPLOYEE NAME</th>
                    <th rowSpan={2} className="whitespace-nowrap px-5 py-3 font-medium">STREAM</th>
                    <th rowSpan={2} className="whitespace-nowrap px-5 py-3 font-medium">DEPARTMENT</th>
                    <th colSpan={leaveTypeColumnCount} className="bg-green-100/60 px-5 py-3 text-center font-medium">
                      LEAVE ELIGIBILITY IN DAYS
                    </th>
                    <th colSpan={leaveTypeColumnCount} className="bg-yellow-100/50 px-5 py-3 text-center font-medium">
                      LEAVE BALANCE IN DAYS
                    </th>
                  </tr>
                  <tr>
                    {leaveTypes.length > 0
                      ? leaveTypes.map((lt) => (
                          <th key={`elig-${lt.id}`} className="whitespace-nowrap bg-green-100/60 px-5 py-3 font-medium">
                            {lt.code}
                          </th>
                        ))
                      : <th className="px-5 py-3 font-normal text-slate-400">No leave types</th>
                    }
                    {leaveTypes.length > 0
                      ? leaveTypes.map((lt) => (
                          <th key={`bal-${lt.id}`} className="whitespace-nowrap bg-yellow-100/50 px-5 py-3 font-medium">
                            {lt.code}
                          </th>
                        ))
                      : <th className="px-5 py-3 font-normal text-slate-400">No leave types</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={4 + leaveTypeColumnCount * 2} className="px-5 py-12 text-center text-slate-400 normal-case">
                        Loading employee records…
                      </td>
                    </tr>
                  )}
                  {!isLoading && !error && visibleEmployees.map((emp) => (
                    <tr key={emp.employeeId} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">{emp.employeeId}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800 normal-case">{emp.name}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{emp.stream}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{emp.department}</td>
                      {leaveTypes.map((lt) => (
                        <td key={`elig-${emp.employeeId}-${lt.id}`} className="whitespace-nowrap bg-green-100/60 px-5 py-4 text-slate-700">
                          {getEligibilityValue(emp, lt)}
                        </td>
                      ))}
                      {leaveTypes.map((lt) => (
                        <td key={`bal-${emp.employeeId}-${lt.id}`} className="whitespace-nowrap bg-yellow-100/50 px-5 py-4 text-slate-500">
                          {emp.leaveRecords.find((r) => r.leaveTypeId === lt.id)?.leaveBalance ?? "N/A"}
                        </td>
                      ))}
                      {leaveTypes.length === 0 && (
                        <>
                          <td className="px-5 py-4 text-slate-400">N/A</td>
                          <td className="px-5 py-4 text-slate-400">N/A</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {!isLoading && !error && visibleEmployees.length === 0 && (
                    <tr className="border-t border-slate-200">
                      <td colSpan={4 + leaveTypeColumnCount * 2} className="px-5 py-12 text-center text-slate-500 normal-case">
                        {employees.length === 0
                          ? "No employee records found in the database."
                          : "No employees match the selected filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer row count */}
            {!isLoading && !error && (
              <div className="border-t border-slate-100 px-5 py-2.5 text-[12px] normal-case text-slate-400">
                Showing <strong className="text-slate-600">{visibleEmployees.length}</strong> of{" "}
                <strong className="text-slate-600">{employees.length}</strong> employee{employees.length !== 1 ? "s" : ""}
                {canRecalculate && (
                  <span className="ml-2 text-emerald-600">
                    · {visibleEmployees.length} employee{visibleEmployees.length !== 1 ? "s" : ""} selected for recalculation
                  </span>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
