"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  X,
} from "lucide-react";
import LeaveSidebar from "../../components/LeaveSidebar";

/* ─── Types ──────────────────────────────────────────────────── */

type LeaveType = {
  id: number;
  code: string;
  name: string;
  daysAllowed: number;
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
  status?: string;
  remarks?: string | null;
  leaveRecords: EmployeeLeaveRecord[];
};

type ReportData = {
  employees: Employee[];
  leaveTypes: LeaveType[];
};

/* ─── Helpers ────────────────────────────────────────────────── */

function getEmployeeRemark(employee: Employee): string {
  if (employee.remarks && employee.remarks.trim()) {
    return employee.remarks.trim();
  }
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("paternity_submitted_records");
      if (saved) {
        const records = JSON.parse(saved);
        if (Array.isArray(records)) {
          const found = records.find(
            (r: { employeeId?: string; remarkText?: string }) =>
              r.employeeId === employee.employeeId
          );
          if (found?.remarkText?.trim()) return found.remarkText.trim();
        }
      }
    } catch {}
  }
  return "—";
}

/* ─── Build flat rows for export & preview (Columns including STATUS) ─ */

function buildExportRows(
  visibleEmployees: Employee[],
  startDate: string,
  endDate: string
) {
  const headers = ["EMPLOYEE ID", "NAME", "DATE FROM", "DATE TO", "STATUS", "REMARKS"];
  const rows = visibleEmployees.map((emp) => [
    emp.employeeId,
    emp.name,
    startDate || "—",
    endDate || "—",
    emp.status || "Approved",
    getEmployeeRemark(emp),
  ]);
  return { headers, rows };
}

/* ─── Leave Status Report Page ───────────────────────────────── */

