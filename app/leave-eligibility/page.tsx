"use client";

import { useEffect, useRef, useState, useMemo, Fragment } from "react";
import { ChevronDown, Download, Search, ChevronsUpDown, Pencil, Save, X, Info } from "lucide-react";
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
  bf?: number;
  creditedDays?: number;
  earned?: number;
  taken?: number;
  total?: number;
  leaveBalance: number;
  formattedDate?: string;
};

type Employee = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  employeeType?: string;
  leaveCalculationDate?: string;
  leaveRecords: EmployeeLeaveRecord[];
};

type LeaveEligibilityData = {
  employees: Employee[];
  leaveTypes: LeaveType[];
};

function getEligibilityValue(employee: Employee, leaveType: LeaveType) {
  const record = employee.leaveRecords.find((item) => item.leaveTypeId === leaveType.id);
  if (leaveType.status !== "ACTIVE" || record?.isEligible === false) return "Inactive";
  return `${record?.daysAllowed ?? leaveType.daysAllowed}`;
}

const TARGET_LEAVES = ["CL", "EL", "ML", "RH"] as const;

const LEAVE_STYLE_CONFIG: Record<
  string,
  {
    code: string;
    label: string;
    headerBg: string;
    headerText: string;
    subHeaderBg: string;
    subHeaderText: string;
    cellBg: string;
    border: string;
  }
> = {
  CL: {
    code: "CL",
    label: "Casual Leave",
    headerBg: "bg-sky-200/90",
    headerText: "text-sky-950 font-bold",
    subHeaderBg: "bg-sky-100/70",
    subHeaderText: "text-sky-900 font-semibold",
    cellBg: "bg-sky-50/40",
    border: "border-sky-200",
  },
  ML: {
    code: "ML",
    label: "Medical Leave",
    headerBg: "bg-emerald-200/90",
    headerText: "text-emerald-950 font-bold",
    subHeaderBg: "bg-emerald-100/70",
    subHeaderText: "text-emerald-900 font-semibold",
    cellBg: "bg-emerald-50/40",
    border: "border-emerald-200",
  },
  EL: {
    code: "EL",
    label: "Earned Leave",
    headerBg: "bg-[#ffe082]", // Warm yellow matching reference image "Annual"
    headerText: "text-amber-950 font-bold",
    subHeaderBg: "bg-[#fff3cc]",
    subHeaderText: "text-amber-900 font-semibold",
    cellBg: "bg-amber-50/40",
    border: "border-amber-200",
  },
  RH: {
    code: "RH",
    label: "Restricted Holiday",
    headerBg: "bg-purple-200/90",
    headerText: "text-purple-950 font-bold",
    subHeaderBg: "bg-purple-100/70",
    subHeaderText: "text-purple-900 font-semibold",
    cellBg: "bg-purple-50/40",
    border: "border-purple-200",
  },
};

function formatNumber(n: number | string | undefined | null): string {
  const num = Number(n);
  if (isNaN(num)) return "00.00";
  return num < 10 && num >= 0 ? `0${num.toFixed(2)}` : num.toFixed(2);
}

function getLeaveRecord(
  employee: Employee,
  leaveTypeId: number,
  leaveType?: LeaveType,
  allLeaveTypes?: LeaveType[]
): EmployeeLeaveRecord | undefined {
  const direct = employee.leaveRecords.find((item) => item.leaveTypeId === leaveTypeId);
  if (direct) return direct;
  if (!leaveType || !allLeaveTypes) return undefined;
  const cfg = getLeaveConfig(leaveType);
  return employee.leaveRecords.find((item) => {
    const t = allLeaveTypes.find((x) => x.id === item.leaveTypeId);
    if (!t) return false;
    const itemCfg = getLeaveConfig(t);
    return itemCfg.displayCode === cfg.displayCode;
  });
}

