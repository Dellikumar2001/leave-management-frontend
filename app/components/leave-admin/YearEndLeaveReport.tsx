"use client";

import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { Download, FileSpreadsheet, FileText, LoaderCircle, Printer } from "lucide-react";
import LeaveSidebar from "../LeaveSidebar";
import { MultiSelectDropdown } from "./LeaveAdministrationpage";
import {
  academicYearStartFor,
  formatAcademicYear,
  type YearEndLeaveValues,
} from "../../../lib/year-end-leave-report";

type ReportTab = "last" | "current";
type EmployeeOption = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
};
type Report = {
  employee: EmployeeOption;
  values: YearEndLeaveValues;
};
type ReportData = {
  reports: Report[];
  academicYear: string;
};

const currentAcademicYearStart = academicYearStartFor(new Date());
const previousAcademicYearStart = currentAcademicYearStart - 1;
const academicYearOptions = Array.from(
  { length: Math.max(previousAcademicYearStart - 1999, 1) },
  (_, index) => previousAcademicYearStart - index,
);

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
      : "Unable to load the year end leave report.";
    throw new Error(message);
  }
  return result as T;
}

function reportTitle(tab: ReportTab) {
  return `Year End Leave Report - ${tab === "last" ? "Last Year" : "Current Year"} Report`;
}

function reportFileName(tab: ReportTab, extension: string) {
  return `year-end-leave-report-${tab}-year.${extension}`;
}

function reportColumns() {
  return [
    { group: "CASUAL LEAVE", label: "UL", value: "casualUsed" as const },
    { group: "CASUAL LEAVE", label: "AL", value: "casualAvailable" as const },
    { group: "MEDICAL LEAVE", label: "UL", value: "medicalUsed" as const },
    { group: "MEDICAL LEAVE", label: "AL", value: "medicalAvailable" as const },
    { group: "MEDICAL LEAVE", label: "CF", value: "medicalCarryForward" as const },
    { group: "EARNED LEAVE", label: "UL", value: "earnedUsed" as const },
    { group: "EARNED LEAVE", label: "AL", value: "earnedAvailable" as const },
    { group: "RESTRICTED LEAVE", label: "UL", value: "restrictedUsed" as const },
    { group: "RESTRICTED LEAVE", label: "AL", value: "restrictedAvailable" as const },
  ];
}