export default function LeaveStatusReportPage() {
  // Dropdown options source
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  // Generated report state
  const [reportEmployees, setReportEmployees] = useState<Employee[]>([]);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Preview state
  const [showExportPreview, setShowExportPreview] = useState<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Filters
  const [streamFilter, setStreamFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Date range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");

  // Load initial dropdown options on mount
  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const res = await fetch("/api/leave-status-report", { cache: "no-store" });
        const data = (await res.json()) as ReportData;
        if (mounted && res.ok) {
          setAllEmployees(data.employees ?? []);
        }
      } catch (err: unknown) {
        console.error("Failed to load filter options", err);
      }
    }
    void loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  // Derived options for filter selects
  const allStreams = useMemo(
    () => [...new Set(allEmployees.map((e) => e.stream))].filter(Boolean).sort(),
    [allEmployees]
  );
  const allDepartments = useMemo(() => {
    const src = streamFilter ? allEmployees.filter((e) => e.stream === streamFilter) : allEmployees;
    return [...new Set(src.map((e) => e.department))].filter(Boolean).sort();
  }, [allEmployees, streamFilter]);
  const allEmployeeOptions = useMemo(() => {
    let src = allEmployees;
    if (streamFilter) src = src.filter((e) => e.stream === streamFilter);
    if (departmentFilter) src = src.filter((e) => e.department === departmentFilter);
    return [...src].sort((a, b) => a.name.localeCompare(b.name));
  }, [allEmployees, streamFilter, departmentFilter]);

  // Date range validation
  const handleStartDate = (value: string) => {
    setStartDate(value);
    if (endDate && value && value > endDate) setDateError("Start date cannot be after end date.");
    else setDateError("");
  };

  const handleEndDate = (value: string) => {
    setEndDate(value);
    if (startDate && value && value < startDate) setDateError("End date cannot be before start date.");
    else setDateError("");
  };

  // Date accessibility: only accessible after selecting stream, department, and employee
  const isDateAccessible = Boolean(streamFilter && departmentFilter && employeeFilter);

  // Reset dependent filters and dates when parent changes
  const handleStreamChange = (v: string) => {
    setStreamFilter(v);
    setDepartmentFilter("");
    setEmployeeFilter("");
    setStartDate("");
    setEndDate("");
    setDateError("");
  };
  const handleDepartmentChange = (v: string) => {
    setDepartmentFilter(v);
    setEmployeeFilter("");
    setStartDate("");
    setEndDate("");
    setDateError("");
  };
  const handleEmployeeChange = (v: string) => {
    setEmployeeFilter(v);
    if (!v) {
      setStartDate("");
      setEndDate("");
      setDateError("");
    }
  };

  // Generate button handler: fetches report matching the selected filters and showcases table
  const handleGenerate = async () => {
    // Validate that date range is only used after selecting required filters
    if ((startDate || endDate) && (!streamFilter || !departmentFilter || !employeeFilter)) {
      setError("Please select stream, department, and employee before applying a date range.");
      return;
    }
    if (dateError) return;
    setError("");
    setIsGenerating(true);
    setHasGenerated(true);

    try {
      const params = new URLSearchParams();
      if (streamFilter) params.set("stream", streamFilter);
      if (departmentFilter) params.set("department", departmentFilter);
      if (employeeFilter) params.set("employeeId", employeeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(
        `/api/leave-status-report${params.size ? `?${params}` : ""}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as ReportData;
      if (!res.ok) throw new Error((data as unknown as { error?: string }).error ?? "Failed to generate report.");
      setReportEmployees(data.employees ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate report.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Visible rows after status filter applied to generated report
  const visibleEmployees = useMemo(() => {
    return reportEmployees.filter((e) => {
      if (streamFilter && e.stream !== streamFilter) return false;
      if (departmentFilter && e.department !== departmentFilter) return false;
      if (employeeFilter && e.employeeId !== employeeFilter) return false;
      if (statusFilter && e.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
      return true;
    });
  }, [reportEmployees, streamFilter, departmentFilter, employeeFilter, statusFilter]);

  // Toggle preview and smoothly scroll down to it
  const handleToggleExportPreview = () => {
    setShowExportPreview((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => {
          previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
      return next;
    });
  };

  // ────────────────────────────────────────────
  // ── Export handlers (Showcase current date in top left, followed by:
  //    EMPLOYEE ID, NAME, DATE FROM, DATE TO, REMARKS)
  // ────────────────────────────────────────────

  const handleCsv = () => {
    const { headers, rows } = buildExportRows(visibleEmployees, startDate, endDate);
    const currentDate = new Date().toISOString().split("T")[0];
    const lines = [
      `"Leave Status Report"`,
      `"Date: ${currentDate}"`,
      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) =>
        row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")
      ),
    ];
    const csv = lines.join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "Leave Status Report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcel = async () => {
    const { headers, rows } = buildExportRows(visibleEmployees, startDate, endDate);
    const currentDate = new Date().toISOString().split("T")[0];
    const ExcelJSModule = await import("exceljs");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ExcelJS: any = (ExcelJSModule as any).default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Leave Management System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Leave Status Report", {
      views: [{ showGridLines: true }],
    });

    // ── Row 1: Header Title Banner "Leave Status Report"
    worksheet.mergeCells("A1:F1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Leave Status Report";
    titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Dark Slate/Navy
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 36;

    // ── Row 2: Sub-info row (Date only)
    worksheet.mergeCells("A2:F2");
    const infoCell = worksheet.getCell("A2");
    infoCell.value = `Date: ${currentDate}`;
    infoCell.font = { name: "Segoe UI", size: 10, italic: true, color: { argb: "FF475569" } };
    infoCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF8FAFC" },
    };
    infoCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    worksheet.getRow(2).height = 22;

    // ── Row 3: Blank separator row
    worksheet.getRow(3).height = 10;

    // ── Row 4: Highlighted Column Headers (EMPLOYEE ID, NAME, DATE FROM, DATE TO, STATUS, REMARKS)
    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 28;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headerRow.eachCell((cell: any, colNumber: number) => {
      cell.font = {
        name: "Segoe UI",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" }, // White bold text
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" }, // Highlighted dark background
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 2 || colNumber === 6 ? "left" : "center",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } },
      };
    });

    // ── Row 5+: Data rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows.forEach((row: any[], rowIndex: number) => {
      const dataRow = worksheet.addRow(row);
      dataRow.height = 22;
      const isEven = rowIndex % 2 === 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dataRow.eachCell((cell: any, colNumber: number) => {
        cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF1E293B" } };
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 2 || colNumber === 6 ? "left" : "center",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8FAFC" },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });

    // Column widths
    worksheet.columns = [
      { key: "empId", width: 20 },
      { key: "name", width: 30 },
      { key: "dateFrom", width: 18 },
      { key: "dateTo", width: 18 },
      { key: "status", width: 16 },
      { key: "remarks", width: 36 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Leave Status Report.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdf = async () => {
    const { headers, rows } = buildExportRows(visibleEmployees, startDate, endDate);
    const currentDate = new Date().toISOString().split("T")[0];
    const jspdfModule = await import("jspdf");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsPDF = (jspdfModule as any).default || (jspdfModule as any).jsPDF || jspdfModule;
    const autoTableModule = await import("jspdf-autotable");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoTable = (autoTableModule as any).default || autoTableModule;

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    // Document Title (Top)
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Leave Status Report", 40, 42);

    // Date (Below Title)
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Date: ${currentDate}`, 40, 58);

    if (typeof autoTable === "function") {
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 75,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 40, right: 40 },
      });
    } else if (typeof (doc as unknown as { autoTable?: (options: unknown) => void }).autoTable === "function") {
      (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
        head: [headers],
        body: rows,
        startY: 75,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 40, right: 40 },
      });
    }

    doc.save("Leave Status Report.pdf");
  };

  const currentDateStr = new Date().toISOString().split("T")[0];

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="leave-status-report" />

      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px]">

          {/* ── Header */}
          <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                <span>Leave Admin</span>
                <span>/</span>
                <span>Leave Report</span>
                <span>/</span>
                <span className="font-semibold text-slate-800">Leave Status Report</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-800">
                Leave Status Report
              </h1>
            </div>
          </header>

          {/* ── Filter Bar */}
          <section
            aria-label="Report filters"
            className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-13">
              {/* Stream */}
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-2">
                <label htmlFor="filter-stream" className="text-[11px] font-semibold uppercase text-slate-500">
                  Stream
                </label>
                <div className="relative">
                  <select
                    id="filter-stream"
                    aria-label="Filter by stream"
                    value={streamFilter}
                    onChange={(e) => handleStreamChange(e.target.value)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
                  >
                    <option value="">All Streams</option>
                    {allStreams.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                </div>
              </div>

              {/* Department */}
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-2">
                <label htmlFor="filter-department" className="text-[11px] font-semibold uppercase text-slate-500">
                  Departments
                </label>
                <div className="relative">
                  <select
                    id="filter-department"
                    aria-label="Filter by department"
                    value={departmentFilter}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
                  >
                    <option value="">All Departments</option>
                    {allDepartments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                </div>
              </div>

              {/* Employee */}
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-2">
                <label htmlFor="filter-employee" className="text-[11px] font-semibold uppercase text-slate-500">
                  Employee Names
                </label>
                <div className="relative">
                  <select
                    id="filter-employee"
                    aria-label="Filter by employee"
                    value={employeeFilter}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
                  >
                    <option value="">All Employees</option>
                    {allEmployeeOptions.map((emp) => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.name} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                </div>
              </div>

              {/* Date Range — Accessible only after selecting stream, department, and employee */}
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-3">
                <span className="text-[11px] font-semibold uppercase text-slate-500">Date Range</span>
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    id="filter-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDate(e.target.value)}
                    disabled={!isDateAccessible}
                    aria-label="Start date"
                    title={isDateAccessible ? "Start date" : "Select stream, department, and employee first to enable date selection"}
                    className={`h-10 min-w-0 w-full rounded-md border px-2 text-sm outline-none transition-colors ${
                      isDateAccessible
                        ? "border-slate-300 bg-white text-slate-700 cursor-pointer focus:border-blue-400"
                        : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none opacity-60"
                    }`}
                  />
                  <ArrowRight size={15} className={`shrink-0 ${isDateAccessible ? "text-slate-400" : "text-slate-300"}`} aria-hidden="true" />
                  <input
                    id="filter-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDate(e.target.value)}
                    disabled={!isDateAccessible}
                    aria-label="End date"
                    title={isDateAccessible ? "End date" : "Select stream, department, and employee first to enable date selection"}
                    min={startDate || undefined}
                    className={`h-10 min-w-0 w-full rounded-md border px-2 text-sm outline-none transition-colors ${
                      isDateAccessible
                        ? "border-slate-300 bg-white text-slate-700 cursor-pointer focus:border-blue-400"
                        : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none opacity-60"
                    }`}
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-2">
                <label htmlFor="filter-status" className="text-[11px] font-semibold uppercase text-slate-500">
                  Status
                </label>
                <div className="relative">
                  <select
                    id="filter-status"
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
                  >
                    <option value="">All Statuses</option>
                    <option value="Approved">Approved</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                </div>
              </div>

              {/* Generate Button */}
              <button
                id="btn-generate-leave-status"
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || Boolean(dateError)}
                className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors xl:col-span-2 ${
                  isGenerating || Boolean(dateError)
                    ? "cursor-not-allowed bg-slate-200 text-slate-400"
                    : "bg-slate-800 text-white shadow-sm hover:bg-slate-700"
                }`}
              >
                {isGenerating ? (
                  <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <FileCheck size={15} aria-hidden="true" />
                )}
                <span>{isGenerating ? "Generating…" : "Generate"}</span>
              </button>
            </div>

            {/* Date validation error */}
            {dateError && (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {dateError}
              </p>
            )}
          </section>


          {/* ── Table Showcase OR Placeholder */}
          {!hasGenerated ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3">
                <FileCheck size={24} />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Select the options to get the report.
              </p>
            </div>
          ) : (
            <main className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {error && (
                <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {/* ── Main Report Table (leave status, days allowed, and balance removed) */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">EMPLOYEE ID</th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">EMPLOYEE NAME</th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">STREAM</th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">DEPARTMENT</th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">DATE FROM</th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">DATE TO</th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">STATUS</th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">REMARKS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {isGenerating && (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                          Generating report data…
                        </td>
                      </tr>
                    )}

                    {!isGenerating && !error && visibleEmployees.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                          No employees match the selected filters.
                        </td>
                      </tr>
                    )}

                    {!isGenerating && !error && visibleEmployees.map((emp) => (
                      <tr key={emp.employeeId} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">{emp.employeeId}</td>
                        <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800">{emp.name}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{emp.stream}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">{emp.department}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">{startDate || "—"}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">{endDate || "—"}</td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              emp.status?.toLowerCase() === "approved"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : emp.status?.toLowerCase() === "pending"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : emp.status?.toLowerCase() === "rejected"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                emp.status?.toLowerCase() === "approved"
                                  ? "bg-emerald-500"
                                  : emp.status?.toLowerCase() === "pending"
                                  ? "bg-amber-500"
                                  : emp.status?.toLowerCase() === "rejected"
                                  ? "bg-red-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            {emp.status || "Approved"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                          {getEmployeeRemark(emp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Footer Export Trigger Button */}
              {!isGenerating && !error && visibleEmployees.length > 0 && (
                <div className="flex items-center justify-end border-t border-slate-100 px-5 py-3">
                  <button
                    id="btn-export-leave-status-footer"
                    type="button"
                    onClick={handleToggleExportPreview}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
                  >
                    <Download size={14} aria-hidden="true" />
                    <span>Export</span>
                  </button>
                </div>
              )}
            </main>
          )}

          {/* ── Export Preview Section (Showcased below the table upon clicking Export) */}
          {hasGenerated && showExportPreview && (
            <section
              ref={previewRef}
              aria-label="Export file preview"
              className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all"
            >
              {/* Preview Header Banner */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#f5f7fa] px-5 py-4 text-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-md bg-emerald-100 text-emerald-700">
                    <Eye size={16} />
                  </span>
                  <h3 className="text-sm font-semibold">FILE PREVIEW</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowExportPreview(false)}
                  title="Close preview"
                  className="grid size-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Preview Sheet Container (Looks like the actual generated report file) */}
              <div className="bg-[#f5f7fa] p-4 sm:p-6">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                  {/* Top Left Current Date Display */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Leave Status Report</h4>
                      <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                        Date: {currentDateStr}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {visibleEmployees.length} record{visibleEmployees.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Preview Table with export columns */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 font-semibold text-slate-600">
                        <tr>
                          <th className="px-4 py-2.5 whitespace-nowrap">EMPLOYEE ID</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">NAME</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">DATE FROM</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">DATE TO</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">STATUS</th>
                          <th className="px-4 py-2.5 whitespace-nowrap">REMARKS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {visibleEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                              No records to export.
                            </td>
                          </tr>
                        ) : (
                          visibleEmployees.map((emp, idx) => (
                            <tr
                              key={`prev-${emp.employeeId}`}
                              className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
                            >
                              <td className="px-4 py-2.5 font-medium whitespace-nowrap">{emp.employeeId}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{emp.name}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">{startDate || "—"}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">{endDate || "—"}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                    emp.status?.toLowerCase() === "approved"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : emp.status?.toLowerCase() === "pending"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : emp.status?.toLowerCase() === "rejected"
                                      ? "bg-red-50 text-red-700 border border-red-200"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  {emp.status || "Approved"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">{getEmployeeRemark(emp)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Action Footer */}
                  <footer className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Ready to download in your preferred format:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePdf}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                      >
                        <FileText size={13} />
                        <span>Download PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExcel}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                      >
                        <FileSpreadsheet size={13} />
                        <span>Download Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCsv}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
                      >
                        <FileText size={13} />
                        <span>Download CSV</span>
                      </button>
                    </div>
                  </footer>

                </div>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