function getLeaveConfig(lt: { code: string; name: string }) {
  const codeUpper = (lt.code || "").toUpperCase();
  const nameUpper = (lt.name || "").toUpperCase();
  if (codeUpper === "CL" || codeUpper.startsWith("CL_") || nameUpper.includes("CASUAL")) {
    return { ...LEAVE_STYLE_CONFIG.CL, displayCode: "CL", displayLabel: "Casual Leave" };
  }
  if ((codeUpper === "ML" || codeUpper.startsWith("ML_") || nameUpper.includes("MEDICAL")) && !nameUpper.includes("MATERNITY")) {
    return { ...LEAVE_STYLE_CONFIG.ML, displayCode: "ML", displayLabel: "Medical Leave" };
  }
  if (codeUpper === "EL" || codeUpper.startsWith("EL_") || nameUpper.includes("EARNED")) {
    return { ...LEAVE_STYLE_CONFIG.EL, displayCode: "EL", displayLabel: "Earned Leave" };
  }
  if (codeUpper === "RH" || codeUpper.startsWith("RH_") || nameUpper.includes("RESTRICTED")) {
    return { ...LEAVE_STYLE_CONFIG.RH, displayCode: "RH", displayLabel: "Restricted Holiday" };
  }
  return {
    code: lt.code,
    displayCode: lt.code,
    label: lt.name,
    displayLabel: lt.name,
    headerBg: "bg-slate-200",
    headerText: "text-slate-900",
    subHeaderBg: "bg-slate-100",
    subHeaderText: "text-slate-800",
    cellBg: "bg-slate-50/40",
    border: "border-slate-200",
  };
}

