"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import LeaveSidebar from "../../components/LeaveSidebar";

/* ─── Types ──────────────────────────────────────────────────── */

type EmployeeSummary = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  status: string;
  gender: string;
};

type LeaveApplicationItem = {
  id: number;
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: string;
  appliedAt: string;
  reviewedBy: string;
  remarks: string;
};

type ReportApiResponse = {
  employee: EmployeeSummary;
  allEmployees: EmployeeSummary[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  applications: LeaveApplicationItem[];
  error?: string;
};

/* ─── Helpers ────────────────────────────────────────────────── */

function buildExportRows(
  employee: EmployeeSummary,
  applications: LeaveApplicationItem[],
  startDate: string,
  endDate: string
) {
  const headers = [
    "EMPLOYEE ID",
    "NAME",
    "LEAVE TYPE",
    "DATE FROM",
    "DATE TO",
    "DAYS",
    "REASON",
    "STATUS",
    "REMARKS",
  ];

  if (applications.length === 0) {
    return {
      headers,
      rows: [
        [
          employee.employeeId,
          employee.name,
          "—",
          startDate || "—",
          endDate || "—",
          0,
          "—",
          employee.status || "Approved",
          "—",
        ],
      ],
    };
  }

  const rows = applications.map((app) => [
    employee.employeeId,
    employee.name,
    `${app.leaveTypeName} (${app.leaveTypeCode})`,
    startDate || app.startDate || "—",
    endDate || app.endDate || "—",
    app.daysCount || 1,
    app.reason || "—",
    app.status || "Approved",
    app.remarks && app.remarks !== "—" ? app.remarks : "—",
  ]);

  return { headers, rows };
}

/* ─── Employee Leave Status Report Page ──────────────────────── */

export default function EmployeeStatusReportPage() {
  // Current employee session (represents the authenticated / logged-in employee)
  const [currentEmployee, setCurrentEmployee] = useState<EmployeeSummary | null>(null);
  const [employeeId, setEmployeeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("employee_status_logged_in_id") || "";
    }
    return "";
  });

  // Generated report state
  const [reportApplications, setReportApplications] = useState<LeaveApplicationItem[]>([]);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Preview state
  const [showExportPreview, setShowExportPreview] = useState<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateError, setDateError] = useState<string>("");

  // Load logged-in employee profile (randomly chosen on initial session)
  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      try {
        const savedId =
          typeof window !== "undefined"
            ? sessionStorage.getItem("employee_status_logged_in_id")
            : "";
        const queryId = savedId || "random";
        const res = await fetch(
          `/api/employee-status-report?employeeId=${encodeURIComponent(queryId)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as ReportApiResponse;
        if (mounted && res.ok && data.employee) {
          setCurrentEmployee(data.employee);
          setEmployeeId(data.employee.employeeId);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(
              "employee_status_logged_in_id",
              data.employee.employeeId
            );
          }
        }
      } catch (err: unknown) {
        console.error("Failed to load employee profile", err);
      }
    }
    void loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  // Date range validation
  const handleStartDate = (value: string) => {
    setStartDate(value);
    if (endDate && value && value > endDate) {
      setDateError("Start date cannot be after end date.");
    } else {
      setDateError("");
    }
  };

  const handleEndDate = (value: string) => {
    setEndDate(value);
    if (startDate && value && value < startDate) {
      setDateError("End date cannot be before start date.");
    } else {
      setDateError("");
    }
  };

  // Generate button handler
  const handleGenerate = async () => {
    if (dateError) return;
    setIsGenerating(true);
    setError("");
    setShowExportPreview(false);

    try {
      const activeId = employeeId || currentEmployee?.employeeId || "EMP-001";
      const params = new URLSearchParams();
      params.set("employeeId", activeId);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/employee-status-report?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ReportApiResponse;

      if (!res.ok) {
        throw new Error(data.error || "Unable to generate leave status report.");
      }

      setCurrentEmployee(data.employee);
      setReportApplications(data.applications ?? []);
      setHasGenerated(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to generate report.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle export preview and smoothly scroll down to it
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

  // Filtered applications by status
  const visibleApplications = statusFilter
    ? reportApplications.filter((a) => a.status.toLowerCase() === statusFilter.toLowerCase())
    : reportApplications;

  // ────────────────────────────────────────────
  // ── Export handlers (Identical alignment and layout to Leave Status Report)
  // ────────────────────────────────────────────

  const handleCsv = () => {
    if (!currentEmployee) return;
    const { headers, rows } = buildExportRows(
      currentEmployee,
      visibleApplications,
      startDate,
      endDate
    );
    const currentDate = new Date().toISOString().split("T")[0];
    const lines = [
      `"Individual Status Report"`,
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
    a.download = "Individual Status Report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcel = async () => {
    if (!currentEmployee) return;
    const { headers, rows } = buildExportRows(
      currentEmployee,
      visibleApplications,
      startDate,
      endDate
    );
    const currentDate = new Date().toISOString().split("T")[0];

    try {
      const ExcelJSModule = await import("exceljs");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ExcelJS: any = (ExcelJSModule as any).default || ExcelJSModule;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Leave Management System";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Individual Status Report", {
        views: [{ showGridLines: true }],
      });

      // ── Row 1: Header Title Banner "Individual Status Report"
      worksheet.mergeCells("A1:I1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = "Individual Status Report";
      titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" }, // Dark Slate/Navy
      };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 36;

      // ── Row 2: Sub-info row (Date only)
      worksheet.mergeCells("A2:I2");
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

      // ── Row 4: Column Headers
      const headerRow = worksheet.getRow(4);
      headerRow.values = headers;
      headerRow.height = 28;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      headerRow.eachCell((cell: any, colNumber: number) => {
        cell.font = {
          name: "Segoe UI",
          size: 11,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1E293B" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal:
            colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 7 || colNumber === 9
              ? "left"
              : "center",
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
            horizontal:
              colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 7 || colNumber === 9
                ? "left"
                : "center",
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
        { key: "empId", width: 16 },
        { key: "name", width: 22 },
        { key: "leaveType", width: 22 },
        { key: "dateFrom", width: 15 },
        { key: "dateTo", width: 15 },
        { key: "days", width: 10 },
        { key: "reason", width: 32 },
        { key: "status", width: 14 },
        { key: "remarks", width: 24 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Individual Status Report.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate Excel file", err);
    }
  };

  const handlePdf = async () => {
    if (!currentEmployee) return;
    const { headers, rows } = buildExportRows(
      currentEmployee,
      visibleApplications,
      startDate,
      endDate
    );
    const currentDate = new Date().toISOString().split("T")[0];

    try {
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
      doc.text("Individual Status Report", 40, 42);

      // Date (Below Title)
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Date: ${currentDate}`, 40, 58);

      const tableOptions = {
        head: [headers],
        body: rows,
        startY: 75,
        styles: { fontSize: 8, cellPadding: 5, valign: "middle" },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "left" },
          2: { halign: "left" },
          3: { halign: "center" },
          4: { halign: "center" },
          5: { halign: "center" },
          6: { halign: "left" },
          7: { halign: "center" },
          8: { halign: "left" },
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontStyle: "bold",
          valign: "middle",
        },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 40, right: 40 },
      };

      if (typeof autoTable === "function") {
        autoTable(doc, tableOptions);
      } else if (
        typeof (doc as unknown as { autoTable?: (options: unknown) => void }).autoTable === "function"
      ) {
        (doc as unknown as { autoTable: (options: unknown) => void }).autoTable(tableOptions);
      }

      doc.save("Individual Status Report.pdf");
    } catch (err) {
      console.error("Failed to generate PDF file", err);
    }
  };

  const currentDateStr = new Date().toISOString().split("T")[0];

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="employee-status-report" />

      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px]">

          {/* ── Header (Exact alignment matching Leave Status Report module) */}
          <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                <span>Leave Admin</span>
                <span>/</span>
                <span>Leave Report</span>
                <span>/</span>
                <span className="font-semibold text-slate-800">Individual Status Report</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-800">
                Individual Status Report
              </h1>
            </div>
          </header>

          {/* ── Filter Bar (Balanced grid with clean label & input alignment) */}
          <section
            aria-label="Report filters"
            className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
              {/* Logged In Employee (Non-selectable, reflects current login) */}
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 xl:col-span-4">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Employee
                </span>
                <div className="relative flex h-10 w-full items-center rounded-md border border-slate-300 bg-slate-100/80 px-3 text-sm font-semibold text-slate-800 select-none cursor-default">
                  <div className="flex items-center gap-2 truncate">
                    <User size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate">
                      {currentEmployee
                        ? `${currentEmployee.name} (${currentEmployee.employeeId})`
                        : "Loading..."}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date Range Inputs */}
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 xl:col-span-4">
                <span className="text-[11px] font-semibold uppercase text-slate-500">Date Range</span>
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    id="filter-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDate(e.target.value)}
                    aria-label="Start date"
                    className="h-10 min-w-0 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700 cursor-pointer outline-none transition-colors focus:border-blue-400"
                  />
                  <ArrowRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <input
                    id="filter-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDate(e.target.value)}
                    aria-label="End date"
                    min={startDate || undefined}
                    className="h-10 min-w-0 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700 cursor-pointer outline-none transition-colors focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex min-w-0 flex-col gap-1 sm:col-span-1 xl:col-span-2">
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
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Generate Button */}
              <button
                id="btn-generate-employee-leave-status"
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || Boolean(dateError)}
                className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:col-span-1 xl:col-span-2 ${
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

          {/* ── Table Showcase OR Placeholder (Exact style as Leave Status Report) */}
          {!hasGenerated ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-3">
                <FileCheck size={24} />
              </div>
              <p className="text-sm font-semibold text-slate-700">
                Please select the date range and click Generate to view the leave status report.
              </p>
            </div>
          ) : (
            <main className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {error && (
                <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {/* ── Main Report Table (Aligned column headers & table cells) */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left">
                        EMPLOYEE ID
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left">
                        NAME
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left">
                        LEAVE TYPE
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left">
                        DATE FROM
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left">
                        DATE TO
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-center">
                        DAYS
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left">
                        REASON
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left">
                        STATUS
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left">
                        REMARKS
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {isGenerating && (
                      <tr>
                        <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                          Generating report data…
                        </td>
                      </tr>
                    )}

                    {!isGenerating &&
                      !error &&
                      visibleApplications.length === 0 && (
                        <tr className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                          <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700 align-middle text-left">
                            {currentEmployee?.employeeId}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800 align-middle text-left">
                            {currentEmployee?.name}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-500 align-middle text-left">
                            —
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600 align-middle text-left">
                            {startDate || "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600 align-middle text-left">
                            {endDate || "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-700 font-medium text-center align-middle">
                            0
                          </td>
                          <td className="px-5 py-4 text-slate-500 max-w-sm break-words align-middle text-left">
                            —
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 align-middle text-left">
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              {currentEmployee?.status || "Approved"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600 align-middle text-left">
                            —
                          </td>
                        </tr>
                      )}

                    {!isGenerating &&
                      !error &&
                      visibleApplications.map((app) => (
                        <tr
                          key={app.id}
                          className="border-t border-slate-200 hover:bg-slate-50 transition-colors"
                        >
                          <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700 align-middle text-left">
                            {currentEmployee?.employeeId}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800 align-middle text-left">
                            {currentEmployee?.name}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-700 align-middle text-left">
                            {app.leaveTypeName} ({app.leaveTypeCode})
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600 align-middle text-left">
                            {startDate || app.startDate || "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600 align-middle text-left">
                            {endDate || app.endDate || "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-700 font-medium text-center align-middle">
                            {app.daysCount || 1}
                          </td>
                          <td className="px-5 py-4 text-slate-700 max-w-sm break-words align-middle text-left">
                            {app.reason || "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 align-middle text-left">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                app.status?.toLowerCase() === "approved"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : app.status?.toLowerCase() === "pending"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : app.status?.toLowerCase() === "rejected"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  app.status?.toLowerCase() === "approved"
                                    ? "bg-emerald-500"
                                    : app.status?.toLowerCase() === "pending"
                                    ? "bg-amber-500"
                                    : app.status?.toLowerCase() === "rejected"
                                    ? "bg-red-500"
                                    : "bg-slate-400"
                                }`}
                              />
                              {app.status || "Approved"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 text-slate-600 align-middle text-left">
                            {app.remarks && app.remarks !== "—" ? app.remarks : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* ── Footer Export Trigger Button */}
              {!isGenerating && !error && currentEmployee && (
                <div className="flex items-center justify-end border-t border-slate-100 px-5 py-3">
                  <button
                    id="btn-export-employee-leave-status-footer"
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
          {hasGenerated && showExportPreview && currentEmployee && (
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

              {/* Preview Sheet Container (Exact Leave Status Report module styling) */}
              <div className="bg-[#f5f7fa] p-4 sm:p-6">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                  {/* Top Left Current Date Display */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">Individual Status Report</h4>
                      <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                        Date: {currentDateStr}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {Math.max(visibleApplications.length, 1)} record
                      {visibleApplications.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Preview Table with consistent cell and header alignments */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 font-semibold text-slate-600">
                        <tr>
                          <th className="px-4 py-2.5 whitespace-nowrap text-left">EMPLOYEE ID</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-left">NAME</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-left">LEAVE TYPE</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-left">DATE FROM</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-left">DATE TO</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-center">DAYS</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-left">REASON</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-left">STATUS</th>
                          <th className="px-4 py-2.5 whitespace-nowrap text-left">REMARKS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {visibleApplications.length === 0 ? (
                          <tr className="bg-white">
                            <td className="px-4 py-2.5 font-medium whitespace-nowrap text-left align-middle">
                              {currentEmployee.employeeId}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap text-left align-middle">
                              {currentEmployee.name}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-slate-500 text-left align-middle">
                              —
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle">
                              {startDate || "—"}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle">
                              {endDate || "—"}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-800 text-center align-middle">
                              0
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-left align-middle">
                              —
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle">
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {currentEmployee.status || "Approved"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-left align-middle">
                              —
                            </td>
                          </tr>
                        ) : (
                          visibleApplications.map((app, idx) => (
                            <tr
                              key={`prev-${app.id}`}
                              className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
                            >
                              <td className="px-4 py-2.5 font-medium whitespace-nowrap text-left align-middle">
                                {currentEmployee.employeeId}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap text-left align-middle">
                                {currentEmployee.name}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle">
                                {app.leaveTypeName} ({app.leaveTypeCode})
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle">
                                {startDate || app.startDate || "—"}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle">
                                {endDate || app.endDate || "—"}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-800 text-center align-middle">
                                {app.daysCount || 1}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle" title={app.reason}>
                                {app.reason || "—"}
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                                    app.status?.toLowerCase() === "approved"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : app.status?.toLowerCase() === "pending"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : app.status?.toLowerCase() === "rejected"
                                      ? "bg-red-50 text-red-700 border border-red-200"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  {app.status || "Approved"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap text-left align-middle">
                                {app.remarks && app.remarks !== "—" ? app.remarks : "—"}
                              </td>
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
