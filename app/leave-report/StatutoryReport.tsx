"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import DateInput, { formatDisplayDate } from "../components/DateInput";

/* ─── Types ───────────────────────────────────────────────── */

export type LeaveRecord = { 
  leaveTypeId: number;
  isEligible: boolean;
  daysAllowed: number;
  leaveBalance: number;
  joiningDate?: string | Date;
  gender?: string;
};

export type Employee = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  gender: string;
  leaveRecords: LeaveRecord[];
};

export type LeaveType = {
  id: number;
  code: string;
  name: string;
  status: string;
  daysAllowed: number;
};

export type StatutoryReportData = {
  employees: Employee[];
  leaveTypes: LeaveType[];
};

type ReportRow = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  remarks: string;
};

const reportColumns: { key: keyof ReportRow; label: string; weight: number }[] = [
  { key: "employeeId", label: "EMPLOYEE ID", weight: 1 },
  { key: "name", label: "EMPLOYEE NAME", weight: 1.4 },
  { key: "stream", label: "STREAM", weight: 0.9 },
  { key: "department", label: "DEPARTMENT", weight: 1.5 },
  { key: "dateFrom", label: "DATE FROM", weight: 1.1 },
  { key: "dateTo", label: "DATE TO", weight: 1.1 },
  { key: "remarks", label: "REMARKS", weight: 0.8 },
];

async function createReportPdf(rows: ReportRow[], reportDate: string, reportTitle: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const tableWidth = pageWidth - margin * 2;
  const totalWeight = reportColumns.reduce((total, column) => total + column.weight, 0);
  const columnWidths = reportColumns.map((column) => (tableWidth * column.weight) / totalWeight);
  const headerHeight = 10;
  const rowHeight = 11;
  let y = 39;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Date: ${formatDisplayDate(reportDate)}`, margin, 17);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(31, 41, 55);
  pdf.text(reportTitle.toUpperCase(), margin, 27);

  const drawHeader = () => {
    let x = margin;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.setFillColor(31, 41, 55);
    pdf.rect(margin, y, tableWidth, headerHeight, "F");
    reportColumns.forEach((column, index) => {
      pdf.text(column.label, x + 2, y + 6.5);
      x += columnWidths[index];
    });
    y += headerHeight;
  };

  drawHeader();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
      drawHeader();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
    }
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(244, 246, 250);
      pdf.rect(margin, y, tableWidth, rowHeight, "F");
    }
    let x = margin;
    reportColumns.forEach((column, index) => {
      const lines = pdf.splitTextToSize(String(row[column.key]), columnWidths[index] - 4).slice(0, 2);
      pdf.setTextColor(51, 65, 85);
      pdf.text(lines, x + 2, y + 4.5);
      x += columnWidths[index];
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    y += rowHeight;
  });

  return pdf.output("blob");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createCsvBlob(rows: ReportRow[], reportDate: string, reportTitle: string) {
  const csvRows = [
    ["Date", formatDisplayDate(reportDate)],
    [reportTitle.toUpperCase()],
    reportColumns.map((column) => column.label),
    ...rows.map((row) => reportColumns.map((column) => row[column.key])),
  ];
  const csv = csvRows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

/* ─── MultiSelect Component ───────────────────────────────── */

export function MultiSelect({
  id,
  placeholder,
  options,
  selected,
  onChange,
  disabled = false,
}: {
  id: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSearch("");
    }
  }

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    }
  }, [open]);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const removeOption = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== option));
  };

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex h-10 w-full items-center justify-between gap-1.5 rounded-md border bg-white px-3 text-left text-sm normal-case transition-colors outline-none ${disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
            : open
              ? "border-blue-400 ring-2 ring-blue-100"
              : "border-slate-300 hover:border-slate-400 focus:border-blue-400 cursor-pointer"
          }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap">
          {selected.length === 0 ? (
            <span className="truncate text-slate-500">{placeholder}</span>
          ) : selected.length === 1 ? (
            <span className="inline-flex max-w-[calc(100%-8px)] items-center gap-1 truncate rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
              <span className="truncate">{selected[0]}</span>
              <X
                size={11}
                className="shrink-0 cursor-pointer hover:text-emerald-950"
                onClick={(e) => removeOption(selected[0], e)}
                aria-label={`Remove ${selected[0]}`}
              />
            </span>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <span className="inline-flex max-w-[110px] items-center gap-1 truncate rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                <span className="truncate">{selected[0]}</span>
                <X
                  size={11}
                  className="shrink-0 cursor-pointer hover:text-emerald-950"
                  onClick={(e) => removeOption(selected[0], e)}
                  aria-label={`Remove ${selected[0]}`}
                />
              </span>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                +{selected.length - 1}
              </span>
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-full w-max max-w-xs rounded-md border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-2 py-1.5">
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-2 text-slate-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="h-6 w-full rounded bg-slate-50 pl-6 pr-2 text-[11px] outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <ul role="listbox" aria-multiselectable="true" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-slate-400">No results</li>
            ) : (
              filtered.map((option) => {
                const isSelected = selected.includes(option);
                return (
                  <li
                    key={option}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleOption(option)}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[12.5px] transition-colors ${isSelected
                        ? "bg-emerald-50 font-medium text-emerald-800"
                        : "text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded border transition-colors ${isSelected ? "border-emerald-600 bg-emerald-600" : "border-slate-300"
                        }`}
                    >
                      {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{option}</span>
                  </li>
                );
              })
            )}
          </ul>

          {options.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange([...options])}
                className="text-[11px] font-medium text-emerald-700 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] font-medium text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Statutory Report Component ─────────────────────── */

