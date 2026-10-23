"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Filter,
  Info,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";
import type { CycleInfo, LeaveRuleConfig } from "@/lib/leave-year-end";

/* ─── Types ────────────────────────────────────────────────────────── */

type EmployeeSummary = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  employeeType: string;
  employmentType: string;
  totalLeaveTypes: number;
  totalCarryForward: number;
  isAlreadyProcessed: boolean;
};

type PreviewRecord = {
  employeeId: string;
  employeeName: string;
  department: string;
  stream: string;
  employeeType: string;
  employmentType: string;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  currentCycle: string;
  nextCycle: string;
  entitlement: number;
  leaveUsed: number;
  availableBalance: number;
  rule: "CARRY_FORWARD" | "RESET";
  maxCarryForward: number | null;
  carriedForwardDays: number;
  proposedOpeningBalance: number;
  isEligible: boolean;
  isAlreadyProcessed: boolean;
  carryForward?: boolean;
};


type ProcessResult = {
  processId: number;
  currentCycle: string;
  nextCycle: string;
  processedAt: string;
  processedBy: string;
  totalEmployees: number;
  totalBalancesCreated: number;
  totalCarriedForward: number;
  totalReset: number;
  totalSkipped: number;
  totalFailed: number;
};

type RecordResult = {
  employeeId: string;
  employeeName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  rule: string;
  carriedForwardDays: number;
  proposedOpeningBalance: number;
  status: "SUCCESS" | "SKIPPED" | "FAILED";
  reason?: string;
};

type PreviewSortField =
  | "employeeId"
  | "employeeName"
  | "department"
  | "leaveType"
  | "entitlement"
  | "leaveUsed"
  | "availableBalance"
  | "rule"
  | "carriedForwardDays"
  | "proposedOpeningBalance"
  | "status";

type SortDirection = "asc" | "desc" | null;

function SortHeaderButton({
  label,
  columnKey,
  sortField,
  sortDirection,
  onSort,
  align = "left",
}: {
  label: string;
  columnKey: PreviewSortField;
  sortField: PreviewSortField | null;
  sortDirection: SortDirection;
  onSort: (field: PreviewSortField) => void;
  align?: "left" | "right" | "center";
}) {
  const isCurrent = sortField === columnKey;
  const isAsc = isCurrent && sortDirection === "asc";
  const isDesc = isCurrent && sortDirection === "desc";

  const arrowIcon = (
    <span className="inline-flex shrink-0 items-center justify-center">
      {isAsc ? (
        <ArrowUp size={12} className="text-emerald-600 stroke-[2.5]" />
      ) : isDesc ? (
        <ArrowDown size={12} className="text-emerald-600 stroke-[2.5]" />
      ) : (
        <ArrowUpDown size={12} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
      )}
    </span>
  );

  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className={`group inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-tight cursor-pointer select-none ${
        align === "right"
          ? "justify-end w-full"
          : align === "center"
          ? "justify-center w-full"
          : "justify-start text-left"
      }`}
      title={
        !isCurrent || !sortDirection
          ? `Sort by ${label} (Ascending)`
          : isAsc
          ? `Sort by ${label} (Descending)`
          : `Reset sorting`
      }
    >
      {align === "right" && arrowIcon}
      <span className="whitespace-nowrap">{label}</span>
      {align !== "right" && arrowIcon}
    </button>
  );
}

