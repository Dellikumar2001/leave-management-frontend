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
    } else if (typeof (doc as any).autoTable === "function") {
      (doc as any).autoTable({
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

      <div className="p-4 min-[801px]:ml-[175px] uppercase">
        <div className="mx-auto max-w-[1400px]">

          {/* ── Header */}
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700">
              <FileCheck size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 leading-tight">Leave Status Report</h1>
              <p className="text-xs font-normal normal-case text-slate-500 mt-0.5">
                Select your filters and click Generate to view leave status report.
              </p>
            </div>
          </header>

          {/* ── Filter Bar */}
          <section
            aria-label="Report filters"
            className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {/* Stream */}
            <div className="relative min-w-[140px]">
              <select
                id="filter-stream"
                aria-label="Filter by stream"
                value={streamFilter}
                onChange={(e) => handleStreamChange(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm normal-case text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              >
                <option value="">All Streams</option>
                {allStreams.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </div>

            {/* Department */}
            <div className="relative min-w-[180px]">
              <select
                id="filter-department"
                aria-label="Filter by department"
                value={departmentFilter}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm normal-case text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              >
                <option value="">All Departments</option>
                {allDepartments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </div>

            {/* Employee */}
            <div className="relative min-w-[200px]">
              <select
                id="filter-employee"
                aria-label="Filter by employee"
                value={employeeFilter}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm normal-case text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              >
                <option value="">All Employees</option>
                {allEmployeeOptions.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.name} ({emp.employeeId})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </div>

            {/* Date Range — Accessible only after selecting stream, department, and employee */}
            <div className="flex items-center gap-2">
              <input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDate(e.target.value)}
                disabled={!isDateAccessible}
                aria-label="Start date"
                title={
                  isDateAccessible
                    ? "Start date"
                    : "Select stream, department, and employee first to enable date selection"
                }
                className={`h-10 rounded-md border px-3 text-sm normal-case outline-none transition-colors ${
                  isDateAccessible
                    ? "border-slate-300 bg-white text-slate-700 cursor-pointer focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none opacity-60"
                }`}
              />
              <ArrowRight
                size={15}
                className={`shrink-0 ${isDateAccessible ? "text-slate-400" : "text-slate-300"}`}
                aria-hidden="true"
              />
              <input
                id="filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) => handleEndDate(e.target.value)}
                disabled={!isDateAccessible}
                aria-label="End date"
                title={
                  isDateAccessible
                    ? "End date"
                    : "Select stream, department, and employee first to enable date selection"
                }
                min={startDate || undefined}
                className={`h-10 rounded-md border px-3 text-sm normal-case outline-none transition-colors ${
                  isDateAccessible
                    ? "border-slate-300 bg-white text-slate-700 cursor-pointer focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                    : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none opacity-60"
                }`}
              />
            </div>

            {/* Status Filter */}
            <div className="relative min-w-[150px]">
              <select
                id="filter-status"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm normal-case text-slate-700 outline-none transition-colors focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              >
                <option value="">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </div>

            {/* Top Generate Button — triggers generation of the table */}
            <button
              id="btn-generate-leave-status"
              type="button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || Boolean(dateError)}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-800 px-5 text-sm font-medium text-white hover:bg-slate-700 transition-colors normal-case disabled:opacity-60 cursor-pointer"
            >
              {isGenerating ? (
                <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <FileCheck size={15} aria-hidden="true" />
              )}
              <span>{isGenerating ? "Generating…" : "Generate"}</span>
            </button>

            {/* Date validation error */}
            {dateError && (
              <p role="alert" className="w-full text-xs text-red-600 normal-case -mt-1">
                {dateError}
              </p>
            )}
          </section>

          {/* ── Active date range badge (shown only after generating) */}
          {hasGenerated && (startDate || endDate) && !dateError && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-medium text-emerald-700 normal-case">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Date filter active:&nbsp;
                <strong>{startDate || "Any"}</strong>
                &nbsp;→&nbsp;
                <strong>{endDate || "Any"}</strong>
              </span>
            </div>
          )}

          {/* ── Table Showcase OR Placeholder */}
          {!hasGenerated ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3">
                <FileCheck size={24} />
              </div>
              <p className="text-sm font-semibold text-slate-700 normal-case">
                Select the options to get the report.
              </p>
            </div>
          ) : (
            <main className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {error && (
                <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 normal-case">
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
                        <td colSpan={8} className="px-5 py-12 text-center text-slate-400 normal-case">
                          Generating report data…
                        </td>
                      </tr>
                    )}

                    {!isGenerating && !error && visibleEmployees.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center text-slate-500 normal-case">
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
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 normal-case">{startDate || "—"}</td>
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 normal-case">{endDate || "—"}</td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold normal-case ${
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
                        <td className="whitespace-nowrap px-5 py-4 text-slate-600 normal-case">
                          {getEmployeeRemark(emp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Footer summary & Export Trigger Button */}
              {!isGenerating && !error && visibleEmployees.length > 0 && (
                <div className="border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                  <p className="text-xs text-slate-500 normal-case">
                    Showing{" "}
                    <strong className="text-slate-700">{visibleEmployees.length}</strong> of{" "}
                    <strong className="text-slate-700">{reportEmployees.length}</strong> employee
                    {reportEmployees.length !== 1 ? "s" : ""}
                    {(startDate || endDate) && !dateError && (
                      <>
                        &nbsp;&middot; Period:{" "}
                        <strong className="text-slate-700">{startDate || "Any"}</strong>
                        {" → "}
                        <strong className="text-slate-700">{endDate || "Any"}</strong>
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      id="btn-export-leave-status-footer"
                      type="button"
                      onClick={handleToggleExportPreview}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700 transition-colors normal-case shadow-xs cursor-pointer"
                    >
                      <Download size={14} aria-hidden="true" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>
              )}
            </main>
          )}

          {/* ── Export Preview Section (Showcased below the table upon clicking Export) */}
          {hasGenerated && showExportPreview && (
            <section
              ref={previewRef}
              aria-label="Export file preview"
              className="mt-6 rounded-xl border-2 border-emerald-500/30 bg-white shadow-lg overflow-hidden transition-all"
            >
              {/* Preview Header Banner */}
              <div className="flex items-center justify-between gap-3 bg-slate-800 px-5 py-3 text-white">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400">
                    <Eye size={16} />
                  </span>
                  <h3 className="text-sm font-bold tracking-tight">File Preview</h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowExportPreview(false)}
                  title="Close preview"
                  className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Preview Sheet Container (Looks like the actual generated report file) */}
              <div className="p-6 bg-slate-50/50">
                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
                  {/* Top Left Current Date Display */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Leave Status Report</h4>
                      <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700 normal-case">
                        Date: {currentDateStr}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium normal-case">
                      {visibleEmployees.length} record{visibleEmployees.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Preview Table with export columns */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-800 text-white font-semibold">
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
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 normal-case">
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
                              <td className="px-4 py-2.5 whitespace-nowrap normal-case">{startDate || "—"}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap normal-case">{endDate || "—"}</td>
                              <td className="px-4 py-2.5 whitespace-nowrap normal-case">
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
                              <td className="px-4 py-2.5 normal-case">{getEmployeeRemark(emp)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500 normal-case">
                      Ready to download in your preferred format:
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePdf}
                        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors normal-case shadow-xs cursor-pointer"
                      >
                        <FileText size={13} />
                        <span>Download PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleExcel}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors normal-case shadow-xs cursor-pointer"
                      >
                        <FileSpreadsheet size={13} />
                        <span>Download Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCsv}
                        className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors normal-case shadow-xs cursor-pointer"
                      >
                        <FileText size={13} />
                        <span>Download CSV</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
