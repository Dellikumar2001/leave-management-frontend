"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, ChevronDown } from "lucide-react";
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
  return `${record?.daysAllowed ?? leaveType.daysAllowed}`;
}

async function fetchData(signal?: AbortSignal): Promise<LeaveData> {
  const response = await fetch("/api/leave-refresh", { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to load data.");
  return result as LeaveData;
}

/* ─── Reusable MultiSelect Dropdown ───────────────────────── */

function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  disabled = false,
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayLabel = disabled
    ? `Select ${label}`
    : selectedValues.length === 0
    ? `All ${label}`
    : selectedValues.length === 1
    ? selectedValues[0]
    : `${selectedValues.length} ${label} selected`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 text-sm normal-case transition-colors ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
            : isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 text-slate-800"
            : "border-slate-300 text-slate-600 hover:border-slate-400"
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[200px] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              placeholder="Filter list..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded bg-slate-50 px-2.5 py-1.5 text-xs normal-case text-slate-700 outline-none border border-slate-200 placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium normal-case text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={(e) => {
                      onChange(
                        e.target.checked
                          ? [...selectedValues, option]
                          : selectedValues.filter((v) => v !== option)
                      );
                    }}
                    className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                  />
                  <span className="truncate uppercase">{option}</span>
                </label>
              ))
            ) : (
              <p className="py-3 text-center text-xs text-slate-400 normal-case">No options found</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs normal-case">
            <button
              type="button"
              onClick={() => onChange(Array.from(new Set([...selectedValues, ...filteredOptions])))}
              className="text-emerald-700 hover:text-emerald-800 font-medium"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          </div>
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

  // ── Sequential Cascading Filter states
  const [streamFilters, setStreamFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [employeeNameFilters, setEmployeeNameFilters] = useState<string[]>([]);

  // ── Step 1: All unique Streams
  const streams = [...new Set(employees.map((e) => e.stream))].filter(Boolean).sort();

  // ── Step 2: Departments disabled until Stream is chosen
  const isDepartmentDisabled = streamFilters.length === 0;
  const departments = isDepartmentDisabled
    ? []
    : [
        ...new Set(
          employees
            .filter((e) => streamFilters.includes(e.stream))
            .map((e) => e.department)
        ),
      ].filter(Boolean).sort();

  // ── Step 3: Employees disabled until Department is chosen
  const isEmployeeDisabled = isDepartmentDisabled || departmentFilters.length === 0;
  const availableEmployees = isEmployeeDisabled
    ? []
    : employees.filter(
        (e) => streamFilters.includes(e.stream) && departmentFilters.includes(e.department)
      );

  const employeeNames = [...new Set(availableEmployees.map((e) => e.name))].filter(Boolean).sort();

  // ── Cascading change handlers with cleanup
  const handleStreamChange = (newStreams: string[]) => {
    setStreamFilters(newStreams);
    setDepartmentFilters([]);
    setEmployeeNameFilters([]);
  };

  const handleDepartmentChange = (newDepts: string[]) => {
    setDepartmentFilters(newDepts);
    setEmployeeNameFilters([]);
  };

  const handleEmployeeNameChange = (newNames: string[]) => {
    setEmployeeNameFilters(newNames);
  };

  const leaveTypeColumnCount = Math.max(leaveTypes.length, 1);

  // ── Filtered employees for table rendering
  const visibleEmployees = employees.filter((emp) => {
    if (streamFilters.length > 0 && !streamFilters.includes(emp.stream)) return false;
    if (departmentFilters.length > 0 && !departmentFilters.includes(emp.department)) return false;
    if (employeeNameFilters.length > 0 && !employeeNameFilters.includes(emp.name)) return false;
    return true;
  });

  const canRecalculate =
    !isLoading &&
    !isRecalculating &&
    visibleEmployees.length > 0 &&
    (streamFilters.length > 0 || departmentFilters.length > 0 || employeeNameFilters.length > 0);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadData() {
      try {
        const result = await fetchData(controller.signal);
        if (!isMounted) return;
        setEmployees(result.employees);
        setLeaveTypes(result.leaveTypes);
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load data.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

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
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <h1 className="text-3xl font-bold text-slate-800">Leave Refresh</h1>
            <p className="mt-1 text-[13px] font-normal normal-case text-slate-500">
              Recalculate and refresh leave balances in the employee leave eligibilities table.
            </p>
          </header>

          {/* Equal split filter bar with Export button */}
          <section
            aria-label="Employee filters"
            className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
          >
            {/* Step 1: Stream Dropdown */}
            <div className="w-full flex-1">
              <MultiSelectDropdown
                label="Streams"
                options={streams}
                selectedValues={streamFilters}
                onChange={handleStreamChange}
              />
            </div>

            {/* Step 2: Department Dropdown */}
            <div className="w-full flex-1">
              <MultiSelectDropdown
                label="Departments"
                options={departments}
                selectedValues={departmentFilters}
                onChange={handleDepartmentChange}
                disabled={isDepartmentDisabled}
              />
            </div>

            {/* Step 3: Employee Name Dropdown */}
            <div className="w-full flex-1">
              <MultiSelectDropdown
                label="Employee Names"
                options={employeeNames}
                selectedValues={employeeNameFilters}
                onChange={handleEmployeeNameChange}
                disabled={isEmployeeDisabled}
              />
            </div>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-800 px-5 text-sm font-medium text-white hover:bg-slate-700"
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
              {recalcSuccess}
            </div>
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
                      LEAVE ENTITLEMENT IN DAYS
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

            {/* Footer row with count and Recalculate Button aligned beneath Leave Balance */}
            {!isLoading && !error && (
              <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[12px] normal-case text-slate-400">
                  Showing <strong className="text-slate-600">{visibleEmployees.length}</strong> of{" "}
                  <strong className="text-slate-600">{employees.length}</strong> employee{employees.length !== 1 ? "s" : ""}
                  {canRecalculate && (
                    <span className="ml-2 text-emerald-600">
                      · {visibleEmployees.length} employee{visibleEmployees.length !== 1 ? "s" : ""} selected for recalculation
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <button
                    type="button"
                    id="leave-recalculate-btn"
                    onClick={handleRecalculate}
                    disabled={!canRecalculate}
                    title={
                      canRecalculate
                        ? `Recalculate leave balances for ${visibleEmployees.length} filtered employee(s)`
                        : "Select at least one filter (Stream, Department, or Employee Name) to enable recalculation"
                    }
                    className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-5 text-sm font-semibold transition-all ${
                      canRecalculate
                        ? "bg-emerald-700 text-white shadow-md hover:bg-emerald-800 active:scale-[0.98]"
                        : "cursor-not-allowed bg-slate-200 text-slate-400"
                    }`}
                  >
                    <RefreshCw
                      size={15}
                      aria-hidden="true"
                      className={isRecalculating ? "animate-spin" : ""}
                    />
                    {isRecalculating ? "Recalculating…" : "Leave Recalculate"}
                  </button>

                  {!canRecalculate && (
                    <p className="text-[11px] normal-case text-slate-400">
                      Select at least one filter to enable recalculation
                    </p>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}