"use client";

import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Download, FileSpreadsheet, FileText, Info, LoaderCircle, Printer, X } from "lucide-react";
import LeaveSidebar from "../LeaveSidebar";
import { MultiSelectDropdown } from "./LeaveAdministrationpage";

type Category = "ANNUAL" | "MEDICAL";

type EmployeeOption = {
  employeeId: string;
  name: string;
  designation: string | null;
  stream: string;
  department: string;
  mobileNumber: string | null;
};

type CreditReportRow = EmployeeOption & {
  creditedDays: number;
};

const columns: { key: keyof CreditReportRow; label: string; width: number }[] = [
  { key: "employeeId", label: "EMPLOYEE ID", width: 28 },
  { key: "name", label: "EMPLOYEE NAME", width: 42 },
  { key: "designation", label: "DESIGNATION", width: 36 },
  { key: "stream", label: "STREAM", width: 25 },
  { key: "department", label: "DEPARTMENT", width: 40 },
  { key: "mobileNumber", label: "CONTACT", width: 32 },
  { key: "creditedDays", label: "LEAVE DAYS CREDITED", width: 38 },
];

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(text) as unknown;
  } catch {
    throw new Error(text.trim() || `The server returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Unable to load the credit leave report.";
    throw new Error(message);
  }
  return result as T;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportTitle(category: Category) {
  return `${category === "ANNUAL" ? "Annual" : "Medical"} Leave Credit Report`;
}

function reportFileName(category: Category, extension: string) {
  return `${category.toLowerCase()}-leave-credit-report.${extension}`;
}

function createCsvBlob(rows: CreditReportRow[], category: Category) {
  const csvRows = [
    [reportTitle(category).toUpperCase()],
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map(({ key }) => row[key] ?? "")),
  ];
  const csv = csvRows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

function createPdfBlob(rows: CreditReportRow[], category: Category) {
  const pdf = new jsPDF({ orientation: "landscape", format: "a4" });
  const margin = 12;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const tableWidth = pageWidth - margin * 2;
  const columnWidths = columns.map(({ width }) => tableWidth * width / columns.reduce((sum, column) => sum + column.width, 0));
  const headerHeight = 10;
  const rowHeight = 11;
  let y = 28;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(31, 41, 55);
  pdf.text(reportTitle(category).toUpperCase(), margin, 19);

  const drawHeader = () => {
    let x = margin;
    pdf.setFillColor(31, 41, 55);
    pdf.rect(margin, y, tableWidth, headerHeight, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    columns.forEach((column, index) => {
      pdf.text(column.label, x + 2, y + 6.5);
      x += columnWidths[index];
    });
    y += headerHeight;
  };

  drawHeader();
  rows.forEach((row, rowIndex) => {
    if (y + rowHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
      drawHeader();
    }
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(244, 246, 250);
      pdf.rect(margin, y, tableWidth, rowHeight, "F");
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(51, 65, 85);
    let x = margin;
    columns.forEach((column, index) => {
      const value = row[column.key] ?? "—";
      const lines = pdf.splitTextToSize(String(value), columnWidths[index] - 4).slice(0, 2);
      pdf.text(lines, x + 2, y + 4.5);
      x += columnWidths[index];
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    y += rowHeight;
  });
  return pdf.output("blob");
}

export default function CreditLeaveReport() {
  const [category, setCategory] = useState<Category>("ANNUAL");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [loadingScope, setLoadingScope] = useState<"streams" | "departments" | "employees" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streams, setStreams] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedEmployeeNames, setSelectedEmployeeNames] = useState<string[]>([]);
  const [reportRows, setReportRows] = useState<CreditReportRow[] | null>(null);
  const [error, setError] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showInfoModal) setShowInfoModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfoModal]);

  const availableEmployees = useMemo(() => (
      selectedStreams.length && selectedDepartments.length && employeesLoaded
        ? employees
      : []
  ), [employees, employeesLoaded, selectedDepartments.length, selectedStreams.length]);

  const employeeNames = useMemo(
    () => [...new Set(availableEmployees.map(({ name }) => name))].filter(Boolean).sort(),
    [availableEmployees],
  );

  const selectedEmployeeIds = useMemo(
    () => availableEmployees
      .filter(({ name }) => selectedEmployeeNames.includes(name))
      .map(({ employeeId }) => employeeId),
    [availableEmployees, selectedEmployeeNames],
  );

  const hasSelection = selectedEmployeeIds.length > 0 || selectedStreams.length > 0 || selectedDepartments.length > 0;
  const isLoadingOptions = loadingScope !== null;

  const loadFilterOptions = async (scope: "streams" | "departments" | "employees") => {
    if (scope === "streams" && filtersLoaded ||
        scope === "departments" && departmentsLoaded ||
        scope === "employees" && employeesLoaded ||
        loadingScope !== null) return;

    setLoadingScope(scope);
    setError("");
    try {
      const params = new URLSearchParams({ scope });
      selectedStreams.forEach((stream) => params.append("stream", stream));
      selectedDepartments.forEach((department) => params.append("department", department));
      const response = await fetch(`/api/leave-credit/report?${params.toString()}`, { cache: "no-store" });
      if (scope === "streams") {
        const data = await readJson<{ streams: string[] }>(response);
        setStreams(data.streams);
        setFiltersLoaded(true);
      } else if (scope === "departments") {
        const data = await readJson<{ departments: string[] }>(response);
        setDepartments(data.departments);
        setDepartmentsLoaded(true);
      } else {
        const data = await readJson<{ employees: EmployeeOption[] }>(response);
        setEmployees(data.employees);
        setEmployeesLoaded(true);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load employee filters.");
    } finally {
      setLoadingScope(null);
    }
  };

  const changeStreams = (values: string[]) => {
    setSelectedStreams(values);
    setSelectedDepartments([]);
    setSelectedEmployeeNames([]);
    setDepartments([]);
    setEmployees([]);
    setDepartmentsLoaded(false);
    setEmployeesLoaded(false);
    setReportRows(null);
  };

  const changeDepartments = (values: string[]) => {
    setSelectedDepartments(values);
    setSelectedEmployeeNames([]);
    setEmployees([]);
    setEmployeesLoaded(false);
    setReportRows(null);
  };

  const generateReport = async () => {
    if (!hasSelection) {
      setError("Select at least one employee, department, or stream before generating the report.");
      return;
    }
    setIsGenerating(true);
    setError("");
    setReportRows(null);
    try {
      const response = await fetch("/api/leave-credit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          category,
          employeeIds: selectedEmployeeIds,
          streams: selectedStreams,
          departments: selectedDepartments,
        }),
      });
      const data = await readJson<{ rows: CreditReportRow[] }>(response);
      setReportRows(data.rows);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate the credit leave report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const daysHeading = `NUMBER OF ${category} LEAVE DAYS CREDITED`;
  const handleDownloadPdf = () => {
    if (reportRows === null) return;
    downloadBlob(createPdfBlob(reportRows, category), reportFileName(category, "pdf"));
  };
  const handleDownloadCsv = () => {
    if (reportRows === null) return;
    downloadBlob(createCsvBlob(reportRows, category), reportFileName(category, "csv"));
  };
  const handleDownloadExcel = async () => {
    if (reportRows === null) return;
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(reportTitle(category));
      worksheet.columns = columns.map(({ key, label, width }) => ({
        header: label,
        key,
        width: Math.max(14, Math.ceil(width * 0.55)),
      }));
      worksheet.addRow([reportTitle(category).toUpperCase()]);
      worksheet.mergeCells(1, 1, 1, columns.length);
      worksheet.getRow(1).font = { bold: true, size: 16, color: { argb: "FF1F2937" } };
      worksheet.addRow(columns.map(({ label }) => label));
      reportRows.forEach((row) => worksheet.addRow({
        ...row,
        designation: row.designation ?? "",
        mobileNumber: row.mobileNumber ?? "",
      }));
      worksheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F2937" },
      };
      worksheet.views = [{ state: "frozen", ySplit: 2 }];
      worksheet.autoFilter = { from: "A2", to: `${String.fromCharCode(64 + columns.length)}2` };
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }), reportFileName(category, "xlsx"));
    } catch (exportError) {
      setError(exportError instanceof Error ? `Unable to export Excel file: ${exportError.message}` : "Unable to export Excel file.");
    }
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="credit-leave-report" />
      <main className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px]">
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Leave Reports</p>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-800">Credit Leave Report</h1>
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                title="About Credit Leave Report"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:bg-sky-100 hover:text-sky-800"
                aria-label="About Credit Leave Report"
              >
                <Info size={15} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">View annual or medical leave days credited to employees.</p>
          </header>

          <nav aria-label="Credit leave report category" className="mt-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {(["ANNUAL", "MEDICAL"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setCategory(value);
                  setReportRows(null);
                  setError("");
                }}
                aria-current={category === value ? "page" : undefined}
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
                  category === value ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {value === "ANNUAL" ? "Annual Leave Credit Report" : "Medical Leave Credit Report"}
              </button>
            ))}
          </nav>

          <section aria-label="Credit leave report filters" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(140px,1fr)_minmax(150px,1.1fr)_minmax(180px,1.3fr)_auto]">
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Stream</span>
                <MultiSelectDropdown
                  label="Streams"
                  options={streams}
                  selectedValues={selectedStreams}
                  onChange={changeStreams}
                  onOpen={() => void loadFilterOptions("streams")}
                  disabled={isLoadingOptions}
                />
              </div>
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Department</span>
                <MultiSelectDropdown
                  label="Departments"
                  options={departments}
                  selectedValues={selectedDepartments}
                  onChange={changeDepartments}
                  onOpen={() => void loadFilterOptions("departments")}
                  disabled={isLoadingOptions || selectedStreams.length === 0}
                />
              </div>
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Employee</span>
                <MultiSelectDropdown
                  label="Employee Names"
                  options={employeeNames}
                  selectedValues={selectedEmployeeNames}
                  onChange={(values) => {
                    setSelectedEmployeeNames(values);
                    setReportRows(null);
                  }}
                  onOpen={() => void loadFilterOptions("employees")}
                  disabled={isLoadingOptions || selectedDepartments.length === 0}
                />
              </div>
              <button
                type="button"
                disabled={isLoadingOptions || isGenerating || !hasSelection}
                onClick={() => void generateReport()}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {(isGenerating || isLoadingOptions) && <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />}
                {isGenerating ? "GENERATING..." : "GENERATE"}
              </button>
            </div>
            {isLoadingOptions && <p className="mt-3 text-xs text-slate-500">Loading {loadingScope}...</p>}
          </section>

          {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {reportRows !== null && (
            <section className="credit-leave-report-print-area mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 print:border-b-0">
                <h2 className="text-sm font-semibold text-slate-800">
                  {reportTitle(category)}
                </h2>
                <div className="credit-leave-report-print-actions flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-xs text-slate-500">{reportRows.length} employees</span>
                  <button type="button" onClick={handleDownloadPdf} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700">
                    <FileText size={14} aria-hidden="true" /> Download PDF
                  </button>
                  <button type="button" onClick={() => void handleDownloadExcel()} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700">
                    <FileSpreadsheet size={14} aria-hidden="true" /> Download Excel
                  </button>
                  <button type="button" onClick={handleDownloadCsv} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700">
                    <Download size={14} aria-hidden="true" /> Download CSV
                  </button>
                  <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700">
                    <Printer size={14} aria-hidden="true" /> Print
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">EMPLOYEE ID</th>
                      <th scope="col" className="px-4 py-3 font-semibold">EMPLOYEE NAME</th>
                      <th scope="col" className="px-4 py-3 font-semibold">DESIGNATION</th>
                      <th scope="col" className="px-4 py-3 font-semibold">STREAM</th>
                      <th scope="col" className="px-4 py-3 font-semibold">DEPARTMENT</th>
                      <th scope="col" className="px-4 py-3 font-semibold">CONTACT</th>
                      <th scope="col" className="px-4 py-3 font-semibold">{daysHeading}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row) => (
                      <tr key={row.employeeId} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium">{row.employeeId}</td>
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="px-4 py-3">{row.designation || "—"}</td>
                        <td className="px-4 py-3">{row.stream}</td>
                        <td className="px-4 py-3">{row.department}</td>
                        <td className="px-4 py-3">{row.mobileNumber || "—"}</td>
                        <td className="px-4 py-3 font-medium text-emerald-800">{row.creditedDays}</td>
                      </tr>
                    ))}
                    {reportRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-slate-500">No employees match those filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>

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
                  <h3 className="text-lg font-bold text-slate-800">About Credit Leave Report</h3>
                  <p className="text-xs text-slate-500">Summary of manual compensatory & credited days</p>
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900">What is Credit Leave Report?</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-sky-950">
                  An auditing report providing transparency into manual leave credits awarded to employees under Annual or Medical categories.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                    How it works
                  </h5>
                  <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                    <li>Aggregates credited leave days per employee for the selected category.</li>
                    <li>Correlates employee stream, department, designation, and contact details.</li>
                    <li>Formats live records ready for immediate export.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    How to use it
                  </h5>
                  <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
                    <li>Choose either <strong>Annual</strong> or <strong>Medical</strong> category.</li>
                    <li>Filter by Stream, Department, and Employee Names.</li>
                    <li>Click <strong>Generate Report</strong> to inspect records.</li>
                    <li>Export to PDF, Excel, or CSV as required.</li>
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
