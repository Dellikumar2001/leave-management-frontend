"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Search,
  ShieldCheck,
  UserCheck,
  X,
  Check,
  AlertCircle,
  Users,
} from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type Employee = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  gender?: string | null;
  designation?: string | null;
  firstLevelApprover?: string | null;
  finalLevelApprover?: string | null;
  backupOfficer?: string | null;
  updatedAt?: string | null;
};

type ApproverOption = {
  employeeId: string;
  name: string;
  department: string;
  stream: string;
  label: string;
};

/* ─── MultiSelect Dropdown Component with Checkboxes (for Streams, Departments, Employee Names) ─── */
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

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(term));
  }, [options, searchTerm]);

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
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 text-sm normal-case transition-all ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
            : isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20 text-slate-800"
            : "border-slate-300 text-slate-700 hover:border-slate-400"
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
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Filter ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-700 outline-none border border-slate-200 placeholder:text-slate-400 focus:border-emerald-500"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isChecked = selectedValues.includes(option);
                return (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        onChange(
                          e.target.checked
                            ? [...selectedValues, option]
                            : selectedValues.filter((v) => v !== option)
                        );
                      }}
                      className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="truncate">{option}</span>
                  </label>
                );
              })
            ) : (
              <p className="py-3 text-center text-xs text-slate-400">No {label.toLowerCase()} found</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => onChange(Array.from(new Set([...selectedValues, ...filteredOptions])))}
              className="text-emerald-700 hover:text-emerald-800 font-semibold"
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

