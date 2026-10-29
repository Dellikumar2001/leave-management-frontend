"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, FileText, LoaderCircle } from "lucide-react";
import DateInput from "../../components/DateInput";
import LeaveSidebar from "../../components/LeaveSidebar";
import EmployeeReportDocument, { type EmployeeReportData } from "../EmployeeReportDocument";
type EmployeeOption = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  employeeType?: string;
};

type ReportData = EmployeeReportData;

type Semester = "FULL" | "ODD" | "EVEN";



function academicYearStartFor(date: Date) {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

function dateRangeForSemester(startYear: number, semester: Semester) {
  if (semester === "ODD") return { start: `${startYear}-07-01`, end: `${startYear}-12-31` };
  if (semester === "EVEN") return { start: `${startYear + 1}-01-01`, end: `${startYear + 1}-06-30` };
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(text) as unknown;
  } catch {
    throw new Error(text.trim() || "The server returned an empty or invalid response.");
  }
  if (!response.ok) {
    const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Unable to load the individual leave report.";
    throw new Error(error);
  }
  return result as T;
}

/* ─── Reusable MultiSelect Dropdown (Maternity Leave / Leave Refresh Pattern) ─── */

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
    ? `Select ${label}`
    : selectedValues.length === 1
    ? selectedValues[0]
    : `${selectedValues.length} ${label} selected`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
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

export default function IndividualLeaveReportPage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedEmployeeTypes, setSelectedEmployeeTypes] = useState<string[]>([]);
  const [selectedEmployeeNames, setSelectedEmployeeNames] = useState<string[]>([]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadEmployees() {
      try {
        const response = await fetch("/api/block-leave?category=ANNUAL", { cache: "no-store" });
        const data = await readJson<{ employees: EmployeeOption[] }>(response);
        if (cancelled) return;
        setEmployees(data.employees);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load employees.");
      } finally {
        if (!cancelled) setIsLoadingEmployees(false);
      }
    }
    void loadEmployees();
    return () => { cancelled = true; };
  }, []);

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

  // ── Date Option enabled ONLY after Stream, Department, Employee Type, and Employee Name are selected
  const isDateOptionDisabled =
    selectedStreams.length === 0 ||
    selectedDepartments.length === 0 ||
    selectedEmployeeTypes.length === 0 ||
    selectedEmployeeNames.length === 0;

  // Selected Employee object (derived from chosen employee name)
  const selectedEmployee = useMemo(() => {
    if (selectedEmployeeNames.length === 0) return null;
    return availableEmployees.find((e) => selectedEmployeeNames.includes(e.name)) ?? null;
  }, [availableEmployees, selectedEmployeeNames]);

  // ── Cascading Filter Handlers
  const handleStreamChange = (newStreams: string[]) => {
    setSelectedStreams(newStreams);
    setSelectedDepartments([]);
    setSelectedEmployeeTypes([]);
    setSelectedEmployeeNames([]);
    setStartDate("");
    setEndDate("");
    setDateError("");
    setReport(null);
  };

  const handleDepartmentChange = (newDepts: string[]) => {
    setSelectedDepartments(newDepts);
    setSelectedEmployeeTypes([]);
    setSelectedEmployeeNames([]);
    setStartDate("");
    setEndDate("");
    setDateError("");
    setReport(null);
  };

  const handleEmployeeTypeChange = (newTypes: string[]) => {
    setSelectedEmployeeTypes(newTypes);
    setSelectedEmployeeNames([]);
    setStartDate("");
    setEndDate("");
    setDateError("");
    setReport(null);
  };

  const handleEmployeeNameChange = (newNames: string[]) => {
    setSelectedEmployeeNames(newNames);
    setStartDate("");
    setEndDate("");
    setDateError("");
    setReport(null);
  };

  const handleStartDate = (value: string) => {
    setStartDate(value);
    setReport(null);
    if (endDate && value && value > endDate) {
      setDateError("Start date cannot be after end date.");
    } else {
      setDateError("");
    }
  };

  const handleEndDate = (value: string) => {
    setEndDate(value);
    setReport(null);
    if (startDate && value && value < startDate) {
      setDateError("End date cannot be before start date.");
    } else {
      setDateError("");
    }
  };

  const generateReport = async () => {
    if (!selectedEmployee || !startDate || !endDate || dateError) return;
    setIsGenerating(true);
    setError("");
    setReport(null);
    try {
      const startYear = academicYearStartFor(new Date(`${startDate}T00:00:00.000Z`));
      const endYear = academicYearStartFor(new Date(`${endDate}T00:00:00.000Z`));
      const yearStart = dateRangeForSemester(startYear, "FULL").start;
      const yearEnd = dateRangeForSemester(endYear, "FULL").end;

      const params = new URLSearchParams({
        employeeId: selectedEmployee.employeeId,
        startDate,
        endDate,
        academicYearStart: yearStart,
        academicYearEnd: yearEnd,
      });
      const response = await fetch(`/api/individual-report?${params.toString()}`, { cache: "no-store" });
      setReport(await readJson<ReportData>(response));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Unable to generate the report.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="individual-report" />
      <main className="p-4 min-[801px]:ml-[175px] print:ml-0 print:p-0">
        <div className="mx-auto max-w-[1400px] print:max-w-none">
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm print:hidden">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Leave Report</p>
            <h1 className="text-3xl font-bold text-slate-800">Individual Report</h1>
          </header>

          <section aria-label="Employee and report filters" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(130px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(160px,1.2fr)_minmax(240px,1.5fr)_auto]">
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

              {/* Step 2: Department Dropdown (Unlocked after Stream selection) */}
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

              {/* Step 4: Employee Name Dropdown (Unlocked after Department selection) */}
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

              {/* Step 4: Date Range — Kept outside like Leave Status Report */}
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Date Range</span>
                <div className="flex min-w-0 items-center gap-2">
                  <DateInput
                    id="filter-start-date"
                    value={startDate}
                    onChange={(val) => handleStartDate(val)}
                    disabled={isDateOptionDisabled}
                    aria-label="Start date"
                    title={!isDateOptionDisabled ? "Start date" : "Select stream, department, and employee first to enable date selection"}
                    placeholder="dd / mm / yyyy"
                    className="h-11"
                  />
                  <ArrowRight size={15} className={`shrink-0 ${!isDateOptionDisabled ? "text-slate-400" : "text-slate-300"}`} aria-hidden="true" />
                  <DateInput
                    id="filter-end-date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(val) => handleEndDate(val)}
                    disabled={isDateOptionDisabled}
                    aria-label="End date"
                    title={!isDateOptionDisabled ? "End date" : "Select stream, department, and employee first to enable date selection"}
                    placeholder="dd / mm / yyyy"
                    className="h-11"
                  />
                </div>
              </div>

              {/* Generate Button */}
              <div className="min-w-0">
                <button
                  type="button"
                  disabled={!selectedEmployee || !startDate || !endDate || Boolean(dateError) || isGenerating || isLoadingEmployees}
                  onClick={() => void generateReport()}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isGenerating ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />}
                  GENERATE
                </button>
              </div>
            </div>

            {dateError && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">{dateError}</p>}
            {isLoadingEmployees && <p className="mt-3 text-sm text-slate-500">Loading employees…</p>}
            {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          </section>

          {report && <EmployeeReportDocument report={report} />}
        </div>
      </main>
    </div>
  );
}
