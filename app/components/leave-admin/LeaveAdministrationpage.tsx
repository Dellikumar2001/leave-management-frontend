"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, LoaderCircle, Minus, Plus } from "lucide-react";
import LeaveSidebar from "../LeaveSidebar";
import DateInput, { formatToDisplayDate } from "../DateInput";
import EmployeeTable, { EmployeeRow } from "./EmployeeTable";
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
  if (!value) return "";
  return formatToDisplayDate(value.slice(0, 10)) || value;
}

function totalDays(start: string, end: string) {
  const first = parseDate(start);
  const last = parseDate(end);
  if (!first || !last || last < first) return 0;
  return Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;
}

function employeeGroupLabel(
  selectedEmployees: EmployeeRow[],
  allEmployees: EmployeeRow[],
  selectedStreams: string[],
  selectedDepartments: string[],
) {
  const scopedEmployees = selectedStreams.length || selectedDepartments.length
    ? allEmployees.filter((employee) =>
        (!selectedStreams.length || selectedStreams.includes(employee.stream)) &&
        (!selectedDepartments.length || selectedDepartments.includes(employee.department))
      )
    : selectedEmployees;
  const pairs = [...new Set(scopedEmployees.map(({ department, stream }) => `${department} (${stream})`))].sort();
  if (pairs.length === 0) return "from the selected employees";

  if (selectedStreams.length > 0 && selectedDepartments.length === 0) {
    return `from all ${selectedStreams.join(" and ")} departments`;
  }

  const formattedPairs = pairs.length > 1
    ? `${pairs.slice(0, -1).join(", ")} and ${pairs[pairs.length - 1]}`
    : pairs[0];
  return `from ${formattedPairs}`;
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

/* ─── Reusable MultiSelect Dropdown (Maternity Leave Pattern) ──── */

export function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  onOpen,
  disabled = false,
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  onOpen?: () => void;
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
    ? `Select ${label}`
    : selectedValues.length === 1
    ? selectedValues[0]
    : `${selectedValues.length} ${label} selected`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!isOpen) onOpen?.();
          setIsOpen((prev) => !prev);
        }}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 text-sm normal-case transition-colors ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
            : isOpen
            ? "border-emerald-600 ring-2 ring-emerald-600/20 text-slate-800"
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
                    className="size-3.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
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