/* ─── Searchable Single Select Dropdown (for First Level and Final Level Approver) ─── */
function SingleSelectDropdown({
  label,
  options,
  selectedValue,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  options: { label: string; value: string; subtitle?: string }[];
  selectedValue: string;
  onChange: (value: string) => void;
  placeholder?: string;
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

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  const selectedItem = options.find((opt) => opt.value === selectedValue);

  const displayLabel = disabled
    ? placeholder || `Select ${label}`
    : selectedItem
    ? selectedItem.label
    : placeholder || `Select ${label}`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 text-sm normal-case transition-all ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
            : isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20 text-slate-800"
            : "border-slate-300 text-slate-700 hover:border-slate-400"
        }`}
      >
        <span className={`truncate ${!selectedItem || disabled ? "text-slate-400" : ""}`}>
          {displayLabel}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-700 outline-none border border-slate-200 placeholder:text-slate-400 focus:border-emerald-500"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5">
            {selectedValue && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
              >
                <span>Clear selection</span>
                <X size={13} />
              </button>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = selectedValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-800 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate">{option.label}</div>
                      {option.subtitle && (
                        <div className="text-[11px] text-slate-400 font-normal">
                          {option.subtitle}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="shrink-0 text-emerald-600" />}
                  </button>
                );
              })
            ) : (
              <p className="py-3 text-center text-xs text-slate-400">No {label.toLowerCase()} found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type SortableColumnKey = "name" | "firstLevelApprover" | "finalLevelApprover" | "backupOfficer";

function SortHeaderButton({
  label,
  columnKey,
  sortField,
  sortDirection,
  onSort,
}: {
  label: string;
  columnKey: SortableColumnKey;
  sortField: SortableColumnKey | null;
  sortDirection: "asc" | "desc" | null;
  onSort: (field: SortableColumnKey) => void;
}) {
  const isCurrent = sortField === columnKey;
  const isAsc = isCurrent && sortDirection === "asc";
  const isDesc = isCurrent && sortDirection === "desc";

  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className="group inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-wider text-xs cursor-pointer select-none"
      title={
        !isCurrent || !sortDirection
          ? `Sort ${label} (Ascending)`
          : isAsc
          ? `Sort ${label} (Descending)`
          : `Reset ${label} sorting to normal`
      }
    >
      <span>{label}</span>
      <span className="inline-flex items-center justify-center">
        {isAsc ? (
          <ArrowUp size={14} className="text-emerald-600 stroke-[2.5]" />
        ) : isDesc ? (
          <ArrowDown size={14} className="text-emerald-600 stroke-[2.5]" />
        ) : (
          <ArrowUpDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
        )}
      </span>
    </button>
  );
}

export default function ApproverSettingsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approverOptions, setApproverOptions] = useState<ApproverOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [hasAssigned, setHasAssigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cascading Multi-Select Filters
  const [streamFilters, setStreamFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [employeeNameFilters, setEmployeeNameFilters] = useState<string[]>([]);

  // Checkbox row selection state
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Top level Approver Selection Fields (Directly on page, no modal)
  const [firstLevelApprover, setFirstLevelApprover] = useState<string>("");
  const [finalLevelApprover, setFinalLevelApprover] = useState<string>("");
  const [backupOfficer, setBackupOfficer] = useState<string>("");

  // Column sorting state
  const [sortField, setSortField] = useState<SortableColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(null);

  const handleSort = (field: SortableColumnKey) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  // Fetch initial data
  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/approver-settings", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load approver settings.");
      }
      setEmployees(data.employees || []);
      setApproverOptions(data.approverOptions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load employees.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // All available streams
  const streams = useMemo(() => {
    return [...new Set(employees.map((e) => e.stream))].filter(Boolean).sort();
  }, [employees]);

  // Departments (directly selectable! Filtered if stream is selected, otherwise all departments)
  const departments = useMemo(() => {
    if (streamFilters.length > 0) {
      return [
        ...new Set(
          employees
            .filter((e) => streamFilters.includes(e.stream))
            .map((e) => e.department)
        ),
      ]
        .filter(Boolean)
        .sort();
    }
    return [...new Set(employees.map((e) => e.department))].filter(Boolean).sort();
  }, [employees, streamFilters]);

  // Employee names (directly selectable! Filtered if stream/dept selected, otherwise all employees)
  const employeeNames = useMemo(() => {
    let pool = employees;
    if (streamFilters.length > 0) {
      pool = pool.filter((e) => streamFilters.includes(e.stream));
    }
    if (departmentFilters.length > 0) {
      pool = pool.filter((e) => departmentFilters.includes(e.department));
    }
    return [...new Set(pool.map((e) => e.name))].filter(Boolean).sort();
  }, [employees, streamFilters, departmentFilters]);

  // Direct independent filter handlers
  const handleStreamChange = (newStreams: string[]) => {
    setStreamFilters(newStreams);
  };

  const handleDepartmentChange = (newDepts: string[]) => {
    setDepartmentFilters(newDepts);
  };

  const handleEmployeeNameChange = (newNames: string[]) => {
    setEmployeeNameFilters(newNames);

    if (newNames.length === 1) {
      const selectedName = newNames[0];
      const emp =
        employees.find(
          (e) =>
            e.name === selectedName &&
            (streamFilters.length === 0 || streamFilters.includes(e.stream)) &&
            (departmentFilters.length === 0 || departmentFilters.includes(e.department))
        ) || employees.find((e) => e.name === selectedName);

      if (emp) {
        setStreamFilters([emp.stream]);
        setDepartmentFilters([emp.department]);
        setSelectedRowIds([emp.employeeId]);
        setFirstLevelApprover(emp.firstLevelApprover || "");
        setFinalLevelApprover(emp.finalLevelApprover || "");
        setBackupOfficer(emp.backupOfficer || "");
        setSuccessMessage(`Editing approvers for ${emp.name} (${emp.employeeId})`);
        setTimeout(() => setSuccessMessage(""), 3500);
      }
    } else if (newNames.length === 0) {
      setSelectedRowIds([]);
      setFirstLevelApprover("");
      setFinalLevelApprover("");
      setBackupOfficer("");
    } else {
      const matching = employees.filter((e) => newNames.includes(e.name));
      setSelectedRowIds(matching.map((e) => e.employeeId));
    }
  };

  const handleClearSelection = () => {
    setStreamFilters([]);
    setDepartmentFilters([]);
    setEmployeeNameFilters([]);
    setSelectedRowIds([]);
    setFirstLevelApprover("");
    setFinalLevelApprover("");
    setBackupOfficer("");
    setSortField(null);
    setSortDirection(null);
    setHasAssigned(false);
    setSuccessMessage("");
    setError("");
  };

  // Filtered and Sorted employees for table display
  const visibleEmployees = useMemo(() => {
    const filtered = employees.filter((emp) => {
      if (streamFilters.length > 0 && !streamFilters.includes(emp.stream)) return false;
      if (departmentFilters.length > 0 && !departmentFilters.includes(emp.department)) return false;
      if (employeeNameFilters.length > 0 && !employeeNameFilters.includes(emp.name)) return false;
      return true;
    });

    if (!sortField || !sortDirection) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      if (sortField === "name") {
        const comp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        return sortDirection === "asc" ? comp : -comp;
      }

      if (sortField === "firstLevelApprover") {
        const valA = (a.firstLevelApprover || "").trim();
        const valB = (b.firstLevelApprover || "").trim();
        if (!valA && !valB) return 0;
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valA.localeCompare(valB, undefined, { sensitivity: "base" });
        return sortDirection === "asc" ? comp : -comp;
      }

      if (sortField === "finalLevelApprover") {
        const valA = (a.finalLevelApprover || "").trim();
        const valB = (b.finalLevelApprover || "").trim();
        if (!valA && !valB) return 0;
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valA.localeCompare(valB, undefined, { sensitivity: "base" });
        return sortDirection === "asc" ? comp : -comp;
      }

      if (sortField === "backupOfficer") {
        const valA = (a.backupOfficer || "").trim();
        const valB = (b.backupOfficer || "").trim();
        if (!valA && !valB) return 0;
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valA.localeCompare(valB, undefined, { sensitivity: "base" });
        return sortDirection === "asc" ? comp : -comp;
      }

      return 0;
    });
  }, [employees, streamFilters, departmentFilters, employeeNameFilters, sortField, sortDirection]);

  // Selected employee IDs: ONLY from table checkboxes OR from Employee Name dropdown selection
  const effectiveSelectedEmployeeIds = useMemo(() => {
    if (selectedRowIds.length > 0) {
      return selectedRowIds;
    }

    if (employeeNameFilters.length > 0) {
      return visibleEmployees
        .filter((emp) => employeeNameFilters.includes(emp.name))
        .map((emp) => emp.employeeId);
    }

    return [];
  }, [selectedRowIds, employeeNameFilters, visibleEmployees]);

  // Master Checkbox Toggle for Visible Table Rows
  const isAllVisibleSelected =
    visibleEmployees.length > 0 &&
    visibleEmployees.every((emp) => selectedRowIds.includes(emp.employeeId));

  const isSomeVisibleSelected =
    visibleEmployees.some((emp) => selectedRowIds.includes(emp.employeeId)) &&
    !isAllVisibleSelected;

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      const visibleIds = new Set(visibleEmployees.map((emp) => emp.employeeId));
      setSelectedRowIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const combined = new Set([...selectedRowIds, ...visibleEmployees.map((e) => e.employeeId)]);
      setSelectedRowIds(Array.from(combined));
    }
  };

  const handleToggleRow = (employeeId: string) => {
    const isCurrentlySelected = selectedRowIds.includes(employeeId);

    if (isCurrentlySelected) {
      setSelectedRowIds((prev) => prev.filter((id) => id !== employeeId));
      setEmployeeNameFilters((prev) => {
        const emp = employees.find((e) => e.employeeId === employeeId);
        return emp ? prev.filter((name) => name !== emp.name) : prev;
      });
      setFirstLevelApprover("");
      setFinalLevelApprover("");
      setBackupOfficer("");
    } else {
      const emp = employees.find((e) => e.employeeId === employeeId);
      if (emp) {
        setStreamFilters([emp.stream]);
        setDepartmentFilters([emp.department]);
        setEmployeeNameFilters([emp.name]);
        setSelectedRowIds([emp.employeeId]);
        setFirstLevelApprover(emp.firstLevelApprover || "");
        setFinalLevelApprover(emp.finalLevelApprover || "");
        setBackupOfficer(emp.backupOfficer || "");
        setSuccessMessage(`Editing approvers for ${emp.name} (${emp.employeeId})`);
        setTimeout(() => setSuccessMessage(""), 3500);
      }
    }
  };

  const handleBackupOfficerChange = (val: string) => {
    setBackupOfficer(val);
  };

  // Assign Approvers directly (No popup form)
  const handleAssignSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (effectiveSelectedEmployeeIds.length === 0) {
      setError("Please select at least one employee using the dropdown or table checkboxes.");
      return;
    }

    if (!firstLevelApprover.trim() && !finalLevelApprover.trim() && !backupOfficer.trim()) {
      setError("Please select at least an Approver or Backup Officer.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/approver-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: effectiveSelectedEmployeeIds,
          firstLevelApprover: firstLevelApprover.trim(),
          finalLevelApprover: finalLevelApprover.trim(),
          backupOfficer: backupOfficer.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to assign approvers.");
      }

      // Update state in memory
      const targetSet = new Set(effectiveSelectedEmployeeIds);
      setEmployees((prev) =>
        prev.map((emp) =>
          targetSet.has(emp.employeeId)
            ? {
                ...emp,
                firstLevelApprover: firstLevelApprover.trim() || emp.firstLevelApprover,
                finalLevelApprover: finalLevelApprover.trim() || emp.finalLevelApprover,
                backupOfficer: backupOfficer.trim() || emp.backupOfficer,
                updatedAt: new Date().toISOString(),
              }
            : emp
        )
      );

      setSuccessMessage(
        effectiveSelectedEmployeeIds.length === 1
          ? `Settings successfully assigned for ${employees.find((e) => e.employeeId === effectiveSelectedEmployeeIds[0])?.name || effectiveSelectedEmployeeIds[0]}`
          : `Settings successfully assigned for ${effectiveSelectedEmployeeIds.length} employees.`
      );
      setTimeout(() => setSuccessMessage(""), 4500);

      // Return to normal page: Reset all filters, selections and approver fields
      setStreamFilters([]);
      setDepartmentFilters([]);
      setEmployeeNameFilters([]);
      setSelectedRowIds([]);
      setFirstLevelApprover("");
      setFinalLevelApprover("");
      setBackupOfficer("");
      setHasAssigned(true);

      // Silent background sync with database
      fetch("/api/approver-settings", { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data.employees) setEmployees(data.employees);
          if (data.approverOptions) setApproverOptions(data.approverOptions);
        })
        .catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Potential approvers list for dropdowns (strictly name only, NO ID)
  const approverListOptions = useMemo(() => {
    return [...new Set(approverOptions.map((opt) => opt.name))]
      .filter(Boolean)
      .sort()
      .map((name) => ({
        label: name,
        value: name,
      }));
  }, [approverOptions]);

  // Only enable approvers if at least one employee is selected
  const isEmployeeSelected = effectiveSelectedEmployeeIds.length > 0;

  // Clear approvers if employee selection becomes empty
  useEffect(() => {
    if (!isEmployeeSelected) {
      if (firstLevelApprover) setFirstLevelApprover("");
      if (finalLevelApprover) setFinalLevelApprover("");
      if (backupOfficer) setBackupOfficer("");
    }
  }, [isEmployeeSelected, firstLevelApprover, finalLevelApprover, backupOfficer]);

  // Is Assign Button Enabled?
  const isAssignButtonEnabled =
    isEmployeeSelected &&
    (Boolean(firstLevelApprover.trim()) ||
     Boolean(finalLevelApprover.trim()) ||
     Boolean(backupOfficer.trim())) &&
    !isSubmitting;

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="approver-settings" />

      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px]">
          {/* Header */}
          <header className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                  Approver settings
                </h1>
                <p className="text-xs font-medium text-slate-500">
                  Configure first level approvers, final level approvers, and backup officers for employees
                </p>
              </div>
            </div>

            {successMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
                <Check size={16} className="text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}
          </header>

          {/* Sequential Multi-Select Dropdowns + Approver Fields + Assign and Back Buttons */}
          <section
            aria-label="Approver filters and assignment controls"
            className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-end gap-3">
              {/* Step 1: Stream Multi-Select Dropdown with checkboxes */}
              <div className="min-w-[170px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Streams
                </label>
                <MultiSelectDropdown
                  label="Streams"
                  options={streams}
                  selectedValues={streamFilters}
                  onChange={handleStreamChange}
                />
              </div>

              {/* Step 2: Department Multi-Select Dropdown with checkboxes */}
              <div className="min-w-[170px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Departments
                </label>
                <MultiSelectDropdown
                  label="Departments"
                  options={departments}
                  selectedValues={departmentFilters}
                  onChange={handleDepartmentChange}
                />
              </div>

              {/* Step 3: Employee Multi-Select Dropdown with checkboxes (ONLY NAMES, NO IDs) */}
              <div className="min-w-[170px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Employee Names
                </label>
                <MultiSelectDropdown
                  label="Employee Names"
                  options={employeeNames}
                  selectedValues={employeeNameFilters}
                  onChange={handleEmployeeNameChange}
                />
              </div>

              {/* Step 4: First Level Approver dropdown (enabled ONLY when employee is selected) */}
              <div className="min-w-[170px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  First Level Approver
                </label>
                <SingleSelectDropdown
                  label="First Level Approver"
                  placeholder={isEmployeeSelected ? "Select Approver" : "Select Employee First"}
                  options={approverListOptions}
                  selectedValue={firstLevelApprover}
                  onChange={(val) => setFirstLevelApprover(val)}
                  disabled={!isEmployeeSelected}
                />
              </div>

              {/* Step 5: Final Level Approver dropdown (enabled ONLY when employee is selected) */}
              <div className="min-w-[170px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Final Level Approver
                </label>
                <SingleSelectDropdown
                  label="Final Level Approver"
                  placeholder={isEmployeeSelected ? "Select Approver" : "Select Employee First"}
                  options={approverListOptions}
                  selectedValue={finalLevelApprover}
                  onChange={(val) => setFinalLevelApprover(val)}
                  disabled={!isEmployeeSelected}
                />
              </div>

              {/* Step 6: Backup Officer dropdown (enabled ONLY when employee is selected) */}
              <div className="min-w-[170px] flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Backup Officer
                </label>
                <SingleSelectDropdown
                  label="Backup Officer"
                  placeholder={isEmployeeSelected ? "Select Approver" : "Select Employee First"}
                  options={approverListOptions}
                  selectedValue={backupOfficer}
                  onChange={handleBackupOfficerChange}
                  disabled={!isEmployeeSelected}
                />
              </div>

              {/* Action Button: Assign */}
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  id="assign-approver-top-button"
                  disabled={!isAssignButtonEnabled}
                  onClick={() => handleAssignSubmit()}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold shadow-sm transition-all ${
                    !isAssignButtonEnabled
                      ? "cursor-not-allowed bg-slate-200 text-slate-400"
                      : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] ring-2 ring-emerald-600/20"
                  }`}
                  title={
                    !isAssignButtonEnabled
                      ? !isEmployeeSelected
                        ? "Select an employee first (using Employee Names or table checkboxes)"
                        : "Select First Level, Final Level Approver, or Backup Officer"
                      : `Assign approvers for ${effectiveSelectedEmployeeIds.length} employee(s)`
                  }
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <UserCheck size={18} />
                  )}
                  <span>
                    Assign
                    {effectiveSelectedEmployeeIds.length > 0 && ` (${effectiveSelectedEmployeeIds.length})`}
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* Table Container */}
          <main className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Table Utility Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Users size={18} className="text-slate-500" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                  Employees Approver List
                </h2>
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {visibleEmployees.length} of {employees.length}
                </span>
                {selectedRowIds.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    {selectedRowIds.length === 1 ? "1 employee selected (Editing)" : `${selectedRowIds.length} selected`}
                  </span>
                )}
              </div>

              {selectedRowIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors"
                >
                  <X size={13} />
                  <span>Clear selection</span>
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-600 font-semibold">
                  <tr>
                    {/* Checkbox Column before Employee ID */}
                    <th scope="col" className="w-12 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeVisibleSelected;
                        }}
                        onChange={handleToggleSelectAll}
                        className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                        title={isAllVisibleSelected ? "Deselect all" : "Select all visible"}
                      />
                    </th>
                    <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                      Employee ID
                    </th>
                    <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                      <SortHeaderButton
                        label="Employee Name"
                        columnKey="name"
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                      Stream &amp; Department
                    </th>
                    <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                      <SortHeaderButton
                        label="First Level Approver"
                        columnKey="firstLevelApprover"
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                      <SortHeaderButton
                        label="Final Level Approver"
                        columnKey="finalLevelApprover"
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                      <SortHeaderButton
                        label="Backup Officer"
                        columnKey="backupOfficer"
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                          <span>Loading approver settings...</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!isLoading && visibleEmployees.length > 0 && (
                    visibleEmployees.map((emp) => {
                      const isChecked = selectedRowIds.includes(emp.employeeId);

                      return (
                        <tr
                          key={emp.employeeId}
                          onClick={() => handleToggleRow(emp.employeeId)}
                          className={`transition-colors cursor-pointer hover:bg-slate-50/80 ${
                            isChecked
                              ? "bg-emerald-50/60 ring-1 ring-inset ring-emerald-500/20"
                              : ""
                          }`}
                        >
                          {/* Checkbox Column before Employee ID */}
                          <td
                            className="w-12 px-4 py-4 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRow(emp.employeeId)}
                              className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                            />
                          </td>

                          {/* 1. Employee ID */}
                          <td className="whitespace-nowrap px-6 py-4 font-mono text-xs font-semibold text-slate-700">
                            {emp.employeeId}
                          </td>

                          {/* 2. Employee Name */}
                          <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                            <span className="flex items-center gap-2">
                              {emp.name}
                              {isChecked && (
                                <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                                  Selected
                                </span>
                              )}
                            </span>
                          </td>

                          {/* 3. Stream & Department formatted as stream-department */}
                          <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {emp.stream}-{emp.department}
                            </span>
                          </td>

                          {/* 4. First Level Approver */}
                          <td className="whitespace-nowrap px-6 py-4">
                            {emp.firstLevelApprover ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                {emp.firstLevelApprover}
                              </span>
                            ) : (
                              <span className="font-mono text-sm font-semibold text-slate-400">
                                --
                              </span>
                            )}
                          </td>

                          {/* 5. Final Level Approver */}
                          <td className="whitespace-nowrap px-6 py-4">
                            {emp.finalLevelApprover ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                {emp.finalLevelApprover}
                              </span>
                            ) : (
                              <span className="font-mono text-sm font-semibold text-slate-400">
                                --
                              </span>
                            )}
                          </td>

                          {/* 6. Backup Officer */}
                          <td className="whitespace-nowrap px-6 py-4">
                            {emp.backupOfficer ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                                <span className="h-2 w-2 rounded-full bg-purple-500" />
                                {emp.backupOfficer}
                              </span>
                            ) : (
                              <span className="font-mono text-sm font-semibold text-slate-400">
                                --
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {!isLoading && visibleEmployees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        {employees.length === 0
                          ? "No employees found in the database."
                          : "No employees match the selected filters."}
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
