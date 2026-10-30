"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  Loader2,
  RotateCcw,
  Save,
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


type LeaveTypeItem = {
  id: number;
  code: string;
  name: string;
  carryForward: boolean;
  daysAllowed: number;
  status: string;
  leaveGroup?: string;
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
  entitlement?: number;
  carriedForwardDays: number;
  proposedOpeningBalance: number;
  status: "SUCCESS" | "SKIPPED" | "FAILED";
  reason?: string;
};

type CarryForwardLeaveColumnData = {
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  taken: number;
  eligible: number;
  bf: number;
  total: number;
  proposedBf: number;
  closingBalance: number;
  isTickedForProcess: boolean;
  isProcessedInDb: boolean;
};

type EmployeeEntitlementMap = Record<
  string, // employeeId
  Record<
    number, // leaveTypeId
    {
      leaveTypeId: number;
      leaveTypeCode: string;
      leaveTypeName: string;
      taken: number;
      eligible: number;
      bf: number;
      credited?: number;
      credit?: number;
      balance: number;
      total: number;
      isCarryForward: boolean;
    }
  >
>;

type EmployeeYearEndRow = {
  employeeId: string;
  employeeName: string;
  department: string;
  stream: string;
  employeeType: string;
  employmentType: string;
  carryForwardLeaves: Record<number, CarryForwardLeaveColumnData>;
  carriedForwardDays: number;
  proposedOpeningBalance: number;
  isAlreadyProcessed: boolean;
};

