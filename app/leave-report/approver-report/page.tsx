"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Info,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import LeaveSidebar from "../../components/LeaveSidebar";

/* ─── Types ──────────────────────────────────────────────────── */

type EmployeeApproverRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  stream: string;
  department: string;
  streamAndDepartment: string;
  firstLevelApprover: string;
  secondLevelApprover?: string;
  finalLevelApprover?: string;
};

type ReportApiResponse = {
  records: EmployeeApproverRecord[];
  filters: {
    allStreams: string[];
    allDepartments: string[];
    allEmployeeNames: string[];
    allFirstLevelApprovers?: string[];
    allSecondLevelApprovers?: string[];
  };
  error?: string;
};

interface ExcelStyledCell {
  font?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  alignment?: Record<string, unknown>;
  border?: Record<string, unknown>;
}

/* ─── Helpers ────────────────────────────────────────────────── */

function buildExportRows(records: EmployeeApproverRecord[]) {
  const headers = [
    "EMPLOYEE ID",
    "EMPLOYEE NAME",
    "STREAM & DEPARTMENT",
    "FIRST LEVEL APPROVER",
    "SECOND LEVEL APPROVER",
  ];

  const rows = records.map((rec) => [
    rec.employeeId,
    rec.employeeName,
    rec.streamAndDepartment,
    rec.firstLevelApprover || "—",
    rec.secondLevelApprover || rec.finalLevelApprover || "Principal",
  ]);

  return { headers, rows };
}