export default function LeaveAdministrationPage({ mode }: { mode: Mode }) {
  const [category, setCategory] = useState<Category>("ANNUAL");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [blockedLeaves, setBlockedLeaves] = useState<BlockedDateRecord[]>([]);
  const [credits, setCredits] = useState<CreditRecord[]>([]);

  // ── Sequential Cascading Filter States
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedEmployeeTypes, setSelectedEmployeeTypes] = useState<string[]>([]);
  const [selectedEmployeeNames, setSelectedEmployeeNames] = useState<string[]>([]);

  // Checkbox selections inside EmployeeTable
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

  // ── Step 1: All unique Streams
  const streams = useMemo(
    () => [...new Set(employees.map((e) => e.stream))].filter(Boolean).sort(),
    [employees]
  );

  // ── Step 2: Departments disabled until Stream is chosen
  const isDepartmentDisabled = selectedStreams.length === 0;
  const departments = useMemo(() => {
    if (isDepartmentDisabled) return [];
    return [
      ...new Set(
        employees
          .filter((e) => selectedStreams.includes(e.stream))
          .map((e) => e.department)
      ),
    ].filter(Boolean).sort();
  }, [employees, isDepartmentDisabled, selectedStreams]);

  // ── Step 3: Employee Types disabled until Department is chosen
  const isEmployeeTypeDisabled = isDepartmentDisabled || selectedDepartments.length === 0;
  const employeeTypes = useMemo(() => {
    if (isEmployeeTypeDisabled) return [];
    const fromData = [
      ...new Set(
        employees
          .filter(
            (e) =>
              selectedStreams.includes(e.stream) &&
              selectedDepartments.includes(e.department)
          )
          .map((e) => e.employeeType)
      ),
    ].filter(Boolean) as string[];
    return Array.from(new Set(["Teaching", "Non-Teaching", ...fromData])).sort();
  }, [employees, isEmployeeTypeDisabled, selectedStreams, selectedDepartments]);

  // ── Step 4: Employees disabled until Employee Type is chosen
  const isEmployeeDisabled = isEmployeeTypeDisabled || selectedEmployeeTypes.length === 0;
  const availableEmployees = useMemo(() => {
    if (isEmployeeDisabled) return [];
    return employees.filter(
      (e) =>
        selectedStreams.includes(e.stream) &&
        selectedDepartments.includes(e.department) &&
        selectedEmployeeTypes.includes(e.employeeType || "Teaching")
    );
  }, [employees, isEmployeeDisabled, selectedDepartments, selectedStreams, selectedEmployeeTypes]);

  const employeeNames = useMemo(
    () => [...new Set(availableEmployees.map((e) => e.name))].filter(Boolean).sort(),
    [availableEmployees]
  );

  // ── Cascading Handlers (auto-checks matching employees for table action checkboxes)
  const handleStreamChange = (newStreams: string[]) => {
    setSelectedStreams(newStreams);
    setSelectedDepartments([]);
    setSelectedEmployeeTypes([]);
    setSelectedEmployeeNames([]);
    setSelectedEmployeeIds([]);
  };

  const handleDepartmentChange = (newDepts: string[]) => {
    setSelectedDepartments(newDepts);
    setSelectedEmployeeTypes([]);
    setSelectedEmployeeNames([]);
    setSelectedEmployeeIds([]);
  };

  const handleEmployeeTypeChange = (newTypes: string[]) => {
    setSelectedEmployeeTypes(newTypes);
    setSelectedEmployeeNames([]);
    setSelectedEmployeeIds([]);
  };

  const handleEmployeeNameChange = (newNames: string[]) => {
    setSelectedEmployeeNames(newNames);
    if (newNames.length > 0) {
      const chosenIds = availableEmployees
        .filter((emp) => newNames.includes(emp.name))
        .map((emp) => emp.employeeId);
      setSelectedEmployeeIds(chosenIds);
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  // Table only appears after the employee name is selected
  const showEmployees = selectedEmployeeNames.length > 0;

  // Filter visible employees based on chosen names
  const visibleEmployees = useMemo(() => {
    if (!showEmployees) return [];
    return availableEmployees.filter((emp) => selectedEmployeeNames.includes(emp.name));
  }, [availableEmployees, selectedEmployeeNames, showEmployees]);

  const selectedEmployees = employees.filter(({ employeeId }) => selectedEmployeeIds.includes(employeeId));
  const daysToBlock = totalDays(startDate, endDate || startDate);
  const canSubmit = selectedEmployeeIds.length > 0 && (mode === "block" ? daysToBlock > 0 : days > 0);
  const showSummary = selectedEmployees.length > 0 && (mode === "credit" || daysToBlock > 0);
  const groupLabel = employeeGroupLabel(selectedEmployees, employees, selectedStreams, selectedDepartments);

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
      if (mode === "credit") {
        setSuccess(`Credited leave for ${result.creditedCount} employee${result.creditedCount === 1 ? "" : "s"}.`);
      } else {
        setSuccess("");
      }
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
        let message = "Unable to update the leave record.";
        try {
          const result = await response.json();
          if (result && typeof result === "object" && "error" in result && typeof (result as Record<string, unknown>).error === "string") {
            message = (result as { error: string }).error;
          }
        } catch {}
        throw new Error(message);
      }
      if (method === "DELETE" && "id" in body && typeof (body as { id?: unknown }).id === "number") {
        const targetId = (body as { id: number }).id;
        if (mode === "block") {
          setBlockedLeaves((prev) => prev.filter((item) => item.id !== targetId));
        } else {
          setCredits((prev) => prev.filter((item) => item.id !== targetId));
        }
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
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    if (category === value) return;
                    setCategory(value);
                    setSelectedEmployeeIds([]);
                    setSuccess("");
                    setError("");
                    setIsLoading(true);
                  }}
                  aria-current={category === value ? "page" : undefined}
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
                    category === value ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Credit {value === "ANNUAL" ? "Annual" : "Medical"} Leave
                </button>
              ))}
            </nav>
          )}

          <section aria-label="Employee filters and leave controls" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div
              className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
                mode === "block"
                  ? "xl:grid-cols-[minmax(130px,1fr)_minmax(140px,1.1fr)_minmax(140px,1fr)_minmax(160px,1.2fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_auto]"
                  : "xl:grid-cols-[minmax(130px,1fr)_minmax(140px,1.1fr)_minmax(140px,1fr)_minmax(160px,1.2fr)_minmax(150px,1fr)_auto]"
              }`}
            >
              {/* Step 1: Stream Dropdown */}
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Stream</span>
                <MultiSelectDropdown
                  label="Streams"
                  options={streams}
                  selectedValues={selectedStreams}
                  onChange={handleStreamChange}
                />
              </div>

              {/* Step 2: Department Dropdown (Unlocked after Stream chosen) */}
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Department</span>
                <MultiSelectDropdown
                  label="Departments"
                  options={departments}
                  selectedValues={selectedDepartments}
                  onChange={handleDepartmentChange}
                  disabled={isDepartmentDisabled}
                />
              </div>

              {/* Step 3: Employee Type Dropdown */}
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Employee Type</span>
                <MultiSelectDropdown
                  label="Employee Types"
                  options={employeeTypes}
                  selectedValues={selectedEmployeeTypes}
                  onChange={handleEmployeeTypeChange}
                  disabled={isEmployeeTypeDisabled}
                />
              </div>

              {/* Step 4: Employee Name Dropdown (Unlocked after Department chosen) */}
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Employee</span>
                <MultiSelectDropdown
                  label="Employee Names"
                  options={employeeNames}
                  selectedValues={selectedEmployeeNames}
                  onChange={handleEmployeeNameChange}
                  disabled={isEmployeeDisabled}
                />
              </div>

              {mode === "block" ? (
                <>
                  <div className="min-w-0">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">Set Date</span>
                    <DateInput
                      id="block-start-date"
                      value={startDate}
                      onChange={(val) => {
                        setStartDate(val);
                        if (endDate && val && endDate < val) setEndDate(val);
                      }}
                      aria-label="Set leave block start date"
                      placeholder="dd / mm / yyyy"
                      className="h-11 rounded-lg"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1.5 block text-xs font-medium text-slate-600">End Date</span>
                    <DateInput
                      id="block-end-date"
                      min={startDate || undefined}
                      value={endDate}
                      onChange={(val) => setEndDate(val)}
                      aria-label="Set leave block end date"
                      placeholder="dd / mm / yyyy"
                      className="h-11 rounded-lg"
                    />
                  </div>
                </>
              ) : (
                <div ref={counterRef} className={`relative min-w-0 ${counterOpen ? "z-30" : ""}`}>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Number of days</span>
                  <button
                    type="button"
                    aria-expanded={counterOpen}
                    onClick={() => setCounterOpen((open) => !open)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === "Escape") {
                        event.preventDefault();
                        setCounterOpen(false);
                      }
                    }}
                    className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 px-3 text-sm hover:border-slate-400"
                  >
                    {days} day{days === 1 ? "" : "s"} <ChevronDown size={16} />
                  </button>
                  {counterOpen && (
                    <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          aria-label="Decrease days"
                          onClick={() => setDays((value) => Math.max(0, value - 1))}
                          className="grid size-10 place-items-center rounded-lg border border-slate-300 hover:bg-slate-50"
                        >
                          <Minus size={18} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={days}
                          aria-label="Credit days"
                          onChange={(event) => setDays(Math.max(0, Number(event.target.value) || 0))}
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
                          className="h-12 w-24 appearance-none rounded-lg border border-slate-300 text-center text-xl font-semibold outline-none focus:border-emerald-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          aria-label="Increase days"
                          onClick={() => setDays((value) => value + 1)}
                          className="grid size-10 place-items-center rounded-lg border border-slate-300 hover:bg-slate-50"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {([["+5 days", 5], ["+10 days", 10], ["+1 week", 7]] as const).map(([label, amount]) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setDays((value) => value + amount)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => setConfirmOpen(true)}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 transition-colors"
              >
                <CalendarDays size={16} aria-hidden="true" />
                {mode === "block" ? "Block Leaves" : "Credit Leave"}
              </button>
            </div>
          </section>

          {showSummary && (
            <p aria-live="polite" className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
              {summary}
            </p>
          )}
          {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {mode !== "block" && success && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
          {isLoading && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-10 text-sm text-slate-500">
              <LoaderCircle size={17} className="animate-spin" />
              Loading leave administration data...
            </div>
          )}

          {/* Table with checkboxes renders strictly after Employee selection */}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) setConfirmOpen(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-label={`Confirm ${mode === "block" ? "block leave" : "credit leave"}`} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800">Confirm {mode === "block" ? "block leave" : "credit leave"}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">{summary}</p>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <footer className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setConfirmOpen(false)}
                className="h-10 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void handleAction()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
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