function createCsvBlob(report: ReportData, tab: ReportTab) {
  const columns = reportColumns();
  const rows = [
    [reportTitle(tab).toUpperCase()],
    ["ACADEMIC YEAR", report.academicYear],
    [
      "S.No",
      "Employee name",
      "Employee id",
      "Department & Stream",
      ...columns.map(({ group, label }) => `${group} - ${label}`),
    ],
    ...report.reports.map(({ employee, values }, index) => [
      index + 1,
      employee.name,
      employee.employeeId,
      [employee.department, employee.stream].filter(Boolean).join(" & "),
      ...columns.map(({ value }) => values[value]),
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  return new Blob([csv], { type: "text/csv;charset=utf-8;" });
}

async function createPdfBlob(report: ReportData, tab: ReportTab) {
  const pdf = new jsPDF({ orientation: "landscape", format: "a4" });
  const margin = 14;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const columns = reportColumns();
  const title = reportTitle(tab).toUpperCase();

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(31, 41, 55);
  pdf.text(title, margin, 20);
  pdf.setFontSize(10);
  pdf.text(`ACADEMIC YEAR: ${report.academicYear}`, margin, 28);

  const { default: autoTable } = await import("jspdf-autotable");
  const leaveHeaders = columns.map(({ group, label }) => `${group} - ${label}`);
  autoTable(pdf, {
    startY: 34,
    margin: { left: margin, right: margin },
    head: [[
      "S.No",
      "Employee name",
      "Employee id",
      "Department & Stream",
      ...leaveHeaders,
    ]],
    body: report.reports.map(({ employee, values }, index) => [
      String(index + 1),
      employee.name,
      employee.employeeId,
      [employee.department, employee.stream].filter(Boolean).join(" & "),
      ...columns.map(({ value }) => String(values[value])),
    ]),
    styles: { fontSize: 6, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [31, 41, 55], fontSize: 6 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 31 },
      2: { cellWidth: 22 },
      3: { cellWidth: 34 },
    },
  });
  return pdf.output("blob");
}

export default function YearEndLeaveReport() {
  const [tab, setTab] = useState<ReportTab>("last");
  const [selectedYear, setSelectedYear] = useState(previousAcademicYearStart);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [streams, setStreams] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedEmployeeOptions, setSelectedEmployeeOptions] = useState<string[]>([]);
  const [loadedScopes, setLoadedScopes] = useState<Set<string>>(new Set());
  const [loadingScope, setLoadingScope] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  const employeeOptionByLabel = useMemo(
    () => new Map(employees.map((employee) => [`${employee.name} (${employee.employeeId})`, employee])),
    [employees],
  );
  const employeeOptions = useMemo(() => [...employeeOptionByLabel.keys()].sort(), [employeeOptionByLabel]);
  const activeYearStart = tab === "last" ? selectedYear : currentAcademicYearStart;
  const isLoadingOptions = loadingScope !== null;

  const loadFilterOptions = async (scope: "streams" | "departments" | "employees") => {
    if (loadedScopes.has(scope) || loadingScope !== null) return;
    if (scope === "departments" && selectedStreams.length === 0) return;
    if (scope === "employees" && (selectedStreams.length === 0 || selectedDepartments.length === 0)) return;

    setLoadingScope(scope);
    setError("");
    try {
      const params = new URLSearchParams({ scope });
      selectedStreams.forEach((stream) => params.append("stream", stream));
      selectedDepartments.forEach((department) => params.append("department", department));
      const data = await readJson<{ streams?: string[]; departments?: string[]; employees?: EmployeeOption[] }>(
        await fetch(`/api/leave-credit/report?${params.toString()}`, { cache: "no-store" }),
      );
      if (scope === "streams") setStreams(data.streams ?? []);
      if (scope === "departments") setDepartments(data.departments ?? []);
      if (scope === "employees") setEmployees(data.employees ?? []);
      setLoadedScopes((current) => new Set(current).add(scope));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load employee filters.");
    } finally {
      setLoadingScope(null);
    }
  };

  const changeStreams = (values: string[]) => {
    setSelectedStreams(values);
    setSelectedDepartments([]);
    setSelectedEmployeeOptions([]);
    setDepartments([]);
    setEmployees([]);
    setLoadedScopes((loaded) => new Set([...loaded].filter((scope) => scope === "streams")));
    setReport(null);
  };

  const changeDepartments = (values: string[]) => {
    setSelectedDepartments(values);
    setSelectedEmployeeOptions([]);
    setEmployees([]);
    setLoadedScopes((loaded) => new Set([...loaded].filter((scope) => scope !== "employees")));
    setReport(null);
  };

  const generateReport = async () => {
    if (selectedEmployeeOptions.length === 0) {
      setError("Select at least one employee before generating the report.");
      return;
    }
    setIsGenerating(true);
    setError("");
    setReport(null);
    try {
      const params = new URLSearchParams({ year: String(activeYearStart) });
      selectedEmployeeOptions.forEach((label) => {
        const employee = employeeOptionByLabel.get(label);
        if (employee) params.append("employeeId", employee.employeeId);
      });
      const data = await readJson<{ reports: Report[] }>(
        await fetch(`/api/year-end-leave-report?${params.toString()}`, { cache: "no-store" }),
      );
      setReport({
        reports: data.reports,
        academicYear: formatAcademicYear(activeYearStart),
      });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate the year end leave report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    if (report) {
      void createPdfBlob(report, tab)
        .then((blob) => downloadBlob(blob, reportFileName(tab, "pdf")))
        .catch((exportError: unknown) => {
          setError(exportError instanceof Error ? `Unable to export PDF file: ${exportError.message}` : "Unable to export PDF file.");
        });
    }
  };

  const handleDownloadCsv = () => {
    if (report) downloadBlob(createCsvBlob(report, tab), reportFileName(tab, "csv"));
  };

  const handleDownloadExcel = async () => {
    if (!report) return;
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(reportTitle(tab));
      const columns = reportColumns();
      worksheet.columns = [
        { width: 8 },
        { width: 30 },
        { width: 18 },
        { width: 32 },
        ...columns.map(() => ({ width: 18 })),
      ];
      worksheet.addRow([reportTitle(tab).toUpperCase()]);
      worksheet.mergeCells(1, 1, 1, columns.length + 4);
      worksheet.getRow(1).font = { bold: true, size: 16, color: { argb: "FF1F2937" } };
      worksheet.addRow(["ACADEMIC YEAR", report.academicYear]);
      worksheet.addRow(["", "", "", "", ...columns.map(({ group }) => group)]);
      worksheet.addRow([
        "S.No",
        "Employee name",
        "Employee id",
        "Department & Stream",
        ...columns.map(({ label }) => label),
      ]);
      report.reports.forEach(({ employee, values }, index) => {
        worksheet.addRow([
          index + 1,
          employee.name,
          employee.employeeId,
          [employee.department, employee.stream].filter(Boolean).join(" & "),
          ...columns.map(({ value }) => values[value]),
        ]);
      });
      [
        { start: 1, end: 1 },
        { start: 2, end: 2 },
        { start: 3, end: 3 },
        { start: 4, end: 4 },
        { start: 5, end: 6 },
        { start: 7, end: 9 },
        { start: 10, end: 11 },
        { start: 12, end: 13 },
      ].forEach(({ start, end }) => {
        if (end > start) worksheet.mergeCells(3, start, 3, end);
      });
      worksheet.getRow(3).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
      worksheet.getRow(3).alignment = { horizontal: "center" };
      worksheet.getRow(4).font = { bold: true };
      worksheet.getRow(4).alignment = { horizontal: "center" };
      worksheet.getRow(5).alignment = { horizontal: "center" };
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }), reportFileName(tab, "xlsx"));
    } catch (exportError) {
      setError(exportError instanceof Error ? `Unable to export Excel file: ${exportError.message}` : "Unable to export Excel file.");
    }
  };

  const columns = reportColumns();

  return (
    <div className="h-dvh overflow-hidden bg-[#e9edf3] text-slate-800 print:h-auto print:overflow-visible">
      <LeaveSidebar activePage="year-end-leave-report" />
      <main className="h-dvh overflow-hidden p-4 min-[801px]:ml-[175px] print:ml-0 print:h-auto print:overflow-visible print:p-0">
        <div className="mx-auto flex h-full max-w-[1400px] min-h-0 flex-col print:h-auto print:max-w-none print:overflow-visible">
          <header className="shrink-0 rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-4 shadow-sm print:hidden">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Leave Reports</p>
            <h1 className="text-2xl font-bold text-slate-800">Year End Leave Report</h1>
          </header>

          <nav aria-label="Year end report year" className="mt-3 flex shrink-0 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm print:hidden">
            {(["last", "current"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value);
                  setReport(null);
                  setError("");
                }}
                aria-current={tab === value ? "page" : undefined}
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
                  tab === value ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {value === "last" ? "Last Year Report" : "Current Year Report"}
              </button>
            ))}
          </nav>

          <section aria-label="Year end report filters" className="mt-3 shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(120px,1fr)_minmax(140px,1.1fr)_minmax(190px,1.4fr)_minmax(170px,1fr)_auto]">
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
                  label="Employees"
                  options={employeeOptions}
                  selectedValues={selectedEmployeeOptions}
                  onChange={(values) => {
                    setSelectedEmployeeOptions(values);
                    setReport(null);
                  }}
                  onOpen={() => void loadFilterOptions("employees")}
                  disabled={isLoadingOptions || selectedDepartments.length === 0}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="year-end-academic-year" className="mb-1.5 block text-xs font-medium text-slate-600">Academic Year</label>
                {tab === "last" ? (
                  <select
                    id="year-end-academic-year"
                    value={selectedYear}
                    onChange={(event) => {
                      setSelectedYear(Number(event.target.value));
                      setReport(null);
                    }}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
                  >
                    {academicYearOptions.map((year) => (
                      <option key={year} value={year}>{formatAcademicYear(year)}</option>
                    ))}
                  </select>
                ) : (
                  <div aria-label={`Academic year ${formatAcademicYear(currentAcademicYearStart)}`} className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-600">
                    {formatAcademicYear(currentAcademicYearStart)}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={isLoadingOptions || isGenerating || selectedEmployeeOptions.length === 0}
                onClick={() => void generateReport()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isGenerating && <LoaderCircle size={16} aria-hidden="true" className="animate-spin" />}
                {isGenerating ? "GENERATING..." : "GENERATE"}
              </button>
            </div>
            {isLoadingOptions && <p className="mt-3 text-xs text-slate-500">Loading {loadingScope}...</p>}
            {selectedEmployeeOptions.length === 0 && <p className="mt-3 text-xs text-slate-500">Select one or more employees to generate a report.</p>}
            {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
          </section>

          {report && (
            <section aria-label="Generated year end leave report" className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:mt-0 print:flex-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
              <div className="shrink-0 border-b border-slate-200 px-5 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <h2 className="text-center text-base font-bold text-slate-800">{reportTitle(tab)}</h2>
                  </div>
                  <div aria-label="Leave report abbreviations" className="shrink-0 text-left text-xs text-slate-600">
                    <p>UL - Used Leave</p>
                    <p>AL - Available Leave</p>
                    <p>CF - Carry Forward</p>
                  </div>
                </div>
                <p className="mt-3 text-center text-sm text-slate-700">
                  <span className="font-semibold">ACADEMIC YEAR:</span> {report.academicYear}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto print:flex-none print:overflow-visible">
                <table className="min-w-[1550px] w-full border-collapse text-center text-sm">
                  <thead className="sticky top-0 z-[1] bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th rowSpan={2} scope="col" className="border border-slate-300 px-3 py-3 text-center font-semibold">S.No</th>
                      <th rowSpan={2} scope="col" className="border border-slate-300 px-3 py-3 text-center font-semibold">Employee name</th>
                      <th rowSpan={2} scope="col" className="border border-slate-300 px-3 py-3 text-center font-semibold">Employee id</th>
                      <th rowSpan={2} scope="col" className="border border-slate-300 px-3 py-3 text-center font-semibold">Department &amp; Stream</th>
                      {[
                        { label: "CASUAL LEAVE", span: 2 },
                        { label: "MEDICAL LEAVE", span: 3 },
                        { label: "EARNED LEAVE", span: 2 },
                        { label: "RESTRICTED LEAVE", span: 2 },
                      ].map(({ label, span }) => (
                        <th key={label} scope="colgroup" colSpan={span} className="border border-slate-300 px-3 py-3 text-center font-semibold">{label}</th>
                      ))}
                    </tr>
                    <tr>
                      {columns.map(({ group, label, value }) => (
                        <th key={`${group}-${label}-${value}`} scope="col" className="border border-slate-300 px-3 py-3 text-center font-semibold">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.reports.map(({ employee, values }, index) => (
                      <tr key={employee.employeeId}>
                        <td className="border border-slate-300 px-3 py-4">{index + 1}</td>
                        <td className="border border-slate-300 px-3 py-4 text-left">{employee.name}</td>
                        <td className="border border-slate-300 px-3 py-4">{employee.employeeId}</td>
                        <td className="border border-slate-300 px-3 py-4 text-left">
                          {[employee.department, employee.stream].filter(Boolean).join(" & ")}
                        </td>
                        {columns.map(({ value }) => (
                          <td key={value} className="border border-slate-300 px-3 py-4 text-center font-medium text-emerald-800">{values[value]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 print:hidden">
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
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