/* ─── MultiSelect Checkbox Dropdown ──────────────────────────── */

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
    return options.filter((opt) =>
      opt.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );
  }, [options, searchTerm]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-10 w-full items-center justify-between rounded-md border px-3 text-left text-sm outline-none transition-colors ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 select-none opacity-60"
            : isOpen
            ? "border-blue-400 bg-white text-slate-800"
            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
        }`}
      >
        <span className="truncate">
          {selectedValues.length === 0
            ? `All ${label}`
            : selectedValues.length === 1
            ? selectedValues[0]
            : `${selectedValues.length} ${label} selected`}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[220px] rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <div className="flex items-center gap-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-500 border border-slate-200">
              <Search size={13} className="shrink-0 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                  <span className="truncate">{option}</span>
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
              className="font-medium text-emerald-700 hover:text-emerald-800"
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

// Need useRef in custom component
import { useRef } from "react";

/* ─── Approver Report Page ───────────────────────────────────── */

export default function ApproverReportPage() {
  const [allRecords, setAllRecords] = useState<EmployeeApproverRecord[]>([]);
  const [allStreams, setAllStreams] = useState<string[]>([]);
  const [allDepartments, setAllDepartments] = useState<string[]>([]);

  // Generated report state
  const [reportRecords, setReportRecords] = useState<EmployeeApproverRecord[]>([]);
  const [hasGenerated, setHasGenerated] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showInfoModal) setShowInfoModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfoModal]);

  // Ordered filter states: 1. Stream, 2. Department, 3. Employee Names
  const [streamFilters, setStreamFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [employeeFilters, setEmployeeFilters] = useState<string[]>([]);

  // Initial load from API
  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const res = await fetch("/api/approver-report", { cache: "no-store" });
        const result = (await res.json()) as ReportApiResponse;
        if (mounted && res.ok) {
          setAllRecords(result.records ?? []);
          setAllStreams(result.filters?.allStreams ?? []);
          setAllDepartments(result.filters?.allDepartments ?? []);
        }
      } catch (err) {
        console.error("Failed to load approver report options:", err);
      }
    }
    void loadOptions();
    return () => {
      mounted = false;
    };
  }, []);

  // Cascading available departments based on selected streams
  const availableDepartments = useMemo(() => {
    if (streamFilters.length === 0) return allDepartments;
    const deptsInStreams = new Set(
      allRecords
        .filter((r) => streamFilters.includes(r.stream))
        .map((r) => r.department)
    );
    return allDepartments.filter((d) => deptsInStreams.has(d));
  }, [allDepartments, allRecords, streamFilters]);

  // Cascading available employees based on selected stream & department
  const availableEmployees = useMemo(() => {
    let list = allRecords;
    if (streamFilters.length > 0) {
      list = list.filter((r) => streamFilters.includes(r.stream));
    }
    if (departmentFilters.length > 0) {
      list = list.filter((r) => departmentFilters.includes(r.department));
    }
    return Array.from(new Set(list.map((r) => r.employeeName))).sort();
  }, [allRecords, streamFilters, departmentFilters]);

  // Handle Stream selection change
  const handleStreamChange = (values: string[]) => {
    setStreamFilters(values);
    if (values.length > 0) {
      const validDepts = new Set(
        allRecords.filter((r) => values.includes(r.stream)).map((r) => r.department)
      );
      setDepartmentFilters((prev) => prev.filter((d) => validDepts.has(d)));
    }
  };

  // Handle Department selection change
  const handleDepartmentChange = (values: string[]) => {
    setDepartmentFilters(values);
  };

  // Generate Button Handler
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/approver-report", { cache: "no-store" });
      const result = (await res.json()) as ReportApiResponse;

      if (!res.ok) {
        throw new Error(result.error || "Unable to generate approver report.");
      }

      setReportRecords(result.records ?? []);
      setHasGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate approver report.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Filtered applications based on active criteria
  const visibleRecords = useMemo(() => {
    const source = hasGenerated ? reportRecords : allRecords;
    return source.filter((rec) => {
      if (streamFilters.length > 0 && !streamFilters.includes(rec.stream)) {
        return false;
      }
      if (departmentFilters.length > 0 && !departmentFilters.includes(rec.department)) {
        return false;
      }
      if (employeeFilters.length > 0 && !employeeFilters.includes(rec.employeeName)) {
        return false;
      }
      return true;
    });
  }, [
    hasGenerated,
    reportRecords,
    allRecords,
    streamFilters,
    departmentFilters,
    employeeFilters,
  ]);

  // ── Export to Excel
  const handleExcel = async () => {
    const { headers, rows } = buildExportRows(visibleRecords);
    const currentDate = new Date().toISOString().split("T")[0];

    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Leave Management System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Approver Report", {
      views: [{ showGridLines: true }],
    });

    worksheet.mergeCells("A1:E1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Approver Report";
    titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 36;

    worksheet.mergeCells("A2:E2");
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

    worksheet.getRow(3).height = 10;

    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 28;

    headerRow.eachCell((cell: ExcelStyledCell) => {
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
        horizontal: "center",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } },
      };
    });

    rows.forEach((row, rowIndex: number) => {
      const dataRow = worksheet.addRow(row);
      dataRow.height = 22;
      const isEven = rowIndex % 2 === 0;

      dataRow.eachCell((cell: ExcelStyledCell) => {
        cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: "left" };
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

    worksheet.columns = [
      { key: "empId", width: 16 },
      { key: "name", width: 22 },
      { key: "streamAndDept", width: 28 },
      { key: "firstLevel", width: 24 },
      { key: "secondLevel", width: 24 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Approver Report.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Export to PDF
  const handlePdf = async () => {
    const { headers, rows } = buildExportRows(visibleRecords);
    const currentDate = new Date().toISOString().split("T")[0];
    const { jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text("Approver Report", 40, 42);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Date: ${currentDate}`, 40, 58);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 75,
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: 40, right: 40 },
    });

    doc.save("Approver Report.pdf");
  };

  // ── Export to CSV
  const handleCsv = () => {
    const { headers, rows } = buildExportRows(visibleRecords);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((val) => {
              const str = String(val ?? "").replace(/"/g, '""');
              return str.includes(",") || str.includes('"') || str.includes("\n")
                ? `"${str}"`
                : str;
            })
            .join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const a = document.createElement("a");
    a.href = encodedUri;
    a.download = "Approver Report.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="approver-report" />

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
                <span className="font-semibold text-slate-800">Approver Report</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                  Approver Report
                </h1>
                <button
                  type="button"
                  onClick={() => setShowInfoModal(true)}
                  title="About Approver Report"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:bg-sky-100 hover:text-sky-800"
                  aria-label="About Approver Report"
                >
                  <Info size={15} />
                </button>
              </div>
            </div>
          </header>

          {/* ── Filter Bar: Stream First, Next Department, Then Employees Name */}
          <section
            aria-label="Report filters"
            className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
              {/* Step 1: Stream Dropdown (Comes first) */}
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-3">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Stream
                </span>
                <MultiSelectDropdown
                  label="Streams"
                  options={allStreams}
                  selectedValues={streamFilters}
                  onChange={handleStreamChange}
                />
              </div>

              {/* Step 2: Department Dropdown (Comes next) */}
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-3">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Department
                </span>
                <MultiSelectDropdown
                  label="Departments"
                  options={availableDepartments}
                  selectedValues={departmentFilters}
                  onChange={handleDepartmentChange}
                />
              </div>

              {/* Step 3: Employee Names Dropdown (Then only employees name) */}
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-4">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Employee Names
                </span>
                <MultiSelectDropdown
                  label="Employees"
                  options={availableEmployees}
                  selectedValues={employeeFilters}
                  onChange={setEmployeeFilters}
                />
              </div>

              {/* Generate Button */}
              <div className="flex min-w-0 flex-col xl:col-span-2">
                <button
                  id="btn-generate-approver-report"
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating}
                  className={`inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors ${
                    isGenerating
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
            </div>
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

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">
                        EMPLOYEE ID
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">
                        EMPLOYEE NAME
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">
                        STREAM & DEPARTMENT
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">
                        FIRST LEVEL APPROVER
                      </th>
                      <th className="whitespace-nowrap px-5 py-3.5 font-semibold border-b border-slate-200">
                        SECOND LEVEL APPROVER
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {isGenerating && (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                          Generating report data…
                        </td>
                      </tr>
                    )}

                    {!isGenerating && visibleRecords.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                          No employee approver records found for the selected criteria.
                        </td>
                      </tr>
                    )}

                    {!isGenerating &&
                      visibleRecords.map((rec) => (
                        <tr
                          key={rec.id}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50/80"
                        >
                          <td className="whitespace-nowrap px-5 py-4 font-mono font-medium text-slate-900">
                            {rec.employeeId}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                            {rec.employeeName}
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {rec.streamAndDepartment}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              {rec.firstLevelApprover}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                              <span className="size-1.5 rounded-full bg-blue-500" />
                              {rec.secondLevelApprover || rec.finalLevelApprover || "Principal"}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* ── Table Footer with the 3 Download Options Directly (No preview section) */}
              {!isGenerating && !error && visibleRecords.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {visibleRecords.length} record{visibleRecords.length !== 1 ? "s" : ""} found
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      id="btn-download-approver-report-pdf"
                      type="button"
                      onClick={handlePdf}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
                    >
                      <FileText size={14} />
                      <span>Download PDF</span>
                    </button>

                    <button
                      id="btn-download-approver-report-excel"
                      type="button"
                      onClick={handleExcel}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
                    >
                      <FileSpreadsheet size={14} />
                      <span>Download Excel</span>
                    </button>

                    <button
                      id="btn-download-approver-report-csv"
                      type="button"
                      onClick={handleCsv}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
                    >
                      <Download size={14} />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>
              )}
            </main>
          )}

        </div>
      </div>

      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">About Approver Report</h3>
                  <p className="text-xs text-slate-500">Hierarchical approval routing & designated approver matrix</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900">What is Approver Report?</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-sky-950">
                  A governance and audit report mapping all employees and departments to their assigned Level 1, Level 2, Level 3 approvers, and designated Backup Officers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                    How it works
                  </h5>
                  <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                    <li>Audits approval chains across streams and departments.</li>
                    <li>Identifies missing approvers or inactive backup authorities.</li>
                    <li>Ensures leave requests route cleanly through hierarchy.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    How to use it
                  </h5>
                  <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
                    <li>Filter by Stream, Department, and Employee Names.</li>
                    <li>Click <strong>Generate Report</strong> to load assigned approver lines.</li>
                    <li>Review Level 1 and Level 2 designated authorities.</li>
                    <li>Export to <strong>Excel, CSV, or PDF</strong> for compliance audits.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 transition"
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