async function fetchLeaveEligibility(): Promise<LeaveEligibilityData> {
  const response = await fetch("/api/leave-eligibility", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to load leave entitlement.");
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
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 text-xs font-medium uppercase transition-colors ${disabled
          ? "cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
          : isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 text-slate-800"
            : "border-slate-300 text-slate-600 hover:border-slate-400"
          }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? "rotate-180" : ""
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
              className="w-full rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none border border-slate-200 placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
              <p className="py-3 text-center text-xs text-slate-400">No options found</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs">
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

/* ─── Editable / Safe Cell Component ────────────────────────── */
function EditableCell({
  value,
  isEditMode,
  onChange,
  className,
  isRedFocus = false,
  isModified = false,
}: {
  value: number;
  isEditMode: boolean;
  onChange: (newVal: number) => void;
  className?: string;
  isRedFocus?: boolean;
  isModified?: boolean;
}) {
  const [prevVal, setPrevVal] = useState<number>(value);
  const [localVal, setLocalVal] = useState<string>(String(value));

  if (value !== prevVal) {
    setPrevVal(value);
    setLocalVal(String(value));
  }

  if (!isEditMode) {
    return (
      <span className="font-mono text-[11px] font-medium text-slate-800 select-none">
        {formatNumber(value)}
      </span>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <input
        type="text"
        inputMode="decimal"
        value={localVal}
        onChange={(e) => {
          const raw = e.target.value;
          setLocalVal(raw);
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) {
            onChange(Math.max(0, parsed));
          } else if (raw.trim() === "") {
            onChange(0);
          }
        }}
        onBlur={() => {
          const parsed = parseFloat(localVal);
          const finalVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
          setLocalVal(String(finalVal));
          onChange(finalVal);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`w-14 h-7 text-center font-mono font-medium text-[11px] rounded border outline-none transition ${isModified
          ? "border-amber-500 bg-amber-50/70 text-amber-950 ring-1 ring-amber-400 font-semibold"
          : isRedFocus
            ? "border-slate-300 hover:border-slate-400 focus:border-red-600 focus:ring-1 focus:ring-red-600 focus:text-red-950 bg-white text-slate-800"
            : "border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-800"
          } ${className || ""}`}
      />
    </div>
  );
}

export default function LeaveEligibilityPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [originalEmployees, setOriginalEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showInfoModal) {
        setShowInfoModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfoModal]);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"code" | "name" | "date" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [streamFilters, setStreamFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [employeeTypeFilters, setEmployeeTypeFilters] = useState<string[]>([]);
  const [employeeNameFilters, setEmployeeNameFilters] = useState<string[]>([]);

  // Filter leave types to: Casual Leave (CL), Medical Leave (ML), Earned Leave (EL), Restricted Holiday (RH)
  const activeLeaveTypes = useMemo(() => {
    // 1. Casual Leave (CL) - mapped to Annual Leave credit
    const cl =
      leaveTypes.find((lt) => lt.code.toUpperCase() === "CL") ||
      leaveTypes.find(
        (lt) =>
          lt.code.toUpperCase().startsWith("CL_") ||
          lt.name.toUpperCase().includes("CASUAL")
      );

    // 2. Medical Leave (ML) - mapped to Medical Leave credit
    const ml =
      leaveTypes.find(
        (lt) =>
          (lt.code.toUpperCase() === "ML" ||
            lt.code.toUpperCase().startsWith("ML_") ||
            lt.name.toUpperCase() === "MEDICAL LEAVE" ||
            lt.name.toUpperCase().includes("MEDICAL")) &&
          !lt.name.toUpperCase().includes("MATERNITY")
      );

    // 3. Earned Leave (EL)
    const el =
      leaveTypes.find((lt) => lt.code.toUpperCase() === "EL") ||
      leaveTypes.find((lt) => lt.code.toUpperCase().startsWith("EL_")) ||
      leaveTypes.find((lt) => lt.name.toUpperCase().includes("EARNED"));

    // 4. Restricted Holiday (RH)
    const rh =
      leaveTypes.find((lt) => lt.code.toUpperCase() === "RH") ||
      leaveTypes.find((lt) => lt.code.toUpperCase().startsWith("RH_")) ||
      leaveTypes.find((lt) => lt.name.toUpperCase().includes("RESTRICTED"));

    const list = [cl, ml, el, rh].filter((lt): lt is LeaveType => Boolean(lt));
    if (list.length > 0) return list;
    return leaveTypes.filter((lt) => lt.status === "ACTIVE").slice(0, 4);
  }, [leaveTypes]);

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

  // Step 3: Employee Types disabled until Department is chosen
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

  // Step 4: Employees disabled until Employee Type is chosen
  const isEmployeeDisabled = isEmployeeTypeDisabled || employeeTypeFilters.length === 0;
  const availableEmployees = isEmployeeDisabled
    ? []
    : employees.filter(
      (employee) =>
        streamFilters.includes(employee.stream) &&
        departmentFilters.includes(employee.department) &&
        employeeTypeFilters.includes(employee.employeeType || "Teaching")
    );

  const employeeNames = [...new Set(availableEmployees.map((employee) => employee.name))].filter(Boolean).sort();

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

  const handleSort = (field: "code" | "name" | "date") => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const visibleEmployees = useMemo(() => {
    const list = employees.filter((employee) => {
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesCode = employee.employeeId.toLowerCase().includes(query);
        const matchesName = employee.name.toLowerCase().includes(query);
        const matchesDept = employee.department.toLowerCase().includes(query);
        if (!matchesCode && !matchesName && !matchesDept) return false;
      }
      if (streamFilters.length > 0 && !streamFilters.includes(employee.stream)) return false;
      if (departmentFilters.length > 0 && !departmentFilters.includes(employee.department)) return false;
      if (
        employeeTypeFilters.length > 0 &&
        !employeeTypeFilters.includes(employee.employeeType || "Teaching")
      )
        return false;
      if (employeeNameFilters.length > 0 && !employeeNameFilters.includes(employee.name)) return false;
      return true;
    });

    if (sortField) {
      list.sort((a, b) => {
        let valA = "";
        let valB = "";
        if (sortField === "code") {
          valA = a.employeeId;
          valB = b.employeeId;
        } else if (sortField === "name") {
          valA = a.name;
          valB = b.name;
        } else if (sortField === "date") {
          valA = a.leaveCalculationDate || "";
          valB = b.leaveCalculationDate || "";
        }
        const cmp = valA.localeCompare(valB);
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [employees, search, streamFilters, departmentFilters, employeeNameFilters, sortField, sortDirection]);

  const isCellModified = (
    employeeId: string,
    leaveTypeId: number,
    field: "daysAllowed" | "bf" | "creditedDays" | "earned" | "leaveBalance"
  ) => {
    if (!isEditMode) return false;
    const currentEmp = employees.find((e) => e.employeeId === employeeId);
    const origEmp = originalEmployees.find((e) => e.employeeId === employeeId);
    if (!currentEmp || !origEmp) return false;
    const currentRec = currentEmp.leaveRecords.find((r) => r.leaveTypeId === leaveTypeId);
    const origRec = origEmp.leaveRecords.find((r) => r.leaveTypeId === leaveTypeId);
    if (!currentRec && !origRec) return false;
    if (!origRec || !currentRec) return true;
    return (currentRec[field] ?? 0) !== (origRec[field] ?? 0);
  };

  const modifiedRecords = useMemo(() => {
    if (!isEditMode) return [];
    const list: Array<{
      employeeId: string;
      leaveTypeId: number;
      daysAllowed: number;
      bf: number;
      creditedDays: number;
      earned: number;
      leaveBalance: number;
    }> = [];

    for (const emp of employees) {
      const origEmp = originalEmployees.find((o) => o.employeeId === emp.employeeId);
      for (const rec of emp.leaveRecords) {
        const origRec = origEmp?.leaveRecords.find((r) => r.leaveTypeId === rec.leaveTypeId);
        const isChanged =
          !origRec ||
          (rec.daysAllowed ?? 0) !== (origRec.daysAllowed ?? 0) ||
          (rec.bf ?? 0) !== (origRec.bf ?? 0) ||
          (rec.creditedDays ?? 0) !== (origRec.creditedDays ?? 0) ||
          (rec.earned ?? 0) !== (origRec.earned ?? 0) ||
          (rec.leaveBalance ?? 0) !== (origRec.leaveBalance ?? 0);

        if (isChanged) {
          list.push({
            employeeId: emp.employeeId,
            leaveTypeId: rec.leaveTypeId,
            daysAllowed: rec.daysAllowed ?? 0,
            bf: rec.bf ?? 0,
            creditedDays: rec.creditedDays ?? 0,
            earned: rec.earned ?? 0,
            leaveBalance: rec.leaveBalance ?? 0,
          });
        }
      }
    }
    return list;
  }, [employees, originalEmployees, isEditMode]);

  const handleCellChange = (
    employeeId: string,
    leaveTypeId: number,
    field: "daysAllowed" | "bf" | "creditedDays" | "earned" | "leaveBalance",
    newVal: number
  ) => {
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.employeeId !== employeeId) return emp;
        const exists = emp.leaveRecords.some((r) => r.leaveTypeId === leaveTypeId);
        const updatedRecords = exists
          ? emp.leaveRecords.map((rec) => {
            if (rec.leaveTypeId !== leaveTypeId) return rec;
            const updated = { ...rec, [field]: newVal };
            // Recompute total if any component changes
            const eligible = updated.daysAllowed || 0;
            const bf = updated.bf || 0;
            const credit = updated.creditedDays || 0;
            const earn = updated.earned || 0;
            const taken = updated.taken || 0;
            updated.total = Math.max(0, eligible + bf + credit + earn - taken);
            return updated;
          })
          : [
            ...emp.leaveRecords,
            {
              leaveTypeId,
              isEligible: true,
              daysAllowed: field === "daysAllowed" ? newVal : 0,
              bf: field === "bf" ? newVal : 0,
              creditedDays: field === "creditedDays" ? newVal : 0,
              earned: field === "earned" ? newVal : 0,
              taken: 0,
              total: newVal,
              leaveBalance: field === "leaveBalance" ? newVal : 0,
            },
          ];
        return { ...emp, leaveRecords: updatedRecords };
      })
    );
  };

  const handleEditToggle = () => {
    if (isEditMode) {
      // Revert changes back to original snapshot
      setEmployees(JSON.parse(JSON.stringify(originalEmployees)));
      setIsEditMode(false);
      setError("");
      setStatusNotice("Editing cancelled. Unsaved changes have been reverted.");
      window.setTimeout(() => setStatusNotice(""), 3500);
    } else {
      // Snapshot current data and activate edit mode
      setOriginalEmployees(JSON.parse(JSON.stringify(employees)));
      setIsEditMode(true);
      setError("");
      setStatusNotice("Edit mode activated. You can now modify values.");
      window.setTimeout(() => setStatusNotice(""), 3500);
    }
  };

  const handleSaveAll = async () => {
    if (modifiedRecords.length === 0) {
      setIsEditMode(false);
      setStatusNotice("No changes to save.");
      window.setTimeout(() => setStatusNotice(""), 3000);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/leave-eligibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: modifiedRecords }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save leave eligibility changes.");
      }

      setOriginalEmployees(JSON.parse(JSON.stringify(employees)));
      setIsEditMode(false);
      setStatusNotice(
        `Saved successfully! ${modifiedRecords.length} record${modifiedRecords.length === 1 ? "" : "s"
        } updated.`
      );
      window.setTimeout(() => setStatusNotice(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save leave eligibility changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "EMPLOYEE CODE",
      "EMPLOYEE NAME",
      "LEAVE CALCULATION DATE",
      "STREAM",
      "DEPARTMENT",
      ...activeLeaveTypes.flatMap((lt) => [
        `${lt.code}: ELIGIBLE`,
        `${lt.code}: BF`,
        `${lt.code}: CREDIT`,
        `${lt.code}: EARN`,
        `${lt.code}: TAKEN`,
        `${lt.code}: TOTAL`,
      ]),
      ...activeLeaveTypes.map((lt) => `BALANCE: ${lt.code}`),
    ];

    const rows = [
      headers,
      ...visibleEmployees.map((employee) => [
        employee.employeeId,
        employee.name,
        employee.leaveCalculationDate || "01-01-2026",
        employee.stream,
        employee.department,
        ...leaveTypes.map((leaveType) => leaveEligibilityValue(
          leaveType,
          employee.leaveRecords.find((item) => item.leaveTypeId === leaveType.id),
        )),
        ...leaveTypes.map((leaveType) => employee.leaveRecords.find((item) => item.leaveTypeId === leaveType.id)?.leaveBalance ?? "N/A"),
        ...activeLeaveTypes.flatMap((lt) => {
          const rec = getLeaveRecord(employee, lt.id, lt, leaveTypes);
          const eligible = rec?.daysAllowed ?? lt.daysAllowed;
          const bf = rec?.bf ?? 0;
          const credit = rec?.creditedDays ?? 0;
          const earn = rec?.earned ?? 0;
          const taken = rec?.taken ?? 0;
          const total = rec?.total ?? Math.max(0, eligible + bf + credit + earn - taken);
          return [eligible, bf, credit, earn, taken, total];
        }),
        ...activeLeaveTypes.map((lt) => {
          const rec = getLeaveRecord(employee, lt.id, lt, leaveTypes);
          return rec?.leaveBalance ?? 0;
        }),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "leave-entitlement.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let isMounted = true;

    fetchLeaveEligibility()
      .then((result) => {
        if (isMounted) {
          setEmployees(result.employees);
          setOriginalEmployees(JSON.parse(JSON.stringify(result.employees)));
          setLeaveTypes(result.leaveTypes);
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leave entitlement.");
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
      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1700px]">
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-800">Leave Entitlement</h1>
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 shadow-sm transition hover:bg-blue-100 hover:border-blue-400 hover:text-blue-700 active:scale-95 cursor-pointer"
                title="What is Leave Entitlement and why is it used?"
                aria-label="What is Leave Entitlement and why is it used?"
              >
                <Info size={18} />
              </button>
            </div>
          </header>

          {/* Filter Bar with Search matching reference UI */}
          <section
            aria-label="Employee filters"
            className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center"
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
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-800 px-5 text-xs font-semibold uppercase text-white hover:bg-slate-700"
            >
              <Download size={15} aria-hidden="true" />
              Export
            </button>
          </section>

          {/* Feedback banners */}
          {(error || statusNotice) && (
            <div
              className={`mt-4 rounded-lg px-4 py-3 text-xs font-medium ${error ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
            >
              {error || statusNotice}
            </div>
          )}

          <main className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-xs">
                <thead>
                  {/* Top Header Group */}
                  <tr className="border-b border-slate-300">
                    <th
                      rowSpan={2}
                      onClick={() => handleSort("code")}
                      className="cursor-pointer select-none whitespace-nowrap bg-[#fde992]/80 px-3.5 py-3 text-xs font-bold uppercase text-slate-800 border-r border-slate-300 hover:bg-[#fde992]"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronsUpDown size={14} className="text-blue-700 shrink-0" />
                        <span>Employee Code</span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort("name")}
                      className="cursor-pointer select-none whitespace-nowrap bg-[#fde992]/80 px-3.5 py-3 text-xs font-bold uppercase text-slate-800 border-r border-slate-300 hover:bg-[#fde992]"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronsUpDown size={14} className="text-blue-700 shrink-0" />
                        <span>Employee Name</span>
                      </div>
                    </th>
                    <th
                      rowSpan={2}
                      onClick={() => handleSort("date")}
                      className="cursor-pointer select-none whitespace-nowrap bg-[#fde992]/80 px-3.5 py-3 text-xs font-bold uppercase text-slate-800 border-r border-slate-300 hover:bg-[#fde992]"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronsUpDown size={14} className="text-blue-700 shrink-0" />
                        <span>Leave Calculation Date</span>
                      </div>
                    </th>

                    {/* 4 Leave Groups with different light colors: CL, ML, EL, RH */}
                    {activeLeaveTypes.map((lt) => {
                      const cfg = getLeaveConfig(lt);

                      return (
                        <th
                          key={`leave-group-header-${lt.id}`}
                          colSpan={6}
                          className={`border-r border-slate-300 px-3 py-2 text-center text-xs tracking-wider uppercase ${cfg.headerBg} ${cfg.headerText}`}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-bold">{cfg.displayCode}</span>
                            <span className="text-[11px] font-normal normal-case opacity-80">({cfg.displayLabel})</span>
                          </div>
                        </th>
                      );
                    })}

                    {/* LEAVE BALANCE IN DAYS Header */}
                    <th
                      colSpan={activeLeaveTypes.length}
                      className="border-l-2 border-slate-300 bg-slate-100 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-slate-900"
                    >
                      LEAVE BALANCE IN DAYS
                    </th>
                  </tr>

                  {/* Sub-Header Row */}
                  <tr className="border-b border-slate-300">
                    {/* Sub-columns for each of the 4 leave types: Eligible, BF, Credit, Earn, Taken, Total */}
                    {activeLeaveTypes.map((lt) => {
                      const cfg = getLeaveConfig(lt);
                      return (
                        <Fragment key={`subhdr-wrap-${lt.id}`}>
                          <th className={`px-2 py-2 text-center text-[11px] border-r ${cfg.border} ${cfg.subHeaderBg} ${cfg.subHeaderText}`}>
                            Eligible
                          </th>
                          <th className={`px-2 py-2 text-center text-[11px] border-r ${cfg.border} ${cfg.subHeaderBg} ${cfg.subHeaderText}`}>
                            BF
                          </th>
                          <th className={`px-2 py-2 text-center text-[11px] border-r ${cfg.border} ${cfg.subHeaderBg} ${cfg.subHeaderText}`}>
                            Credit
                          </th>
                          <th className={`px-2 py-2 text-center text-[11px] border-r ${cfg.border} ${cfg.subHeaderBg} ${cfg.subHeaderText}`}>
                            Earn
                          </th>
                          <th className={`px-2 py-2 text-center text-[11px] border-r ${cfg.border} ${cfg.subHeaderBg} ${cfg.subHeaderText}`}>
                            Taken
                          </th>
                          <th className={`px-2 py-2 text-center text-[11px] border-r-2 border-slate-300 ${cfg.subHeaderBg} ${cfg.subHeaderText}`}>
                            Total
                          </th>
                        </Fragment>
                      );
                    })}

                    {/* Sub-columns for LEAVE BALANCE IN DAYS */}
                    {activeLeaveTypes.map((lt) => {
                      const cfg = getLeaveConfig(lt);
                      return (
                        <th
                          key={`subhdr-bal-${lt.id}`}
                          className={`px-3 py-2 text-center text-[11px] font-bold border-r border-slate-200 ${cfg.subHeaderBg} ${cfg.subHeaderText}`}
                        >
                          {cfg.displayCode}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                  {!isLoading &&
                    visibleEmployees.map((employee) => (
                      <tr key={employee.employeeId} className="hover:bg-slate-50/80 transition-colors">
                        {/* Employee Code */}
                        <td className="whitespace-nowrap px-3.5 py-2.5 font-mono font-medium text-slate-800 border-r border-slate-200 bg-slate-50/40">
                          {employee.employeeId}
                        </td>

                        {/* Employee Name */}
                        <td className="whitespace-nowrap px-3.5 py-2.5 font-medium text-slate-800 border-r border-slate-200 bg-slate-50/40">
                          {employee.name}
                        </td>

                        {/* Leave Calculation Date */}
                        <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-center text-slate-700 border-r border-slate-200 bg-slate-50/40">
                          {employee.leaveCalculationDate || "01-01-2026"}
                        </td>

                        {/* 4 Leave Types with 6 columns each: Eligible, BF, Credit, Earn, Taken, Total */}
                        {activeLeaveTypes.map((lt) => {
                          const cfg = getLeaveConfig(lt);
                          const rec = getLeaveRecord(employee, lt.id, lt, leaveTypes);
                          const eligible = rec?.daysAllowed ?? lt.daysAllowed ?? 0;
                          const bf = rec?.bf ?? 0;
                          const credit = rec?.creditedDays ?? 0;
                          const earn = rec?.earned ?? 0;
                          const taken = rec?.taken ?? 0;
                          const total = rec?.total ?? Math.max(0, eligible + bf + credit + earn - taken);

                          return (
                            <Fragment key={`emp-${employee.employeeId}-lt-${lt.id}`}>
                              {/* 1. Eligible */}
                              <td className={`px-1.5 py-2 text-center border-r ${cfg.border} ${cfg.cellBg}`}>
                                <EditableCell
                                  value={eligible}
                                  isEditMode={isEditMode}
                                  isModified={isCellModified(employee.employeeId, lt.id, "daysAllowed")}
                                  onChange={(newVal) =>
                                    handleCellChange(employee.employeeId, lt.id, "daysAllowed", newVal)
                                  }
                                />
                              </td>

                              {/* 2. BF */}
                              <td className={`px-1.5 py-2 text-center border-r ${cfg.border} ${cfg.cellBg}`}>
                                <EditableCell
                                  value={bf}
                                  isEditMode={isEditMode}
                                  isRedFocus={true}
                                  isModified={isCellModified(employee.employeeId, lt.id, "bf")}
                                  onChange={(newVal) =>
                                    handleCellChange(employee.employeeId, lt.id, "bf", newVal)
                                  }
                                />
                              </td>

                              {/* 3. Credit */}
                              <td className={`px-1.5 py-2 text-center border-r ${cfg.border} ${cfg.cellBg}`}>
                                <EditableCell
                                  value={credit}
                                  isEditMode={isEditMode}
                                  isModified={isCellModified(employee.employeeId, lt.id, "creditedDays")}
                                  onChange={(newVal) =>
                                    handleCellChange(employee.employeeId, lt.id, "creditedDays", newVal)
                                  }
                                />
                              </td>

                              {/* 4. Earn */}
                              <td className={`px-1.5 py-2 text-center border-r ${cfg.border} ${cfg.cellBg}`}>
                                <EditableCell
                                  value={earn}
                                  isEditMode={isEditMode}
                                  isModified={isCellModified(employee.employeeId, lt.id, "earned")}
                                  onChange={(newVal) =>
                                    handleCellChange(employee.employeeId, lt.id, "earned", newVal)
                                  }
                                />
                              </td>

                              {/* 5. Taken (Read-only count formatted like 00.00) */}
                              <td className={`px-2 py-2 text-center font-mono text-[11px] text-slate-700 border-r ${cfg.border} ${cfg.cellBg}`}>
                                {formatNumber(taken)}
                              </td>

                              {/* 6. Total (Calculated total formatted like 03.00) */}
                              <td className={`px-2 py-2 text-center font-mono font-bold text-[11px] text-slate-900 border-r-2 border-slate-300 ${cfg.cellBg}`}>
                                {formatNumber(total)}
                              </td>
                            </Fragment>
                          );
                        })}

                        {/* LEAVE BALANCE IN DAYS Section: CL, ML, EL, RH */}
                        {activeLeaveTypes.map((lt) => {
                          const cfg = getLeaveConfig(lt);
                          const rec = getLeaveRecord(employee, lt.id, lt, leaveTypes);
                          const balanceVal = rec?.leaveBalance ?? 0;

                          return (
                            <td
                              key={`bal-cell-${employee.employeeId}-${lt.id}`}
                              className={`px-2 py-2 text-center border-r border-slate-200 ${cfg?.cellBg || "bg-slate-50"}`}
                            >
                              <EditableCell
                                value={balanceVal}
                                isEditMode={isEditMode}
                                isModified={isCellModified(employee.employeeId, lt.id, "leaveBalance")}
                                onChange={(newVal) =>
                                  handleCellChange(employee.employeeId, lt.id, "leaveBalance", newVal)
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                  {isLoading && (
                    <tr>
                      <td
                        colSpan={3 + activeLeaveTypes.length * 6 + activeLeaveTypes.length}
                        className="px-5 py-16 text-center text-slate-400"
                      >
                        <span className="inline-block size-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent mr-2" />
                        Loading leave eligibility records...
                      </td>
                    </tr>
                  )}

                  {!isLoading && visibleEmployees.length === 0 && (
                    <tr>
                      <td
                        colSpan={3 + activeLeaveTypes.length * 6 + activeLeaveTypes.length}
                        className="px-5 py-16 text-center text-slate-500"
                      >
                        {employees.length === 0
                          ? "No employee records found in the database."
                          : "No employees match the selected filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            {!isLoading && (
              <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
                <span>
                  Showing <strong>{visibleEmployees.length}</strong> of <strong>{employees.length}</strong> employees
                </span>
              </div>
            )}
          </main>

          {/* Action Buttons after the table */}
          {!isLoading && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                {isEditMode ? (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                    </span>
                    <span className="text-xs font-semibold text-amber-900">
                      Edit Mode Active
                    </span>
                    <span className="text-xs text-slate-500">
                      &mdash; {modifiedRecords.length > 0
                        ? `${modifiedRecords.length} record${modifiedRecords.length === 1 ? "" : "s"} modified (unsaved)`
                        : "Modify table values, then click Save or Cancel"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span className="text-xs text-slate-600">
                      Table is in <strong>read-only mode</strong> to prevent accidental edits. Click <strong>Edit</strong> to modify.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Button 1: Edit (switches to Cancel when in edit mode) */}
                <button
                  type="button"
                  onClick={handleEditToggle}
                  disabled={isSaving}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-6 text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm cursor-pointer ${isEditMode
                    ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    : "bg-[#2980b9] text-white hover:bg-[#206694]"
                    }`}
                >
                  {isEditMode ? (
                    <>
                      <X size={15} />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Pencil size={15} />
                      Edit
                    </>
                  )}
                </button>

                {/* Button 2: Save */}
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={!isEditMode || isSaving || modifiedRecords.length === 0}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-6 text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm ${!isEditMode || modifiedRecords.length === 0
                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                    : "cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800"
                    }`}
                >
                  {isSaving ? (
                    <>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Information Modal: Why and For What Leave Entitlement is used */}
      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] normal-case"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInfoModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="entitlement-info-title"
            className="relative my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                  <Info size={16} />
                </div>
                <div>
                  <h2 id="entitlement-info-title" className="text-base font-bold text-slate-900 leading-tight">
                    About Leave Entitlement
                  </h2>
                  <p className="text-[11px] text-slate-500">Employee quota balances, credited days, and tracking ledger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-3 text-xs text-slate-700 leading-relaxed">
              {/* 1. What it is */}
              <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3">
                <span className="font-semibold text-blue-950">What is it?</span>
                <p className="mt-0.5 text-blue-900/90 text-[11px] leading-relaxed">
                  <strong>Leave Entitlement</strong> is the live operational ledger displaying each staff member&apos;s allocated leave quota, brought-forward days (BF), credited days, days taken, and current available balance across each leave type.
                </p>
              </div>

              {/* 2. How it works & How to use it */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">How it works</span>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                    <li className="flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold">•</span>
                      <span><strong>Live Ledger:</strong> Shows quota, brought forward (BF), credited, taken, and net balance.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold">•</span>
                      <span><strong>Auto-Sync:</strong> Automatically deducts days as soon as leave requests are approved.</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">How to use it</span>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                    <li className="flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold">1.</span>
                      <span>Filter staff using the search bar, stream dropdowns, or department filters.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold">2.</span>
                      <span>Click <strong>Edit Mode</strong> to adjust individual staff allowances and click <strong>Save</strong>.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
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