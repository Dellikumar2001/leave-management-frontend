"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RefreshCw, ChevronDown, Info, X } from "lucide-react";
import * as XLSX from "xlsx";
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
  employeeType?: string;
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
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showInfoModal) setShowInfoModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfoModal]);

  // ── Sequential Cascading Filter states
  const [streamFilters, setStreamFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [employeeTypeFilters, setEmployeeTypeFilters] = useState<string[]>([]);
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

  // ── Step 3: Employee Types disabled until Department is chosen
  const isEmployeeTypeDisabled = isDepartmentDisabled || departmentFilters.length === 0;
  const employeeTypes = useMemo(() => {
    if (isEmployeeTypeDisabled) return [];
    const fromData = [
      ...new Set(
        employees
          .filter((e) => streamFilters.includes(e.stream) && departmentFilters.includes(e.department))
          .map((e) => e.employeeType)
      ),
    ].filter(Boolean) as string[];
    return Array.from(new Set(["Teaching", "Non-Teaching", ...fromData])).sort();
  }, [employees, isEmployeeTypeDisabled, streamFilters, departmentFilters]);

  // ── Step 4: Employees disabled until Employee Type is chosen
  const isEmployeeDisabled = isEmployeeTypeDisabled || employeeTypeFilters.length === 0;
  const availableEmployees = isEmployeeDisabled
    ? []
    : employees.filter(
        (e) =>
          streamFilters.includes(e.stream) &&
          departmentFilters.includes(e.department) &&
          employeeTypeFilters.includes(e.employeeType || "Teaching")
      );

  const employeeNames = [...new Set(availableEmployees.map((e) => e.name))].filter(Boolean).sort();

  // ── Cascading change handlers with cleanup
  const handleStreamChange = (newStreams: string[]) => {
    setStreamFilters(newStreams);
    setDepartmentFilters([]);
    setEmployeeTypeFilters([]);
    setEmployeeNameFilters([]);
  };

  const handleDepartmentChange = (newDepts: string[]) => {
    setDepartmentFilters(newDepts);
    setEmployeeTypeFilters([]);
    setEmployeeNameFilters([]);
  };

  const handleEmployeeTypeChange = (newTypes: string[]) => {
    setEmployeeTypeFilters(newTypes);
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
    if (
      employeeTypeFilters.length > 0 &&
      !employeeTypeFilters.includes(emp.employeeType || "Teaching")
    )
      return false;
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

  // ── Export handler (Excel .xlsx format)
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
        ...leaveTypes.map((lt) => {
          const val = getEligibilityValue(emp, lt);
          const num = Number(val);
          return isNaN(num) ? val : num;
        }),
        ...leaveTypes.map((lt) => {
          const record = emp.leaveRecords.find((r) => r.leaveTypeId === lt.id);
          return record?.leaveBalance ?? "N/A";
        }),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Auto-fit column widths
    const colWidths = rows[0]?.map((_, colIndex) => {
      let maxLen = 12;
      for (const row of rows) {
        const cell = row[colIndex];
        const len = cell !== undefined && cell !== null ? String(cell).length : 0;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.max(maxLen + 3, 14) };
    });
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leave Refresh");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leave-refresh.xlsx";
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
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-800">Leave Refresh</h1>
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                title="About Leave Refresh"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:bg-sky-100 hover:text-sky-800"
                aria-label="About Leave Refresh"
              >
                <Info size={15} />
              </button>
            </div>
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

            {/* Step 3: Employee Type Dropdown */}
            <div className="w-full flex-1">
              <MultiSelectDropdown
                label="Employee Types"
                options={employeeTypes}
                selectedValues={employeeTypeFilters}
                onChange={handleEmployeeTypeChange}
                disabled={isEmployeeTypeDisabled}
              />
            </div>

            {/* Step 4: Employee Name Dropdown */}
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

      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 normal-case"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">About Leave Refresh</h3>
                  <p className="text-xs text-slate-500">Balance recalculation & synchronization engine</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900">What is Leave Refresh?</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-sky-950">
                  Leave Refresh audits approved leave requests, manually credited days, and quota allowances to accurately synchronize live employee balances in the eligibility master record.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                    How it works
                  </h5>
                  <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                    <li>Audits all approved leave records against initial quota allocations.</li>
                    <li>Accounts for manual additions, deductions, and credit leaves.</li>
                    <li>Updates live remaining balance fields across employee records.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    How to use it
                  </h5>
                  <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
                    <li>Filter by stream, department, or individual employee name.</li>
                    <li>Click <strong>Leave Recalculate</strong> to sync live balance tables.</li>
                    <li>Use <strong>Export</strong> to download an updated balance report.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}