type PreviewSortField =
  | "employeeId"
  | "employeeName"
  | "department"
  | string;

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
      className={`group inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition-colors uppercase tracking-tight cursor-pointer select-none ${align === "right"
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
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("ALL");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState<string>("");
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState<boolean>(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  // Data
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [previewRecords, setPreviewRecords] = useState<PreviewRecord[]>([]);
  const [rules, setRules] = useState<LeaveRuleConfig[]>([]);

  // Selection for execution
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Leave types from database
  const [leaveTypesList, setLeaveTypesList] = useState<LeaveTypeItem[]>([]);
  const [selectedCarryForwardLeaveTypeIds, setSelectedCarryForwardLeaveTypeIds] = useState<number[]>([]);

  // Rollback state
  const [hasProceeded, setHasProceeded] = useState<boolean>(false);
  const [sessionProcessedEmployeeIds, setSessionProcessedEmployeeIds] = useState<string[]>([]);
  const [rollingBackEmployeeId, setRollingBackEmployeeId] = useState<string | null>(null);
  const [rolledBackEmployeeIds, setRolledBackEmployeeIds] = useState<string[]>([]);
  const [isRollingBackAll, setIsRollingBackAll] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [isDeclarationConfirmed, setIsDeclarationConfirmed] = useState<boolean>(false);

  // Processed preview mode
  const [isProcessedPreview, setIsProcessedPreview] = useState<boolean>(false);

  // Pagination state (default: 10 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Entitlement page details cache by employeeId and leaveTypeId
  const [entitlementDetails, setEntitlementDetails] = useState<EmployeeEntitlementMap>({});

  const parseEntitlementDetails = (eligData: any): EmployeeEntitlementMap => {
    const detailsMap: EmployeeEntitlementMap = {};
    const leaveTypes: any[] = eligData?.leaveTypes || [];
    const ltMap = new Map<number, any>(leaveTypes.map((t: any) => [t.id, t]));

    for (const emp of eligData?.employees || []) {
      const empMap: Record<number, any> = {};
      for (const rec of emp.leaveRecords || []) {
        const lt = ltMap.get(rec.leaveTypeId);
        const eligible = Number(rec?.daysAllowed > 0 ? rec.daysAllowed : (lt?.daysAllowed ?? 0)) || 0;
        const bf = Number(rec?.bf) || 0;
        const credit = Number(rec?.creditedDays ?? rec?.credited ?? rec?.credit ?? 0);
        const taken = Number(rec?.taken) || 0;
        const balance = Math.max(0, (eligible + bf + credit) - taken);
        const total = Number(rec?.total !== undefined ? rec.total : balance) || 0;
        const isCarry = Boolean(lt?.carryForward);

        empMap[rec.leaveTypeId] = {
          leaveTypeId: rec.leaveTypeId,
          leaveTypeCode: lt?.code || String(rec.leaveTypeId),
          leaveTypeName: lt?.name || "Leave",
          taken,
          eligible,
          bf,
          credit,
          credited: credit,
          balance,
          total,
          isCarryForward: isCarry,
        };
      }
      detailsMap[emp.employeeId] = empMap;
    }
    return detailsMap;
  };

  // Load preview data
  const loadData = async (
    currCycle = currentCycleCode,
    nxtCycle = nextCycleCode,
    showLoading = true,
    preserveSelection = false
  ) => {
    try {
      if (showLoading) setIsLoading(true);
      const params = new URLSearchParams({
        currentCycle: currCycle,
        nextCycle: nxtCycle,
      });

      const [response, eligResponse] = await Promise.all([
        fetch(`/api/leave-year-end?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/leave-eligibility", { cache: "no-store" }),
      ]);
      setError("");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load year-end preview.");
      }

      if (eligResponse.ok) {
        const eligData = await eligResponse.json();
        setEntitlementDetails(parseEntitlementDetails(eligData));
      }

      setCycles(data.cycles || []);
      setStreamOptions(data.filters?.streams || []);
      setDepartmentOptions(data.filters?.departments || []);
      setEmployeeTypeOptions(data.filters?.employeeTypes || ["Teaching", "Non-Teaching"]);
      setEmploymentTypeOptions(data.filters?.employmentTypes || ["Permanent", "Contract", "Temporary", "Probation"]);
      setEmployees(data.employees || []);
      setPreviewRecords(data.previewRecords || []);
      setRules(data.rules || []);
      setLeaveTypesList(data.leaveTypes || []);
      const cfTypes = (data.leaveTypes || []).filter((lt: any) => Boolean(lt.carryForward));
      setSelectedCarryForwardLeaveTypeIds((prev) => (prev.length > 0 ? prev : cfTypes.map((lt: any) => lt.id)));

      if (!preserveSelection) {
        // Auto-select all unprocessed employees by default
        const selectableIds = (data.employees || [])
          .filter((e: EmployeeSummary) => !e.isAlreadyProcessed)
          .map((e: EmployeeSummary) => e.employeeId);
        setSelectedEmployeeIds(selectableIds);
      }
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
        const [response, eligResponse] = await Promise.all([
          fetch("/api/leave-year-end?currentCycle=2025-2026&nextCycle=2026-2027", { cache: "no-store" }),
          fetch("/api/leave-eligibility", { cache: "no-store" }),
        ]);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load year-end preview.");
        if (!mounted) return;

        if (eligResponse.ok) {
          const eligData = await eligResponse.json();
          setEntitlementDetails(parseEntitlementDetails(eligData));
        }

        setCycles(data.cycles || []);
        setStreamOptions(data.filters?.streams || []);
        setDepartmentOptions(data.filters?.departments || []);
        setEmployeeTypeOptions(data.filters?.employeeTypes || ["Teaching", "Non-Teaching"]);
        setEmploymentTypeOptions(data.filters?.employmentTypes || ["Permanent", "Contract", "Temporary", "Probation"]);
        setEmployees(data.employees || []);
        setPreviewRecords(data.previewRecords || []);
        setRules(data.rules || []);
        setLeaveTypesList(data.leaveTypes || []);
        const cfTypes = (data.leaveTypes || []).filter((lt: any) => Boolean(lt.carryForward));
        setSelectedCarryForwardLeaveTypeIds(cfTypes.map((lt: any) => lt.id));
        const selectableIds = (data.employees || [])
          .filter((e: EmployeeSummary) => !e.isAlreadyProcessed)
          .map((e: EmployeeSummary) => e.employeeId);
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
      const isTicked = selectedCarryForwardLeaveTypeIds.includes(record.leaveTypeId);
      const rule = isTicked ? (activeRule?.rule || "CARRY_FORWARD") : "RESET";
      const maxLimit = activeRule?.maxCarryForwardDays ?? null;

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
  }, [previewRecords, rules, selectedCarryForwardLeaveTypeIds]);

  // Close employee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filtered employees
  const employeeFilterOptions = useMemo(() => {
    return employees.filter((emp) => {
      if (selectedStream !== "ALL" && emp.stream !== selectedStream) return false;
      if (selectedDepartment !== "ALL" && emp.department !== selectedDepartment) return false;
      if (selectedEmployeeType !== "ALL" && emp.employeeType !== selectedEmployeeType) return false;

      if (employeeSearchTerm.trim() && selectedEmployeeFilter === "ALL") {
        const q = employeeSearchTerm.trim().toLowerCase();
        const formatted = `${emp.employeeId} - ${emp.name}`.toLowerCase();
        return (
          emp.employeeId.toLowerCase().includes(q) ||
          emp.name.toLowerCase().includes(q) ||
          formatted.includes(q)
        );
      }
      return true;
    });
  }, [employees, selectedStream, selectedDepartment, selectedEmployeeType, employeeSearchTerm, selectedEmployeeFilter]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (selectedStream !== "ALL" && emp.stream !== selectedStream) return false;
      if (selectedDepartment !== "ALL" && emp.department !== selectedDepartment) return false;
      if (selectedEmployeeType !== "ALL" && emp.employeeType !== selectedEmployeeType) return false;

      if (selectedEmployeeFilter !== "ALL") {
        return emp.employeeId === selectedEmployeeFilter;
      }
      if (employeeSearchTerm.trim()) {
        const q = employeeSearchTerm.trim().toLowerCase();
        const formatted = `${emp.employeeId} - ${emp.name}`.toLowerCase();
        return (
          emp.employeeId.toLowerCase().includes(q) ||
          emp.name.toLowerCase().includes(q) ||
          formatted.includes(q)
        );
      }
      return true;
    });
  }, [employees, selectedStream, selectedDepartment, selectedEmployeeType, selectedEmployeeFilter, employeeSearchTerm]);

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

  // Helper to get base leave group/category (e.g. CL_A and CL_S both map to "CL")
  const getBaseCode = (code: string, name: string): string => {
    const c = (code || "").toUpperCase();
    const n = (name || "").toUpperCase();
    if (c === "CL" || c.startsWith("CL_") || n.includes("CASUAL")) return "CL";
    if ((c === "ML" || c.startsWith("ML_") || c === "MDL" || n.includes("MEDICAL")) && !n.includes("MATERNITY")) return "ML";
    if (c === "EL" || c.startsWith("EL_") || n.includes("EARNED")) return "EL";
    if (c === "SL" || c.startsWith("SL_") || n.includes("SICK")) return "SL";
    if (c === "RH" || c.startsWith("RH_") || n.includes("RESTRICTED")) return "RH";
    return c;
  };

  // Leave types from database that have carryForward === true, deduplicated by base category
  const carryForwardEligibleLeaveTypes = useMemo(() => {
    const cfList = leaveTypesList.filter((lt) => Boolean(lt.carryForward));
    const seen = new Set<string>();
    const uniqueList: LeaveTypeItem[] = [];
    for (const lt of cfList) {
      const base = getBaseCode(lt.code, lt.name);
      if (!seen.has(base)) {
        seen.add(base);
        uniqueList.push(lt);
      }
    }
    return uniqueList;
  }, [leaveTypesList]);

  // Filtered & sorted employee rows based on current filters, dynamic rules, and entitlement totals
  const visibleEmployeeRows = useMemo(() => {
    const rows: EmployeeYearEndRow[] = filteredEmployees.map((emp) => {
      const empRecords = dynamicPreviewRecords.filter((r) => r.employeeId === emp.employeeId);
      const carriedForwardDays = empRecords.reduce((sum, r) => sum + r.carriedForwardDays, 0);
      const proposedOpeningBalance = empRecords.reduce((sum, r) => sum + r.proposedOpeningBalance, 0);
      const isAlreadyProcessed =
        !rolledBackEmployeeIds.includes(emp.employeeId) &&
        (emp.isAlreadyProcessed ||
          (empRecords.length > 0 && empRecords.some((r) => r.isAlreadyProcessed)) ||
          sessionProcessedEmployeeIds.includes(emp.employeeId));

      const empEntitlement = entitlementDetails[emp.employeeId] || {};
      const carryForwardLeaves: Record<number, CarryForwardLeaveColumnData> = {};

      for (const lt of carryForwardEligibleLeaveTypes) {
        const base = getBaseCode(lt.code, lt.name);
        const stream = (emp.stream || "").toUpperCase();

        // Match the specific leave type for this employee's stream (e.g. SFS -> CL_S, AIDED -> CL_A)
        const matchLt = leaveTypesList.find((x) => {
          if (getBaseCode(x.code, x.name) !== base) return false;
          if (stream === "SFS" && (x.code.toUpperCase().endsWith("_S") || x.leaveGroup?.toUpperCase().includes("SFS"))) return true;
          if (stream === "AIDED" && (x.code.toUpperCase().endsWith("_A") || x.leaveGroup?.toUpperCase().includes("AIDED"))) return true;
          return false;
        }) || lt;

        const entRec = empEntitlement[matchLt.id] || empEntitlement[lt.id];
        const prevRec = empRecords.find((r) => r.leaveTypeId === matchLt.id) || empRecords.find((r) => r.leaveTypeId === lt.id);

        const taken = entRec?.taken ?? prevRec?.leaveUsed ?? 0;
        const eligible = entRec?.eligible ?? prevRec?.entitlement ?? matchLt.daysAllowed;
        const currentBf = entRec?.bf ?? 0;
        const credited = entRec?.credited ?? entRec?.credit ?? (prevRec as any)?.creditedDays ?? 0;
        const total = entRec?.total ?? Math.max(0, (eligible + currentBf + credited) - taken);
        const closingBalance = total;

        const ruleConfig = rules.find((r) => r.leaveTypeId === matchLt.id) || rules.find((r) => r.leaveTypeId === lt.id);
        const maxLimit = prevRec?.maxCarryForward ?? ruleConfig?.maxCarryForwardDays ?? null;
        const isTicked = selectedCarryForwardLeaveTypeIds.includes(matchLt.id) || selectedCarryForwardLeaveTypeIds.includes(lt.id);
        const proposedBf = isTicked
          ? (prevRec?.carriedForwardDays ?? (maxLimit !== null ? Math.min(closingBalance, maxLimit) : closingBalance))
          : 0;

        const isProcessedInDb =
          !rolledBackEmployeeIds.includes(emp.employeeId) &&
          (Boolean(prevRec?.isAlreadyProcessed) || sessionProcessedEmployeeIds.includes(emp.employeeId));

        carryForwardLeaves[lt.id] = {
          leaveTypeId: matchLt.id,
          leaveTypeCode: matchLt.code,
          leaveTypeName: matchLt.name,
          taken,
          eligible,
          bf: currentBf,
          total,
          proposedBf,
          closingBalance,
          isTickedForProcess: isTicked,
          isProcessedInDb,
        };
      }

      return {
        employeeId: emp.employeeId,
        employeeName: emp.name,
        stream: emp.stream,
        department: emp.department,
        employeeType: emp.employeeType,
        employmentType: emp.employmentType,
        carryForwardLeaves,
        carriedForwardDays,
        proposedOpeningBalance,
        isAlreadyProcessed,
      };
    });

    if (!sortField || !sortDirection) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      let comparison = 0;
      if (sortField.startsWith("cf_")) {
        const ltId = parseInt(sortField.replace("cf_", ""), 10);
        const dataA = a.carryForwardLeaves[ltId];
        const dataB = b.carryForwardLeaves[ltId];
        comparison = ((dataA?.taken ?? 0) - (dataB?.taken ?? 0)) || ((dataA?.eligible ?? 0) - (dataB?.eligible ?? 0));
      } else {
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
          default:
            comparison = 0;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredEmployees, dynamicPreviewRecords, entitlementDetails, carryForwardEligibleLeaveTypes, selectedCarryForwardLeaveTypeIds, sortField, sortDirection, rolledBackEmployeeIds, sessionProcessedEmployeeIds, rules]);

  // Pagination calculations
  const totalRecords = visibleEmployeeRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const clampedCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (clampedCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);
  const paginatedRows = useMemo(() => {
    return visibleEmployeeRows.slice(startIndex, endIndex);
  }, [visibleEmployeeRows, startIndex, endIndex]);

  // Leave types selected (ticked) for year-end process
  const selectedLeaveTypesForYearEnd = useMemo(() => {
    return carryForwardEligibleLeaveTypes.filter((lt) => {
      const base = getBaseCode(lt.code, lt.name);
      return (
        selectedCarryForwardLeaveTypeIds.includes(lt.id) ||
        selectedCarryForwardLeaveTypeIds.some((id) => {
          const sibling = leaveTypesList.find((x) => x.id === id);
          return sibling && getBaseCode(sibling.code, sibling.name) === base;
        })
      );
    });
  }, [carryForwardEligibleLeaveTypes, selectedCarryForwardLeaveTypeIds, leaveTypesList]);

  // Employees selected for year-end process summary
  const selectedRowsForSummary = useMemo(() => {
    return visibleEmployeeRows.filter((r) => selectedEmployeeIds.includes(r.employeeId));
  }, [visibleEmployeeRows, selectedEmployeeIds]);

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

  const handleToggleCarryForwardLeaveType = (leaveTypeId: number) => {
    const targetLt = leaveTypesList.find((lt) => lt.id === leaveTypeId);
    const targetBase = targetLt ? getBaseCode(targetLt.code, targetLt.name) : String(leaveTypeId);
    const siblingIds = leaveTypesList
      .filter((lt) => getBaseCode(lt.code, lt.name) === targetBase)
      .map((lt) => lt.id);

    setSelectedCarryForwardLeaveTypeIds((prev) => {
      const isChecked = siblingIds.some((id) => prev.includes(id));
      const next = isChecked
        ? prev.filter((id) => !siblingIds.includes(id))
        : Array.from(new Set([...prev, ...siblingIds]));

      setRules((prevRules) =>
        prevRules.map((r) => {
          if (siblingIds.includes(r.leaveTypeId)) {
            return {
              ...r,
              rule: isChecked ? "RESET" : "CARRY_FORWARD",
            };
          }
          return r;
        })
      );

      return next;
    });
  };

  // Rollback handlers
  const handleRollbackSingleEmployee = async (employeeId: string) => {
    try {
      setRollingBackEmployeeId(employeeId);
      setError("");
      setSuccessMessage("");
      const params = new URLSearchParams({
        cycle: nextCycleCode,
        employeeId,
      });
      const res = await fetch(`/api/leave-year-end?${params.toString()}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rollback employee.");
      }
      setSuccessMessage(`Successfully rolled back year-end records for employee ${employeeId}.`);
      setRolledBackEmployeeIds((prev) => (prev.includes(employeeId) ? prev : [...prev, employeeId]));
      setSessionProcessedEmployeeIds((prev) => prev.filter((id) => id !== employeeId));
      await loadData(currentCycleCode, nextCycleCode, false, true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error during rollback.");
    } finally {
      setRollingBackEmployeeId(null);
    }
  };

  const handleRollbackAll = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to rollback year-end records for cycle ${nextCycleCode}? This will revert carried forward days and reset opening balances for all employees.`
    );
    if (!confirmed) return;

    try {
      setIsRollingBackAll(true);
      setError("");
      setSuccessMessage("");
      const params = new URLSearchParams({
        cycle: nextCycleCode,
      });
      const res = await fetch(`/api/leave-year-end?${params.toString()}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rollback year-end process.");
      }
      setIsProcessedPreview(false);
      setHasProceeded(false);
      setSessionProcessedEmployeeIds([]);
      setRolledBackEmployeeIds([]);
      setSuccessMessage(`Successfully rolled back year-end records for all employees in cycle ${nextCycleCode}.`);
      await loadData(currentCycleCode, nextCycleCode, false, false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error during rollback.");
    } finally {
      setIsRollingBackAll(false);
    }
  };

  const isRollbackEnabled = (row: EmployeeYearEndRow) => {
    if (rolledBackEmployeeIds.includes(row.employeeId)) {
      return false;
    }
    return row.isAlreadyProcessed || sessionProcessedEmployeeIds.includes(row.employeeId);
  };

  const handleToggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Execution
  // Save year-end process
  const handleSaveYearEndProcess = async () => {
    setIsProcessing(true);
    setError("");

    try {
      const targetEmployeeIds = selectedEmployeeIds.filter((id) => filteredEmployeeIds.has(id));
      if (targetEmployeeIds.length === 0) {
        throw new Error("No employees selected under current filter criteria.");
      }

      // Ensure all sibling leave types across streams (e.g. CL_A & CL_S) have their rules synchronized
      const rulesPayload = rules.map((r) => {
        const lt = leaveTypesList.find((x) => x.id === r.leaveTypeId);
        const base = lt ? getBaseCode(lt.code, lt.name) : "";
        const isSiblingTicked = selectedCarryForwardLeaveTypeIds.some((id) => {
          const sibling = leaveTypesList.find((x) => x.id === id);
          return sibling && getBaseCode(sibling.code, sibling.name) === base;
        });
        const isTicked = selectedCarryForwardLeaveTypeIds.includes(r.leaveTypeId) || isSiblingTicked;
        return {
          leaveTypeId: r.leaveTypeId,
          rule: isTicked ? ("CARRY_FORWARD" as const) : ("RESET" as const),
          maxCarryForwardDays: r.maxCarryForwardDays,
        };
      });

      const payload = {
        currentCycle: currentCycleCode,
        nextCycle: nextCycleCode,
        employeeIds: targetEmployeeIds,
        rules: rulesPayload,
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

      setShowSummaryModal(false);
      setIsDeclarationConfirmed(false);
      setSessionProcessedEmployeeIds((prev) => Array.from(new Set([...prev, ...targetEmployeeIds])));
      setRolledBackEmployeeIds((prev) => prev.filter((id) => !targetEmployeeIds.includes(id)));
      setSelectedEmployeeIds((prev) => prev.filter((id) => !targetEmployeeIds.includes(id)));
      setHasProceeded(true);
      setSuccessMessage(
        `Leave year-end process saved successfully for ${targetEmployeeIds.length} staff member(s)! Records updated on Year-End Process table and Leave Entitlement table.`
      );

      // Refresh data while preserving current selection
      await loadData(currentCycleCode, nextCycleCode, false, true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving process.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const selectedRows = visibleEmployeeRows.filter((r) => selectedEmployeeIds.includes(r.employeeId));
    const totalCarryForward = selectedRows.reduce((sum, r) => sum + r.carriedForwardDays, 0);
    const alreadyProcessed = selectedRows.filter((r) => r.isAlreadyProcessed).length;

    return {
      selectedCount: selectedEmployeeIds.filter((id) => filteredEmployeeIds.has(id)).length,
      recordsCount: selectedRows.length,
      totalCarryForward,
      alreadyProcessed,
    };
  }, [visibleEmployeeRows, selectedEmployeeIds, filteredEmployeeIds]);

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
                  setSelectedEmployeeFilter("ALL");
                  setEmployeeSearchTerm("");
                  setCurrentPage(1);
                  setIsProcessedPreview(false);
                }}
                className="text-xs font-medium text-emerald-800 hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* All Streams Dropdown */}
              <div>
                <label htmlFor="streamFilter" className="mb-1 block text-xs font-medium text-slate-600">Stream</label>
                <div className="relative">
                  <select
                    id="streamFilter"
                    value={selectedStream}
                    onChange={(e) => {
                      setSelectedStream(e.target.value);
                      setCurrentPage(1);
                      setIsProcessedPreview(false);
                    }}
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
                    onChange={(e) => {
                      setSelectedDepartment(e.target.value);
                      setCurrentPage(1);
                      setIsProcessedPreview(false);
                    }}
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
                    onChange={(e) => {
                      setSelectedEmployeeType(e.target.value);
                      setCurrentPage(1);
                      setIsProcessedPreview(false);
                    }}
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

              {/* Employee ID / Employee Name Search & Dropdown Filter */}
              <div className="relative" ref={employeeDropdownRef}>
                <label htmlFor="employeeFilterInput" className="mb-1 block text-xs font-medium text-slate-600">
                  Employee ID / Name
                </label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 text-slate-400"
                    />
                    <input
                      id="employeeFilterInput"
                      type="text"
                      placeholder="Emp ID / Emp Name"
                      value={employeeSearchTerm}
                      onFocus={() => setIsEmployeeDropdownOpen(true)}
                      onChange={(e) => {
                        setEmployeeSearchTerm(e.target.value);
                        setSelectedEmployeeFilter("ALL");
                        setIsEmployeeDropdownOpen(true);
                        setCurrentPage(1);
                        setIsProcessedPreview(false);
                      }}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-16 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-emerald-600"
                    />
                    {employeeSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeSearchTerm("");
                          setSelectedEmployeeFilter("ALL");
                          setCurrentPage(1);
                        }}
                        className="absolute right-7 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title="Clear filter"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEmployeeDropdownOpen((prev) => !prev)}
                      className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title="Toggle employee list"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-150 ${isEmployeeDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Dropdown list of values formatted as 'employee id - employee name' */}
                  {isEmployeeDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeFilter("ALL");
                          setEmployeeSearchTerm("");
                          setIsEmployeeDropdownOpen(false);
                          setCurrentPage(1);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs transition hover:bg-emerald-50 hover:text-emerald-900 ${
                          selectedEmployeeFilter === "ALL" && !employeeSearchTerm
                            ? "bg-emerald-50/70 font-bold text-emerald-800"
                            : "text-slate-700"
                        }`}
                      >
                        All Employees
                      </button>
                      {employeeFilterOptions.length === 0 ? (
                        <div className="px-3 py-2 text-center text-xs text-slate-400 italic">
                          No matching employees found
                        </div>
                      ) : (
                        employeeFilterOptions.map((emp) => {
                          const isSelected = selectedEmployeeFilter === emp.employeeId;
                          return (
                            <button
                              key={emp.employeeId}
                              type="button"
                              onClick={() => {
                                setSelectedEmployeeFilter(emp.employeeId);
                                setEmployeeSearchTerm(`${emp.employeeId} - ${emp.name}`);
                                setIsEmployeeDropdownOpen(false);
                                setCurrentPage(1);
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-emerald-50 hover:text-emerald-900 ${
                                isSelected
                                  ? "bg-emerald-50/70 font-bold text-emerald-800"
                                  : "text-slate-700"
                              }`}
                            >
                              <span className="font-medium">
                                <strong className="font-mono">{emp.employeeId}</strong> - {emp.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {emp.stream}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Select Leave Type for Year-End Process Checkbox Section */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-emerald-700" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  Select the leave type for year end process
                </h3>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                Fetched from Leave Type table (Carry Forward Enabled)
              </span>
            </div>

            <div className="mt-3">
              {carryForwardEligibleLeaveTypes.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No leave types currently have carry forward enabled in the database.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {carryForwardEligibleLeaveTypes.map((lt) => {
                    const base = getBaseCode(lt.code, lt.name);
                    const isChecked = selectedCarryForwardLeaveTypeIds.includes(lt.id) ||
                      selectedCarryForwardLeaveTypeIds.some((id) => {
                        const sibling = leaveTypesList.find((x) => x.id === id);
                        return sibling && getBaseCode(sibling.code, sibling.name) === base;
                      });
                    return (
                      <label
                        key={lt.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                          isChecked
                            ? "border-emerald-300 bg-emerald-50/70 text-emerald-900 shadow-xs"
                            : "border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCarryForwardLeaveType(lt.id)}
                          className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="font-mono">{base}</span>
                        <span className="font-medium text-slate-700">- {lt.name}</span>
                        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
                          {lt.daysAllowed} days
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {successMessage && (
            <div role="status" className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-700" />
                <span>{successMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
          )}

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
                  {isProcessedPreview
                    ? `Next Cycle Opening Balance Preview (${currentCycleCode} → ${nextCycleCode})`
                    : `Current Employee Leave Balances (${currentCycleCode})`}
                </h2>
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {visibleEmployeeRows.length} employees
                </span>
                {selectedEmployeeIds.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                    {selectedEmployeeIds.filter((id) => filteredEmployeeIds.has(id)).length} employees selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
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
              <>
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
                        {/* Dynamic Carry Forward Leave Type Columns */}
                        {carryForwardEligibleLeaveTypes.map((lt) => (
                          <th key={lt.id} scope="col" className="whitespace-nowrap px-3 py-3 text-right align-middle">
                            <SortHeaderButton
                              label={lt.name}
                              columnKey={`cf_${lt.id}`}
                              sortField={sortField}
                              sortDirection={sortDirection}
                              onSort={handleSort}
                              align="right"
                            />
                          </th>
                        ))}
                        {carryForwardEligibleLeaveTypes.length === 0 && (
                          <th scope="col" className="whitespace-nowrap px-3 py-3 text-center align-middle text-slate-400">
                            Carry Forward Leave
                          </th>
                        )}
                        <th scope="col" className="whitespace-nowrap px-3 py-3 text-center align-middle">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {paginatedRows.map((row) => {
                        const isSelected = selectedEmployeeIds.includes(row.employeeId);
                        const canRollback = isRollbackEnabled(row);
                        const isRollingBackThis = rollingBackEmployeeId === row.employeeId;

                        return (
                          <tr
                            key={row.employeeId}
                            className={`transition-colors hover:bg-slate-50/80 ${isSelected ? "bg-emerald-50/30" : ""
                              }`}
                          >
                            <td className="w-10 px-3 py-3 text-center align-middle">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleEmployee(row.employeeId)}
                                className="size-3.5 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer align-middle"
                              />
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-left align-middle font-mono text-xs font-semibold text-slate-700">
                              {row.employeeId}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-left align-middle font-semibold text-slate-800">
                              {row.employeeName}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-left align-middle">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                {row.stream}-{row.department}
                              </span>
                            </td>
                            {/* Dynamic Carry Forward Leave Values */}
                            {carryForwardEligibleLeaveTypes.map((lt) => {
                              const leafData = row.carryForwardLeaves[lt.id];
                              const isEmpRolledBack = rolledBackEmployeeIds.includes(row.employeeId);
                              const isProcessed = !isEmpRolledBack && (row.isAlreadyProcessed || sessionProcessedEmployeeIds.includes(row.employeeId));

                              const isTicked = leafData?.isTickedForProcess ?? false;
                              let carriedTotal = 0;
                              if (isTicked) {
                                if (isProcessed) {
                                  carriedTotal = (leafData?.bf ?? 0) > 0 ? (leafData?.bf ?? 0) : (leafData?.proposedBf ?? 0);
                                } else {
                                  carriedTotal = leafData?.total ?? 0;
                                }
                              }
                              const openingDenominator = (leafData?.eligible ?? lt.daysAllowed) + carriedTotal;

                              return (
                                <td key={lt.id} className="whitespace-nowrap px-3 py-3 text-right align-middle">
                                  {leafData ? (
                                    isProcessed ? (
                                      <span
                                        title={`Processed: 0 taken / ${openingDenominator} (${leafData.eligible} eligible + ${carriedTotal} carried total)`}
                                        className="inline-flex items-center gap-1.5 rounded bg-emerald-50 border border-emerald-300 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-950 shadow-2xs"
                                      >
                                        <span>0 / {openingDenominator}</span>
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1 py-0.5 rounded">
                                          ({leafData.eligible} + {carriedTotal})
                                        </span>
                                      </span>
                                    ) : (
                                      <span
                                        title={`Current: ${leafData.taken} taken / ${leafData.total} total`}
                                        className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-mono font-semibold text-slate-800"
                                      >
                                        <span>{leafData.taken} / {leafData.total}</span>
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-slate-400 font-mono text-xs">-</span>
                                  )}
                                </td>
                              );
                            })}
                            {carryForwardEligibleLeaveTypes.length === 0 && (
                              <td className="whitespace-nowrap px-3 py-3 text-center text-slate-400 align-middle">
                                -
                              </td>
                            )}
                            <td className="whitespace-nowrap px-3 py-3 text-center align-middle">
                              <button
                                type="button"
                                disabled={!canRollback || isRollingBackThis}
                                onClick={() => handleRollbackSingleEmployee(row.employeeId)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 shadow-2xs transition hover:bg-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                title={
                                  rolledBackEmployeeIds.includes(row.employeeId)
                                    ? "Already rolled back"
                                    : canRollback
                                    ? `Rollback year-end process for ${row.employeeName}`
                                    : "Rollback is available for processed employees"
                                }
                              >
                                {isRollingBackThis ? (
                                  <Loader2 size={13} className="animate-spin text-red-600" />
                                ) : (
                                  <RotateCcw size={13} />
                                )}
                                <span>Rollback</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {visibleEmployeeRows.length === 0 && (
                        <tr>
                          <td colSpan={Math.max(5, 4 + carryForwardEligibleLeaveTypes.length + 1)} className="px-6 py-12 text-center text-slate-400 align-middle">
                            No employee records match the selected filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {visibleEmployeeRows.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
                      <span>
                        Showing <strong className="font-semibold text-slate-800">{startIndex + 1}</strong> to{" "}
                        <strong className="font-semibold text-slate-800">{endIndex}</strong> of{" "}
                        <strong className="font-semibold text-slate-800">{totalRecords}</strong> records
                      </span>
                      <div className="hidden h-4 w-px bg-slate-200 sm:block" />
                      <div className="flex items-center gap-2">
                        <label htmlFor="pageSizeSelect" className="whitespace-nowrap font-medium text-slate-500">
                          Rows per page:
                        </label>
                        <div className="relative inline-flex items-center">
                          <select
                            id="pageSizeSelect"
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="h-8 cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white py-1 pl-3 pr-7 text-xs font-semibold leading-tight text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                          <ChevronDown
                            size={13}
                            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Page Navigation */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={clampedCurrentPage <= 1}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft size={14} />
                        <span>Previous</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`flex size-8 items-center justify-center rounded-lg text-xs font-semibold shadow-sm transition ${page === clampedCurrentPage
                                ? "bg-emerald-700 text-white"
                                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={clampedCurrentPage >= totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Action Row below the table end */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-6">
            <div className="text-xs font-medium text-slate-600">
              {metrics.selectedCount > 0 ? (
                <span>
                  <strong className="font-semibold text-slate-800">{metrics.selectedCount}</strong> staff member(s) selected
                  {isProcessedPreview && (
                    <span className="font-semibold text-emerald-700"> • New-cycle preview ready</span>
                  )}
                </span>
              ) : (
                <span className="text-slate-400">No employees selected</span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {/* Rollback Button below the table: Kept visible, enabled after Proceed is clicked */}
              <button
                type="button"
                disabled={!visibleEmployeeRows.some((r) => isRollbackEnabled(r)) || isRollingBackAll}
                onClick={handleRollbackAll}
                className="inline-flex items-center gap-2 rounded-xl border border-red-600 bg-red-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-white shadow-sm transition hover:bg-red-700 hover:border-red-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-300 disabled:text-slate-500"
                title={
                  visibleEmployeeRows.some((r) => isRollbackEnabled(r))
                    ? "Rollback year-end records for all processed employees in this cycle"
                    : "Rollback is available for processed employees"
                }
              >
                {isRollingBackAll ? (
                  <Loader2 size={16} className="animate-spin text-white" />
                ) : (
                  <RotateCcw size={16} className="text-white" />
                )}
                <span>Rollback</span>
              </button>

              {/* Proceed Action Button */}
              <button
                type="button"
                disabled={metrics.selectedCount === 0 || isLoading || isProcessing}
                onClick={() => {
                  setIsDeclarationConfirmed(false);
                  setShowSummaryModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 active:scale-[0.99]"
              >
                <CalendarCheck size={18} />
                <span>Proceed</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Summary & Output Modal (Matches User Requested Format) ── */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-xs">
                  <CalendarCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Leave Year-End Process Summary</h3>
                  <p className="text-xs text-slate-500">
                    Review selected staff leave rollover before saving
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDeclarationConfirmed(false);
                  setShowSummaryModal(false);
                }}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Overview Info Cards for Employee Understanding */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Current Cycle
                  </span>
                  <p className="mt-1 font-mono text-base font-bold text-slate-800">
                    {currentCycleCode}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    New Cycle
                  </span>
                  <p className="mt-1 font-mono text-base font-bold text-emerald-900">
                    {nextCycleCode}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Total Number of Employees Selected
                  </span>
                  <p className="mt-1 text-base font-bold text-slate-800">
                    {selectedRowsForSummary.length}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      employee{selectedRowsForSummary.length === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Table of Selected Employees & Calculated Balances */}
              {selectedRowsForSummary.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No employees currently selected. Please select at least one employee from the list.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 shadow-xs">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left">Employee ID</th>
                        <th className="px-4 py-3 text-left">Employee Name</th>
                        <th className="px-4 py-3 text-left">Stream / Department</th>
                        {selectedLeaveTypesForYearEnd.map((lt) => {
                          const base = getBaseCode(lt.code, lt.name);
                          return (
                            <th key={lt.id} className="px-4 py-3 text-right">
                              <span>{lt.name}</span>
                              <span className="ml-1 text-[10px] font-mono text-slate-400">({base})</span>
                            </th>
                          );
                        })}
                        {selectedLeaveTypesForYearEnd.length === 0 && (
                          <th className="px-4 py-3 text-center text-slate-400">
                            No Leave Types Selected
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRowsForSummary.map((row) => (
                        <tr key={row.employeeId} className="hover:bg-slate-50 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-slate-700">
                            {row.employeeId}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                            {row.employeeName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {row.stream}-{row.department}
                            </span>
                          </td>
                          {selectedLeaveTypesForYearEnd.map((lt) => {
                            const leafData = row.carryForwardLeaves[lt.id];
                            const matchLt = leaveTypesList.find((x) => x.id === leafData?.leaveTypeId) || lt;
                            const daysAllowed = matchLt.daysAllowed || leafData?.eligible || 10;
                            // Dynamic reference to true current-year entitlement total - accounts for newly credited amount without improper compounding
                            const currentEntitlementTotal = leafData?.total ?? Math.max(0, (leafData?.eligible ?? daysAllowed) - (leafData?.taken ?? 0));
                            const taken = leafData?.taken ?? 0;

                            return (
                              <td key={lt.id} className="whitespace-nowrap px-4 py-3 text-right">
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-950 shadow-2xs">
                                  <span>{taken} / {currentEntitlementTotal}</span>
                                </span>
                              </td>
                            );
                          })}
                          {selectedLeaveTypesForYearEnd.length === 0 && (
                            <td className="whitespace-nowrap px-4 py-3 text-center text-slate-400 italic">
                              Select leave types above to carry forward
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Declaration Checkbox Section */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 transition-all shadow-2xs">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDeclarationConfirmed}
                    onChange={(e) => setIsDeclarationConfirmed(e.target.checked)}
                    className="mt-0.5 size-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-700"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Declaration &amp; Acknowledgement
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      I declare that I have reviewed the year-end leave rollover balances from current cycle{" "}
                      <strong className="font-semibold text-slate-900">{currentCycleCode}</strong> to new cycle{" "}
                      <strong className="font-semibold text-emerald-800">{nextCycleCode}</strong> for the{" "}
                      <strong className="font-semibold text-slate-900">{selectedRowsForSummary.length} selected employee(s)</strong>.
                      I confirm that these balances will be committed to the Leave Year-End and Entitlement records.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Footer with Save & Cancel buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
              <p className="text-xs text-slate-500">
                {!isDeclarationConfirmed ? (
                  <span className="font-medium text-amber-700">
                    * Please check the declaration box above to enable the Save button.
                  </span>
                ) : (
                  <span>
                    Ready to save. Values will update on the Year-End Process table and Leave Entitlement table.
                  </span>
                )}
              </p>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeclarationConfirmed(false);
                    setShowSummaryModal(false);
                  }}
                  disabled={isProcessing}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isDeclarationConfirmed || selectedRowsForSummary.length === 0 || isProcessing}
                  onClick={() => void handleSaveYearEndProcess()}
                  title={
                    !isDeclarationConfirmed
                      ? "Check the declaration checkbox above to enable Save"
                      : "Click to save year-end process"
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 cursor-pointer"
                >
                  {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>{isProcessing ? "Saving..." : "Save"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
