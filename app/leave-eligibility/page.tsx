"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";
import { leaveEligibilityValue } from "../../lib/year-end-leave-report";

type LeaveType = {
  code: string;
  category: string | null;
  daysAllowed: number;
  id: number;
  leaveGroup: string;
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

type LeaveEligibilityData = {
  employees: Employee[];
  leaveTypes: LeaveType[];
};

async function fetchLeaveEligibility(): Promise<LeaveEligibilityData> {
  const response = await fetch("/api/leave-eligibility", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to load leave eligibility.");
  return result as LeaveEligibilityData;
}

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
              onKeyDown={(e) => {
                if (label.toLowerCase().includes("department")) {
                  if (e.key.length === 1 && !/^[a-zA-Z0-9\s-]$/.test(e.key)) {
                    e.preventDefault();
                  }
                }
              }}
              onChange={(e) => {
                let val = e.target.value;
                if (label.toLowerCase().includes("department")) {
                  val = val.replace(/[^a-zA-Z0-9\s-]/g, "");
                }
                setSearchTerm(val);
              }}
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

export default function LeaveEligibilityPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [streamFilters, setStreamFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [employeeNameFilters, setEmployeeNameFilters] = useState<string[]>([]);

  // Step 1: All available streams
  const streams = [...new Set(employees.map((employee) => employee.stream))].filter(Boolean).sort();

  // Step 2: Departments disabled until Stream is chosen
  const isDepartmentDisabled = streamFilters.length === 0;
  const departments = isDepartmentDisabled
    ? []
    : [
        ...new Set(
          employees
            .filter((employee) => streamFilters.includes(employee.stream))
            .map((employee) => employee.department)
        ),
      ].filter(Boolean).sort();

  // Step 3: Employees disabled until Department is chosen
  const isEmployeeDisabled = isDepartmentDisabled || departmentFilters.length === 0;
  const availableEmployees = isEmployeeDisabled
    ? []
    : employees.filter(
        (employee) => streamFilters.includes(employee.stream) && departmentFilters.includes(employee.department)
      );

  const employeeNames = [...new Set(availableEmployees.map((employee) => employee.name))].filter(Boolean).sort();

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

  const visibleEmployees = employees.filter((employee) => {
    if (streamFilters.length > 0 && !streamFilters.includes(employee.stream)) return false;
    if (departmentFilters.length > 0 && !departmentFilters.includes(employee.department)) return false;
    if (employeeNameFilters.length > 0 && !employeeNameFilters.includes(employee.name)) return false;
    return true;
  });

  const handleExport = () => {
    const rows = [
      ["EMPLOYEE ID", "EMPLOYEE NAME", "STREAM", "DEPARTMENT", ...leaveTypes.map((leaveType) => `ELIGIBILITY: ${leaveType.code}`), ...leaveTypes.map((leaveType) => `BALANCE: ${leaveType.code}`)],
      ...visibleEmployees.map((employee) => [
        employee.employeeId,
        employee.name,
        employee.stream,
        employee.department,
        ...leaveTypes.map((leaveType) => leaveEligibilityValue(
          leaveType,
          employee.leaveRecords.find((item) => item.leaveTypeId === leaveType.id),
        )),
        ...leaveTypes.map((leaveType) => employee.leaveRecords.find((item) => item.leaveTypeId === leaveType.id)?.leaveBalance ?? "N/A"),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "leave-eligibility.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let isMounted = true;

    fetchLeaveEligibility()
      .then((result) => {
        if (isMounted) {
          setEmployees(result.employees);
          setLeaveTypes(result.leaveTypes);
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leave eligibility.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="eligibility" />
      <div className="p-4 min-[801px]:ml-[175px] uppercase">
        <div className="mx-auto max-w-[1400px]">
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <h1 className="text-3xl font-bold text-slate-800">Leave Eligibility</h1>
          </header>

          {/* Equal split filter bar without search bar */}
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

            {/* Step 2: Department Dropdown (Unlocked after Stream selection) */}
            <div className="w-full flex-1">
              <MultiSelectDropdown
                label="Departments"
                options={departments}
                selectedValues={departmentFilters}
                onChange={handleDepartmentChange}
                disabled={isDepartmentDisabled}
              />
            </div>

            {/* Step 3: Employee Name Dropdown (Unlocked after Department selection) */}
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

          <main className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {error && (
              <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
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
                    <th colSpan={leaveTypeColumnCount} className="px-5 py-3 text-center font-medium bg-green-100/60">LEAVE ELIGIBILITY IN DAYS</th>
                    <th colSpan={leaveTypeColumnCount} className="px-5 py-3 text-center font-medium bg-yellow-100/50">LEAVE BALANCE IN DAYS</th>
                  </tr>
                  <tr>
                    {leaveTypes.length > 0 ? leaveTypes.map((leaveType) => (
                      <th key={`eligibility-${leaveType.id}`} className="whitespace-nowrap px-5 py-3 font-medium bg-green-100/60">
                        {leaveType.code}
                      </th>
                    )) : <th className="px-5 py-3 font-normal text-slate-400">No leave types</th>}
                    {leaveTypes.length > 0 ? leaveTypes.map((leaveType) => (
                      <th key={`balance-${leaveType.id}`} className="whitespace-nowrap px-5 py-3 font-medium bg-yellow-100/50">
                        {leaveType.code}
                      </th>
                    )) : <th className="px-5 py-3 font-normal text-slate-400">No leave types</th>}
                  </tr>
                </thead>
                <tbody>
                  {!isLoading && !error && visibleEmployees.map((employee) => (
                    <tr key={employee.employeeId} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">{employee.employeeId}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">{employee.name}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{employee.stream}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{employee.department}</td>
                      {leaveTypes.map((leaveType) => (
                        <td key={`eligibility-${employee.employeeId}-${leaveType.id}`} className="whitespace-nowrap px-5 py-4 text-slate-700 bg-green-100/60">
                          {leaveEligibilityValue(
                            leaveType,
                            employee.leaveRecords.find((record) => record.leaveTypeId === leaveType.id),
                          )}
                        </td>
                      ))}
                      {leaveTypes.map((leaveType) => (
                        <td key={`balance-${employee.employeeId}-${leaveType.id}`} className="whitespace-nowrap px-5 py-4 text-slate-500 bg-yellow-100/50">
                          {employee.leaveRecords.find((record) => record.leaveTypeId === leaveType.id)?.leaveBalance ?? "N/A"}
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
                      <td colSpan={4 + leaveTypeColumnCount * 2} className="px-5 py-12 text-center text-slate-500">
                        {employees.length === 0 ? "No employee records found in the database." : "No employees match the selected filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}