export default function LeaveYearEndPage() {
  const [cycles, setCycles] = useState<CycleInfo[]>([]);
  const [currentCycleCode, setCurrentCycleCode] = useState<string>("2025-2026");
  const [nextCycleCode, setNextCycleCode] = useState<string>("2026-2027");

  // Filter options
  const [streamOptions, setStreamOptions] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [employeeTypeOptions, setEmployeeTypeOptions] = useState<string[]>([]);
  const [employmentTypeOptions, setEmploymentTypeOptions] = useState<string[]>([]);

  // Selected filters
  const [selectedStream, setSelectedStream] = useState<string>("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [selectedEmployeeType, setSelectedEmployeeType] = useState<string>("ALL");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [previewRecords, setPreviewRecords] = useState<PreviewRecord[]>([]);
  const [rules, setRules] = useState<LeaveRuleConfig[]>([]);

  // Selection for execution
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmedAcknowledgement, setConfirmedAcknowledgement] = useState<boolean>(false);

  // Completed Process Summary Modal
  const [completedSummary, setCompletedSummary] = useState<ProcessResult | null>(null);
  const [summaryRecords, setSummaryRecords] = useState<RecordResult[]>([]);
  const [summaryFilter, setSummaryFilter] = useState<"ALL" | "SUCCESS" | "SKIPPED">("ALL");

  // Load preview data
  const loadData = async (currCycle = currentCycleCode, nxtCycle = nextCycleCode, showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const params = new URLSearchParams({
        currentCycle: currCycle,
        nextCycle: nxtCycle,
      });

      const response = await fetch(`/api/leave-year-end?${params.toString()}`, { cache: "no-store" });
      setError("");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load year-end preview.");
      }

      setCycles(data.cycles || []);
      setStreamOptions(data.filters?.streams || []);
      setDepartmentOptions(data.filters?.departments || []);
      setEmployeeTypeOptions(data.filters?.employeeTypes || ["Teaching", "Non-Teaching"]);
      setEmploymentTypeOptions(data.filters?.employmentTypes || ["Permanent", "Contract", "Temporary", "Probation"]);
      setEmployees(data.employees || []);
      setPreviewRecords(data.previewRecords || []);
      setRules(data.rules || []);

      // Auto-select all unprocessed employees by default
      const selectableIds = (data.employees || [])
        .map((e: EmployeeSummary) => e.employeeId);
      setSelectedEmployeeIds(selectableIds);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const response = await fetch("/api/leave-year-end?currentCycle=2025-2026&nextCycle=2026-2027", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load year-end preview.");
        if (!mounted) return;
        setCycles(data.cycles || []);
        setStreamOptions(data.filters?.streams || []);
        setDepartmentOptions(data.filters?.departments || []);
        setEmployeeTypeOptions(data.filters?.employeeTypes || ["Teaching", "Non-Teaching"]);
        setEmploymentTypeOptions(data.filters?.employmentTypes || ["Permanent", "Contract", "Temporary", "Probation"]);
        setEmployees(data.employees || []);
        setPreviewRecords(data.previewRecords || []);
        setRules(data.rules || []);
        const selectableIds = (data.employees || []).map((e: EmployeeSummary) => e.employeeId);
        setSelectedEmployeeIds(selectableIds);
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load data.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  // Handle cycle change
  const handleCurrentCycleChange = (newCurrentCycle: string) => {
    setCurrentCycleCode(newCurrentCycle);
    // Derive next cycle
    const parts = newCurrentCycle.split("-");
    let nextCode = "2026-2027";
    if (parts.length === 2) {
      const startYear = parseInt(parts[0], 10);
      const endYear = parseInt(parts[1], 10);
      if (!Number.isNaN(startYear) && !Number.isNaN(endYear)) {
        nextCode = `${startYear + 1}-${endYear + 1}`;
      }
    }
    setNextCycleCode(nextCode);
    void loadData(newCurrentCycle, nextCode);
  };

  const handleNextCycleChange = (newNextCycle: string) => {
    setNextCycleCode(newNextCycle);
    void loadData(currentCycleCode, newNextCycle);
  };


  // Dynamic preview records with any active rule modifications
  const dynamicPreviewRecords = useMemo(() => {
    const ruleLookup = new Map(rules.map((r) => [r.leaveTypeId, r]));

    return previewRecords.map((record) => {
      const activeRule = ruleLookup.get(record.leaveTypeId);
      if (!activeRule) return record;

      const rule = activeRule.rule;
      const maxLimit = activeRule.maxCarryForwardDays;

      let carriedForwardDays = 0;
      if (rule === "CARRY_FORWARD") {
        carriedForwardDays = maxLimit !== null ? Math.min(record.availableBalance, maxLimit) : record.availableBalance;
      }

      const proposedOpeningBalance = record.isEligible ? carriedForwardDays + record.entitlement : 0;

      return {
        ...record,
        rule,
        maxCarryForward: maxLimit,
        carriedForwardDays,
        proposedOpeningBalance,
      };
    });
  }, [previewRecords, rules]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (selectedStream !== "ALL" && emp.stream !== selectedStream) return false;
      if (selectedDepartment !== "ALL" && emp.department !== selectedDepartment) return false;
      if (selectedEmployeeType !== "ALL" && emp.employeeType !== selectedEmployeeType) return false;
      if (selectedEmploymentType !== "ALL" && emp.employmentType !== selectedEmploymentType) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = emp.name.toLowerCase().includes(query);
        const matchesId = emp.employeeId.toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });
  }, [employees, selectedStream, selectedDepartment, selectedEmployeeType, selectedEmploymentType, searchQuery]);

  const filteredEmployeeIds = useMemo(() => {
    return new Set(filteredEmployees.map((e) => e.employeeId));
  }, [filteredEmployees]);

  // Column sorting state
  const [sortField, setSortField] = useState<PreviewSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: PreviewSortField) => {
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

  // Filtered & sorted preview records based on current filters and sorting
  const visiblePreviewRecords = useMemo(() => {
    const list = dynamicPreviewRecords.filter((rec) => filteredEmployeeIds.has(rec.employeeId));

    if (!sortField || !sortDirection) {
      return list;
    }

    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "employeeId":
          comparison = a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true });
          break;
        case "employeeName":
          comparison = a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: "base" });
          break;
        case "department": {
          const valA = `${a.stream}-${a.department}`;
          const valB = `${b.stream}-${b.department}`;
          comparison = valA.localeCompare(valB, undefined, { sensitivity: "base" });
          break;
        }
        case "leaveType": {
          const valA = `${a.leaveTypeCode}-${a.leaveTypeName}`;
          const valB = `${b.leaveTypeCode}-${b.leaveTypeName}`;
          comparison = valA.localeCompare(valB, undefined, { sensitivity: "base" });
          break;
        }
        case "entitlement":
          comparison = a.entitlement - b.entitlement;
          break;
        case "leaveUsed":
          comparison = a.leaveUsed - b.leaveUsed;
          break;
        case "availableBalance":
          comparison = a.availableBalance - b.availableBalance;
          break;
        case "rule":
          comparison = a.rule.localeCompare(b.rule);
          break;
        case "carriedForwardDays":
          comparison = a.carriedForwardDays - b.carriedForwardDays;
          break;
        case "proposedOpeningBalance":
          comparison = a.proposedOpeningBalance - b.proposedOpeningBalance;
          break;
        case "status":
          comparison = Number(a.isAlreadyProcessed) - Number(b.isAlreadyProcessed);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [dynamicPreviewRecords, filteredEmployeeIds, sortField, sortDirection]);

  // Master Checkbox Toggle for Visible Table Rows
  const isAllVisibleSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((e) => selectedEmployeeIds.includes(e.employeeId));

  const isSomeVisibleSelected =
    filteredEmployees.some((e) => selectedEmployeeIds.includes(e.employeeId)) &&
    !isAllVisibleSelected;

  // Selection handlers
  const handleSelectAll = () => {
    const allFiltered = filteredEmployees.map((e) => e.employeeId);
    if (isAllVisibleSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !allFiltered.includes(id)));
    } else {
      setSelectedEmployeeIds((prev) => Array.from(new Set([...prev, ...allFiltered])));
    }
  };

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Execution
  const handleExecuteProcess = async () => {
    if (!confirmedAcknowledgement) return;
    setIsProcessing(true);
    setError("");

    try {
      const payload = {
        currentCycle: currentCycleCode,
        nextCycle: nextCycleCode,
        employeeIds: selectedEmployeeIds,
        rules: rules.map((r) => ({
          leaveTypeId: r.leaveTypeId,
          rule: r.rule,
          maxCarryForwardDays: r.maxCarryForwardDays,
        })),
        processedBy: "Administrator",
      };

      const response = await fetch("/api/leave-year-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to execute year-end leave process.");
      }

      setCompletedSummary(data.summary);
      setSummaryRecords(data.records || []);
      setShowConfirmModal(false);
      setConfirmedAcknowledgement(false);

      // Refresh data
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error executing process.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const selectedRecords = visiblePreviewRecords.filter((r) => selectedEmployeeIds.includes(r.employeeId));
    const totalCarryForward = selectedRecords.reduce((sum, r) => sum + r.carriedForwardDays, 0);
    const totalReset = selectedRecords.filter((r) => r.rule === "RESET").length;
    const alreadyProcessed = selectedRecords.filter((r) => r.isAlreadyProcessed).length;

    return {
      selectedCount: selectedEmployeeIds.filter((id) => filteredEmployeeIds.has(id)).length,
      recordsCount: selectedRecords.length,
      totalCarryForward,
      totalReset,
      alreadyProcessed,
    };
  }, [visiblePreviewRecords, selectedEmployeeIds, filteredEmployeeIds]);

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="leave-year-end" />

      <main className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1440px] space-y-4">
          {/* Header */}
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Leave Settings
                </p>
                <h1 className="text-3xl font-bold text-slate-800">Leave Year-End Process</h1>
              </div>
            </div>
          </header>

          {/* Cycle Selection & College Regulation Info Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CalendarDays size={18} className="text-emerald-700" />
                <span>Academic Leave Cycle Configuration</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Current Leave Cycle Dropdown */}
              <div>
                <label htmlFor="currentCycle" className="mb-1.5 block text-xs font-bold uppercase text-slate-700">
                  Current Leave Cycle <span className="font-normal text-slate-500">(Closing Cycle)</span>
                </label>
                <div className="relative">
                  <select
                    id="currentCycle"
                    value={currentCycleCode}
                    onChange={(e) => handleCurrentCycleChange(e.target.value)}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 px-3.5 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white"
                  >
                    {cycles.map((cycle) => (
                      <option key={cycle.code} value={cycle.code}>
                        {cycle.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              {/* Next Leave Cycle Dropdown */}
              <div>
                <label htmlFor="nextCycle" className="mb-1.5 block text-xs font-bold uppercase text-slate-700">
                  Next Leave Cycle <span className="font-normal text-slate-500">(New Opening Cycle)</span>
                </label>
                <div className="relative">
                  <select
                    id="nextCycle"
                    value={nextCycleCode}
                    onChange={(e) => handleNextCycleChange(e.target.value)}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 px-3.5 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white"
                  >
                    {cycles.map((cycle) => (
                      <option key={cycle.code} value={cycle.code}>
                        {cycle.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              {/* Cycle Flow Indicator Banner */}
              <div className="flex flex-col justify-center rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-900 md:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                  <Info size={15} />
                  <span>Cycle Transition Rule</span>
                </div>
                <p className="mt-1 text-slate-600">
                  Balances remaining as of May 31, {currentCycleCode.split("-")[1] || "2026"} will be evaluated. Eligible
                  earned leaves transfer to June 1, {nextCycleCode.split("-")[0] || "2026"}.
                </p>
              </div>
            </div>
          </section>

          {/* Employee Filters Bar */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
              <span className="flex items-center gap-1.5">
                <Filter size={15} className="text-emerald-700" />
                Filter Employees to Include in Year-End Process
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedStream("ALL");
                  setSelectedDepartment("ALL");
                  setSelectedEmployeeType("ALL");
                  setSelectedEmploymentType("ALL");
                  setSearchQuery("");
                }}
                className="text-xs font-medium text-emerald-800 hover:underline"
              >
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* All Streams Dropdown */}
              <div>
                <label htmlFor="streamFilter" className="mb-1 block text-xs font-medium text-slate-600">Stream</label>
                <div className="relative">
                  <select
                    id="streamFilter"
                    value={selectedStream}
                    onChange={(e) => setSelectedStream(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600"
                  >
                    <option value="ALL">All Streams</option>
                    {streamOptions.map((stream) => (
                      <option key={stream} value={stream}>{stream}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Department Dropdown */}
              <div>
                <label htmlFor="deptFilter" className="mb-1 block text-xs font-medium text-slate-600">Department</label>
                <div className="relative">
                  <select
                    id="deptFilter"
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600"
                  >
                    <option value="ALL">All Departments</option>
                    {departmentOptions.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Employee Type Dropdown */}
              <div>
                <label htmlFor="empTypeFilter" className="mb-1 block text-xs font-medium text-slate-600">Employee Type</label>
                <div className="relative">
                  <select
                    id="empTypeFilter"
                    value={selectedEmployeeType}
                    onChange={(e) => setSelectedEmployeeType(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600"
                  >
                    <option value="ALL">All Employee Types</option>
                    {employeeTypeOptions.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Employment Type Dropdown */}
              <div>
                <label htmlFor="employmentTypeFilter" className="mb-1 block text-xs font-medium text-slate-600">Employment Type</label>
                <div className="relative">
                  <select
                    id="employmentTypeFilter"
                    value={selectedEmploymentType}
                    onChange={(e) => setSelectedEmploymentType(e.target.value)}
                    className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-8 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600"
                  >
                    <option value="ALL">All Employment Types</option>
                    {employmentTypeOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Employee Search */}
              <div>
                <label htmlFor="searchEmployee" className="mb-1 block text-xs font-medium text-slate-600">Search Employee</label>
                <div className="relative">
                  <input
                    id="searchEmployee"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or ID..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs outline-none focus:border-emerald-600"
                  />
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </section>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Preview Next-Cycle Balances ({visiblePreviewRecords.length})
            </h2>

            {/* Main Action: Process Year-End */}
            <button
              type="button"
              disabled={metrics.selectedCount === 0 || isLoading || isProcessing}
              onClick={() => {
                setConfirmedAcknowledgement(false);
                setShowConfirmModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <CalendarCheck size={18} />
              Process Year-End ({metrics.selectedCount} Employees)
            </button>
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <XCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Detailed Preview Table */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* Table Utility Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Users size={18} className="text-slate-500" />
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                    Next Cycle Opening Balance Preview ({currentCycleCode} → {nextCycleCode})
                  </h2>
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {visiblePreviewRecords.length} records
                  </span>
                  {selectedEmployeeIds.length > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      {selectedEmployeeIds.filter((id) => filteredEmployeeIds.has(id)).length} employees selected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {selectedEmployeeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeIds([])}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors"
                    >
                      <X size={13} />
                      <span>Clear selection</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase text-slate-700 transition hover:bg-slate-50"
                  >
                    {isAllVisibleSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Loader2 size={32} className="animate-spin text-emerald-700" />
                  <p className="mt-3 text-sm">Calculating year-end leave preview from database...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-left text-xs align-middle">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-tight text-slate-600 font-semibold">
                      <tr>
                        <th scope="col" className="w-10 px-3 py-3 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={isAllVisibleSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeVisibleSelected;
                            }}
                            onChange={handleSelectAll}
                            className="size-3.5 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer align-middle"
                            title={isAllVisibleSelected ? "Deselect all" : "Select all visible"}
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-left align-middle">
                          <SortHeaderButton
                            label="Employee ID"
                            columnKey="employeeId"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="left"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-left align-middle">
                          <SortHeaderButton
                            label="Employee Name"
                            columnKey="employeeName"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="left"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-left align-middle">
                          <SortHeaderButton
                            label="Stream & Department"
                            columnKey="department"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="left"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-left align-middle">
                          <SortHeaderButton
                            label="Leave Type"
                            columnKey="leaveType"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="left"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-right align-middle">
                          <SortHeaderButton
                            label="Entitlement"
                            columnKey="entitlement"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="right"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-right align-middle">
                          <SortHeaderButton
                            label={`Used (${currentCycleCode})`}
                            columnKey="leaveUsed"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="right"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-right align-middle">
                          <SortHeaderButton
                            label="Available Balance"
                            columnKey="availableBalance"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="right"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-right align-middle">
                          <SortHeaderButton
                            label="Carried Forward"
                            columnKey="carriedForwardDays"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="right"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-right align-middle">
                          <SortHeaderButton
                            label={`Proposed Opening (${nextCycleCode})`}
                            columnKey="proposedOpeningBalance"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="right"
                          />
                        </th>
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-center align-middle">
                          <SortHeaderButton
                            label="Status"
                            columnKey="status"
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                            align="center"
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {visiblePreviewRecords.map((record) => {
                        const isSelected = selectedEmployeeIds.includes(record.employeeId);
                        return (
                          <tr
                            key={`${record.employeeId}-${record.leaveTypeId}`}
                            className={`transition-colors hover:bg-slate-50/80 ${
                              isSelected ? "bg-emerald-50/30" : ""
                            }`}
                          >
                            <td className="w-10 px-3 py-3 text-center align-middle">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleEmployee(record.employeeId)}
                                className="size-3.5 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer align-middle"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-left align-middle font-mono text-xs font-semibold text-slate-700">
                              {record.employeeId}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-left align-middle font-semibold text-slate-800">
                              {record.employeeName}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-left align-middle">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {record.stream}-{record.department}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-left align-middle">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                <span>{record.leaveTypeCode} - {record.leaveTypeName}</span>
                                {record.rule === "CARRY_FORWARD" && (
                                  <span className="font-semibold text-emerald-700">
                                    (Carry Forward)
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-slate-700">
                              <span className="font-mono font-semibold">{record.entitlement}</span>{" "}
                              <span className="text-[11px] text-slate-400">days</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-rose-600">
                              <span className="font-mono font-semibold">{record.leaveUsed}</span>{" "}
                              <span className="text-[11px] text-slate-400">days</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right align-middle text-slate-800">
                              <span className="font-mono font-bold">{record.availableBalance}</span>{" "}
                              <span className="text-[11px] text-slate-400">days</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right align-middle">
                              <span
                                className={`font-mono font-bold ${
                                  record.carriedForwardDays > 0 ? "text-emerald-700" : "text-slate-400"
                                }`}
                              >
                                {record.carriedForwardDays > 0 ? `+${record.carriedForwardDays}` : "0"}
                              </span>{" "}
                              <span className="text-[11px] text-slate-400">days</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-right align-middle">
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900 border border-emerald-200">
                                <span className="font-mono">{record.proposedOpeningBalance}</span>{" "}
                                <span className="text-[10px] font-normal text-emerald-700">days</span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-center align-middle">
                              {record.isAlreadyProcessed ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-800">
                                  <span className="size-1.5 rounded-full bg-amber-500" />
                                  Already Processed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800">
                                  <span className="size-1.5 rounded-full bg-emerald-600" />
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {visiblePreviewRecords.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-6 py-12 text-center text-slate-400 align-middle">
                            No employee records match the selected filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
        </div>
      </main>

      {/* ── Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Confirm Leave Year-End Process</h3>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Closing Cycle:</span>
                <span className="font-semibold text-slate-800">{currentCycleCode}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Next Cycle (Opening):</span>
                <span className="font-semibold text-emerald-800">{nextCycleCode}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Selected Employees:</span>
                <span className="font-bold text-slate-800">{metrics.selectedCount} staff members</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-2">
                <span className="text-slate-500">Balances to Create:</span>
                <span className="font-bold text-slate-800">{metrics.recordsCount} records</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Days Carried Forward:</span>
                <span className="font-bold text-emerald-700">+{metrics.totalCarryForward} days</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert size={15} />
                <span>Validation and Safety Notice</span>
              </div>
              <p className="mt-1">
                This action preserves all historical leave applications and creates official opening balances for cycle{" "}
                <strong className="font-bold">{nextCycleCode}</strong>.
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2.5">
              <input
                id="ackCheck"
                type="checkbox"
                checked={confirmedAcknowledgement}
                onChange={(e) => setConfirmedAcknowledgement(e.target.checked)}
                className="mt-0.5 size-4 accent-emerald-700"
              />
              <label htmlFor="ackCheck" className="cursor-pointer text-xs font-medium text-slate-700">
                I confirm the execution of the Year-End Leave Rollover for the selected employees from cycle{" "}
                {currentCycleCode} to {nextCycleCode}.
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isProcessing}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold uppercase text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleExecuteProcess()}
                disabled={!confirmedAcknowledgement || isProcessing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold uppercase text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {isProcessing && <Loader2 size={14} className="animate-spin" />}
                {isProcessing ? "Processing..." : "Confirm & Process Year-End"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Summary & Output Modal (Matches User Expected Output Format) ── */}
      {completedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Leave Year-End Process Completed</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompletedSummary(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Exactly Expected Output KPI Cards */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Employees</span>
                <p className="mt-1 text-2xl font-black text-slate-800">{completedSummary.totalEmployees}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Balances Created</span>
                <p className="mt-1 text-2xl font-black text-emerald-700">{completedSummary.totalBalancesCreated}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Carried Forward</span>
                <p className="mt-1 text-2xl font-black text-emerald-700">+{completedSummary.totalCarriedForward}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Leave Types Reset</span>
                <p className="mt-1 text-2xl font-black text-blue-700">{completedSummary.totalReset}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Skipped Records</span>
                <p className="mt-1 text-2xl font-black text-amber-700">{completedSummary.totalSkipped}</p>
              </div>
            </div>

            {/* Records Breakdown */}
            <div className="mt-4 flex flex-1 flex-col overflow-hidden">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-700">Processed Records Breakdown</span>
                <div className="flex gap-1">
                  {(["ALL", "SUCCESS", "SKIPPED"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSummaryFilter(tab)}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold uppercase ${
                        summaryFilter === tab ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Employee</th>
                      <th className="px-3 py-2">Leave Type</th>
                      <th className="px-3 py-2">Rule</th>
                      <th className="px-3 py-2 text-right">Carried</th>
                      <th className="px-3 py-2 text-right">Opening Balance</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaryRecords
                      .filter((r) => summaryFilter === "ALL" || r.status === summaryFilter)
                      .map((rec, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {rec.employeeName}{" "}
                            <span className="font-mono text-[10px] text-slate-400">({rec.employeeId})</span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {rec.leaveTypeCode} - {rec.leaveTypeName}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-[11px] font-semibold text-slate-600">{rec.rule}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">
                            +{rec.carriedForwardDays}
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold text-slate-900">
                            {rec.proposedOpeningBalance} days
                          </td>
                          <td className="px-3 py-2 text-center">
                            {rec.status === "SUCCESS" ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                SUCCESS
                              </span>
                            ) : (
                              <span
                                title={rec.reason}
                                className="inline-flex cursor-help rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                              >
                                SKIPPED
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setCompletedSummary(null)}
                className="rounded-xl bg-slate-800 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-900"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