export default function StatutoryReport() {
  const [activeTab, setActiveTab] = useState<"maternity" | "paternity">("maternity");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewRows, setPreviewRows] = useState<ReportRow[] | null>(null);

  // Filter states
  const [streamFilter, setStreamFilter] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedEmployeeNames, setSelectedEmployeeNames] = useState<string[]>([]);
  const [employeeSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const currentDateStr = new Date().toISOString().split("T")[0];
  const reportTitle = activeTab === "maternity" ? "Maternity Leave Report" : "Paternity Leave Report";

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function loadData() {
      try {
        const response = await fetch("/api/statutory-report", { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load data: ${response.statusText}`);
        }
        const data: StatutoryReportData = await response.json();
        if (!isMounted) return;
        setEmployees(data.employees || []);
      } catch (err: unknown) {
        if (!isMounted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load statutory report data.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Gender filtering: Maternity = Female, Paternity = Male
  const genderFilteredEmployees = employees.filter((emp) => {
    const empGender = (emp.gender || "").toLowerCase();
    if (activeTab === "maternity") {
      return empGender === "female" || empGender === "f";
    }
    if (activeTab === "paternity") {
      return empGender === "male" || empGender === "m";
    }
    return true;
  });

  // Options available for filters based on gender scope
  const streamScopedEmployees = streamFilter
    ? employees.filter((employee) => employee.stream === streamFilter)
    : [];

  const allStreams = [...new Set(employees.map((employee) => employee.stream))]
    .filter(Boolean)
    .sort();

  const allDepartments = [...new Set(streamScopedEmployees.map((employee) => employee.department))]
    .filter(Boolean)
    .sort();

  const departmentScopedEmployees = genderFilteredEmployees.filter(
    (employee) =>
      employee.stream === streamFilter && selectedDepartments.includes(employee.department)
  );

  const allEmployeeNames = [
    ...new Set(departmentScopedEmployees.map((e) => e.name)),
  ].filter(Boolean).sort();

  // Active UI filtered employees (reactive filtering like in leave-refresh)
  const visibleEmployees = genderFilteredEmployees.filter((emp) => {
    if (streamFilter && emp.stream !== streamFilter) return false;
    if (selectedDepartments.length > 0 && !selectedDepartments.includes(emp.department)) return false;
    if (selectedEmployeeNames.length > 0 && !selectedEmployeeNames.includes(emp.name))
      return false;
    if (employeeSearch && !emp.name.toLowerCase().includes(employeeSearch.toLowerCase()))
      return false;
    return true;
  });

  // Generate button validation:
  // Enabled ONLY when all required options are selected:
  // 1. Valid Start Date
  // 2. Valid End Date
  // 3. One stream and at least one department selected
  // 4. Matching visible employees exist
  const hasValidDates = Boolean(startDate && endDate && startDate <= endDate);
  const hasStreamSelected = Boolean(streamFilter);
  const hasDepartmentSelected = selectedDepartments.length > 0;
  const hasRequiredOptions =
    hasValidDates &&
    hasStreamSelected &&
    hasDepartmentSelected &&
    visibleEmployees.length > 0;

  const canGenerate = !isLoading && hasRequiredOptions;

  // Clear selections when switching tab to avoid invalid states
  const handleTabChange = (tab: "maternity" | "paternity") => {
    setActiveTab(tab);
    setStreamFilter("");
    setSelectedDepartments([]);
    setSelectedEmployeeNames([]);
    setPreviewRows(null);
  };

  const handleGenerate = () => {
    if (!canGenerate) return;
    setPreviewRows(
      visibleEmployees.map((employee) => ({
        employeeId: employee.employeeId,
        name: employee.name,
        stream: employee.stream,
        department: employee.department,
        dateFrom: formatDisplayDate(startDate),
        dateTo: formatDisplayDate(endDate),
        remarks: "—",
      }))
    );
  };

  const reportBaseName = `${activeTab}-leave-report-${startDate || currentDateStr}-${endDate || currentDateStr}`;

  const handleDownloadPdf = async () => {
    if (!previewRows) return;
    const blob = await createReportPdf(previewRows, startDate || currentDateStr, reportTitle);
    downloadBlob(blob, `${reportBaseName}.pdf`);
  };

  const handleDownloadCsv = () => {
    if (!previewRows) return;
    downloadBlob(createCsvBlob(previewRows, startDate || currentDateStr, reportTitle), `${reportBaseName}.csv`);
  };

  const handleDownloadExcel = async () => {
    if (!previewRows) return;
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportTitle);
    worksheet.columns = [
      { header: "EMPLOYEE ID", key: "employeeId", width: 18 },
      { header: "EMPLOYEE NAME", key: "name", width: 26 },
      { header: "STREAM", key: "stream", width: 16 },
      { header: "DEPARTMENT", key: "department", width: 28 },
      { header: "DATE FROM", key: "dateFrom", width: 16 },
      { header: "DATE TO", key: "dateTo", width: 16 },
      { header: "REMARKS", key: "remarks", width: 18 },
    ];
    worksheet.addRow(["Date:", formatDisplayDate(startDate || currentDateStr)]);
    worksheet.addRow([reportTitle.toUpperCase()]);
    worksheet.addRow(reportColumns.map((column) => column.label));
    previewRows.forEach((row) => worksheet.addRow(row));
    worksheet.mergeCells("B1:G1");
    worksheet.mergeCells("A2:G2");
    worksheet.getRow(1).font = { color: { argb: "FF475569" }, size: 10 };
    worksheet.getRow(2).font = { bold: true, color: { argb: "FF1F2937" }, size: 16 };
    worksheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(3).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    worksheet.views = [{ state: "frozen", ySplit: 3 }];
    worksheet.autoFilter = { from: "A3", to: "G3" };
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${reportBaseName}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Page Title & Breadcrumbs */}
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
            <span>Leave Admin</span>
            <span>/</span>
            <span>Leave Report</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Statutory Report</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-800">
            Statutory Leave Report
          </h1>
        </div>
      </header>

      {/* Two Options Tabs: Maternity Leave & Paternity Leave */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-6 py-3.5 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Statutory Leave Type:
          </span>
          <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              id="tab-maternity-leave"
              onClick={() => handleTabChange("maternity")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${activeTab === "maternity"
                  ? "bg-white text-emerald-800 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <span className="size-2 rounded-full bg-pink-500" />
              <span>Maternity Leave</span>
            </button>

            <button
              type="button"
              id="tab-paternity-leave"
              onClick={() => handleTabChange("paternity")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${activeTab === "paternity"
                  ? "bg-white text-emerald-800 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <span className="size-2 rounded-full bg-blue-500" />
              <span>Paternity Leave</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong className="text-slate-700">{genderFilteredEmployees.length}</strong> eligible{" "}
          {activeTab === "maternity" ? "female" : "male"} employees
        </div>
      </div>

      {/* Filter Bar */}
      <section
        aria-label="Statutory Report Filters"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
          {/* Stream Dropdown */}
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-1 xl:col-span-2">
            <label htmlFor="filter-stream" className="text-[11px] font-semibold uppercase text-slate-500">
              Stream <span className="text-emerald-600">*</span>
            </label>
            <div className="relative">
              <select
                id="filter-stream"
                aria-label="Filter by stream"
                value={streamFilter}
                onChange={(e) => {
                  setStreamFilter(e.target.value);
                  setSelectedDepartments([]);
                  setSelectedEmployeeNames([]);
                  setPreviewRows(null);
                }}
                className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
              >
                <option value="">Select Streams</option>
                {allStreams.map((stream) => (
                  <option key={stream} value={stream}>{stream}</option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* All Departments Multi-Select */}
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-1 xl:col-span-2">
            <label htmlFor="filter-departments" className="text-[11px] font-semibold uppercase text-slate-500">
              Departments <span className="text-emerald-600">*</span>
            </label>
            <MultiSelect
              id="filter-departments"
              placeholder="Select Departments"
              options={allDepartments}
              selected={selectedDepartments}
              onChange={(departments) => {
                setSelectedDepartments(departments);
                setSelectedEmployeeNames([]);
                setPreviewRows(null);
              }}
              disabled={!streamFilter}
            />
          </div>

          {/* All Employee Names Multi-Select */}
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-1 xl:col-span-2">
            <label htmlFor="filter-employee-names" className="text-[11px] font-semibold uppercase text-slate-500">
              Employee Names
            </label>
            <MultiSelect
              id="filter-employee-names"
              placeholder="All Employee Names"
              options={allEmployeeNames}
              selected={selectedEmployeeNames}
              onChange={(names) => {
                setSelectedEmployeeNames(names);
                setPreviewRows(null);
              }}
              disabled={selectedDepartments.length === 0}
            />
          </div>

          {/* Unified Date Range: Start Date & End Date */}
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2 xl:col-span-4">
            <span className="text-[11px] font-semibold uppercase text-slate-500">
              Date Range <span className="text-emerald-600">*</span>
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <DateInput
                id="filter-start-date"
                value={startDate}
                onChange={(val) => {
                  setStartDate(val);
                  setPreviewRows(null);
                }}
                aria-label="Start date"
                placeholder="dd / mm / yyyy"
              />
              <ArrowRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
              <DateInput
                id="filter-end-date"
                value={endDate}
                min={startDate || undefined}
                onChange={(val) => {
                  setEndDate(val);
                  setPreviewRows(null);
                }}
                aria-label="End date"
                placeholder="dd / mm / yyyy"
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            id="statutory-generate-btn"
            onClick={handleGenerate}
            disabled={!canGenerate}
            title={
              canGenerate
                ? `Preview Statutory Report for ${visibleEmployees.length} employees from ${startDate} to ${endDate}`
                : "Select a stream, department, start date, and end date to enable Generate"
            }
            className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:col-span-1 xl:col-span-2 ${
              !canGenerate
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : "bg-slate-800 text-white shadow-sm hover:bg-slate-700"
            }`}
          >
            {isLoading ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <FileCheck size={15} aria-hidden="true" />
            )}
            <span>{isLoading ? "Generating…" : "Generate"}</span>
          </button>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Table Section */}
      <main className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {startDate && endDate && (
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-xs text-slate-600">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Date filter active:</span>
            <strong className="text-slate-800">{startDate}</strong>
            <ArrowRight size={13} className="text-slate-400" aria-hidden="true" />
            <strong className="text-slate-800">{endDate}</strong>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {reportColumns.map((column) => (
                  <th
                    key={column.key}
                    className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200 text-left"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={reportColumns.length} className="px-5 py-12 text-center text-slate-400 align-middle">
                    Loading statutory leave eligibility data…
                  </td>
                </tr>
              )}
              {!isLoading &&
                visibleEmployees.map((emp) => (
                  <tr
                    key={emp.employeeId}
                    className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700 font-medium align-middle">
                      {emp.employeeId}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900 align-middle">
                      {emp.name}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700 align-middle">
                      {emp.stream}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700 align-middle">
                      {emp.department}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600 align-middle">
                      {startDate || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600 align-middle">
                      {endDate || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500 align-middle">
                      —
                    </td>
                  </tr>
                ))}
              {!isLoading && visibleEmployees.length === 0 && (
                <tr>
                  <td colSpan={reportColumns.length} className="px-5 py-12 text-center text-slate-500 align-middle">
                    {genderFilteredEmployees.length === 0
                      ? `No ${activeTab === "maternity" ? "female" : "male"} employees found in the database.`
                      : "No employees match the selected filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <strong className="text-slate-700">{visibleEmployees.length}</strong>
            <span>employee{visibleEmployees.length !== 1 ? "s" : ""}</span>
            {startDate && endDate && (
              <>
                <span className="text-slate-300">•</span>
                <span>Period:</span>
                <strong className="text-slate-700">{startDate}</strong>
                <ArrowRight size={12} className="inline text-slate-400" />
                <strong className="text-slate-700">{endDate}</strong>
              </>
            )}
          </div>
        </footer>
      </main>

      {/* File Preview Section */}
      {previewRows && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 bg-[#f5f7fa] px-5 py-4 text-slate-800">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-md bg-emerald-100 text-emerald-700">
                <Eye size={16} aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wide">File Preview</h2>
            </div>
            <button
              type="button"
              onClick={() => setPreviewRows(null)}
              aria-label="Close report preview"
              className="grid size-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
            >
              <X size={16} />
            </button>
          </header>
          <div className="bg-[#f5f7fa] p-4 sm:p-6">
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 sm:text-xl">
                    {reportTitle.toUpperCase()}
                  </h3>
                  <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    Date: {startDate || currentDateStr}
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {previewRows.length} record{previewRows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      {reportColumns.map((column) => (
                        <th
                          key={column.key}
                          className="whitespace-nowrap px-4 py-2.5 font-semibold text-left border-b border-slate-200"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {previewRows.map((row, idx) => (
                      <tr
                        key={row.employeeId}
                        className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"}
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium align-middle text-left">
                          {row.employeeId}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-slate-900 align-middle text-left">
                          {row.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700 align-middle text-left">
                          {row.stream}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-700 align-middle text-left">
                          {row.department}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 align-middle text-left">
                          {row.dateFrom}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600 align-middle text-left">
                          {row.dateTo}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-500 align-middle text-left">
                          {row.remarks}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Ready to download in your preferred format:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 active:scale-[0.98]"
                  >
                    <FileText size={14} aria-hidden="true" />
                    <span>Download PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExcel}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 active:scale-[0.98]"
                  >
                    <FileSpreadsheet size={14} aria-hidden="true" />
                    <span>Download Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 active:scale-[0.98]"
                  >
                    <Download size={14} aria-hidden="true" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </footer>
            </article>
          </div>
        </section>
      )}
    </div>
  );
}

