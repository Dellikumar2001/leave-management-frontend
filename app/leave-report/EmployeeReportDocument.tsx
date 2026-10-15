"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { jsPDF } from "jspdf";

interface StyledCell {
  font?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  alignment?: Record<string, unknown>;
  border?: Record<string, unknown>;
}

export type EmployeeReportData = {
  employee: {
    employeeId: string;
    name: string;
    designation: string | null;
    department: string;
    stream: string;
    mobile: string | null;
    workEmail: string | null;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  leaveHistory: {
    id: number;
    startDate: string;
    endDate: string;
    appliedAt: string;
    duration: number;
    leaveType: string;
    reason: string;
  }[];
};

function formatDate(value: string) {
  const date = new Date(value.slice(0, 10) + "T00:00:00.000Z");
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function csvValue(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(report: EmployeeReportData) {
  const rows: unknown[][] = [
    ["OFFICIAL EMPLOYEE LEAVE REPORT"],
    ["Employee name", report.employee.name],
    ["Employee ID", report.employee.employeeId],
    ["Designation", report.employee.designation || "Not recorded"],
    ["Department", report.employee.department],
    ["Stream", report.employee.stream],
    ["Mobile", report.employee.mobile || "Not recorded"],
    ["Work email", report.employee.workEmail || "Not recorded"],
    ["Reporting period", `${formatDate(report.period.startDate)} to ${formatDate(report.period.endDate)}`],
    [],
    ["Leave start date", "Leave end date", "Duration (days)", "Leave type", "Applied on", "Reason"],
    ...report.leaveHistory.map((leave) => [
      formatDate(leave.startDate),
      formatDate(leave.endDate),
      leave.duration,
      leave.leaveType,
      formatDate(leave.appliedAt),
      leave.reason,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `leave-report-${report.employee.employeeId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadExcel(report: EmployeeReportData) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Leave Management System";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("Employee Leave Report", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", ySplit: 10 }],
  });

  worksheet.columns = [
    { key: "startDate", width: 20 },
    { key: "endDate", width: 20 },
    { key: "duration", width: 14 },
    { key: "leaveType", width: 22 },
    { key: "appliedOn", width: 20 },
    { key: "reason", width: 52 },
  ];
  worksheet.mergeCells("A1:F1");
  worksheet.getCell("A1").value = "OFFICIAL EMPLOYEE LEAVE REPORT";
  worksheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5C4A" } };
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  const employeeDetails = [
    ["Employee name", report.employee.name, "Employee ID", report.employee.employeeId],
    ["Designation", report.employee.designation || "Not recorded", "Reporting period", `${formatDate(report.period.startDate)} to ${formatDate(report.period.endDate)}`],
    ["Department", report.employee.department, "Stream", report.employee.stream],
    ["Mobile", report.employee.mobile || "Not recorded", "Work email", report.employee.workEmail || "Not recorded"],
  ];
  employeeDetails.forEach((details, index) => {
    const row = worksheet.getRow(index + 3);
    row.values = [details[0], details[1], details[2], details[3]];
    row.height = 22;
    [1, 3].forEach((column) => {
      row.getCell(column).font = { bold: true, color: { argb: "FF334155" } };
    });
    [2, 4].forEach((column) => {
      row.getCell(column).alignment = { wrapText: true, vertical: "middle" };
    });
  });

  const headers = ["Leave start date", "Leave end date", "Duration (days)", "Leave type", "Applied on", "Reason"];
  const headerRow = worksheet.getRow(10);
  headerRow.values = headers;
  headerRow.height = 26;
  headerRow.eachCell((cell: StyledCell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5C4A" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  report.leaveHistory.forEach((leave) => {
    const row = worksheet.addRow([
      formatDate(leave.startDate),
      formatDate(leave.endDate),
      leave.duration,
      leave.leaveType,
      formatDate(leave.appliedAt),
      leave.reason || "—",
    ]);
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell: StyledCell) => {
      cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
    });
  });
  if (report.leaveHistory.length === 0) {
    worksheet.mergeCells("A11:F11");
    worksheet.getCell("A11").value = "No leave was taken during this reporting period.";
    worksheet.getCell("A11").alignment = { horizontal: "center" };
  } else {
    worksheet.autoFilter = { from: "A10", to: "F10" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leave-report-${report.employee.employeeId}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(report: EmployeeReportData) {
  const pdf = new jsPDF({ orientation: "landscape", format: "a4" });
  const margin = 12;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const columns = [
    { label: "LEAVE START", width: 30 },
    { label: "LEAVE END", width: 30 },
    { label: "DAYS", width: 18 },
    { label: "LEAVE TYPE", width: 34 },
    { label: "APPLIED ON", width: 30 },
    { label: "REASON", width: pageWidth - margin * 2 - 142 },
  ];
  let y = 72;

  const drawTableHeader = () => {
    pdf.setFillColor(15, 92, 74);
    pdf.rect(margin, y, pageWidth - margin * 2, 9, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    let x = margin + 2;
    columns.forEach((column) => {
      pdf.text(column.label, x, y + 6);
      x += column.width;
    });
    y += 9;
  };

  const drawHeading = () => {
    pdf.setTextColor(15, 92, 74);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("EMPLOYEE LEAVE REPORT", margin, 17);
    pdf.setTextColor(71, 85, 105);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Reporting period: ${formatDate(report.period.startDate)} to ${formatDate(report.period.endDate)}`, margin, 24);
    pdf.setFont("helvetica", "bold");
    pdf.text(report.employee.name, margin, 34);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Employee ID: ${report.employee.employeeId}   Designation: ${report.employee.designation || "Not recorded"}`, margin, 40);
    pdf.text(`Department: ${report.employee.department}   Stream: ${report.employee.stream}`, margin, 46);
    pdf.text(`Mobile: ${report.employee.mobile || "Not recorded"}   Work email: ${report.employee.workEmail || "Not recorded"}`, margin, 52);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, 58, pageWidth - margin, 58);
    y = 64;
  };

  drawHeading();
  drawTableHeader();
  if (!report.leaveHistory.length) {
    pdf.setTextColor(71, 85, 105);
    pdf.setFont("helvetica", "normal");
    pdf.text("No leave was taken during this reporting period.", margin + 2, y + 8);
  }

  report.leaveHistory.forEach((leave, index) => {
    const values = [
      formatDate(leave.startDate),
      formatDate(leave.endDate),
      String(leave.duration),
      leave.leaveType,
      formatDate(leave.appliedAt),
      leave.reason || "—",
    ];
    const wrapped = values.map((value, columnIndex) =>
      pdf.splitTextToSize(value, columns[columnIndex].width - 4),
    );
    const rowHeight = Math.max(10, ...wrapped.map((lines) => lines.length * 4 + 4));
    if (y + rowHeight > pageHeight - margin) {
      pdf.addPage();
      drawHeading();
      drawTableHeader();
    }
    if (index % 2 === 0) {
      pdf.setFillColor(245, 247, 250);
      pdf.rect(margin, y, pageWidth - margin * 2, rowHeight, "F");
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(51, 65, 85);
    let x = margin + 2;
    wrapped.forEach((lines, columnIndex) => {
      pdf.text(lines, x, y + 5);
      x += columns[columnIndex].width;
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    y += rowHeight;
  });

  pdf.save(`leave-report-${report.employee.employeeId}.pdf`);
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-800">{value || "Not recorded"}</dd>
    </div>
  );
}

export default function EmployeeReportDocument({ report }: { report: EmployeeReportData }) {
  const [excelError, setExcelError] = useState("");

  async function handleExcelExport() {
    setExcelError("");
    try {
      await downloadExcel(report);
    } catch (error) {
      console.error("Failed to export the employee leave report to Excel:", error);
      setExcelError("Unable to export the report to Excel. Please try again.");
    }
  }

  return (
    <article data-employee-report className="mt-5 space-y-4 print:mt-0 print:space-y-3" aria-label="Official employee leave report">
      <style>{`@page { size: landscape; margin: 12mm; }`}</style>
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Official employee leave report</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{report.employee.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {report.employee.employeeId} · {formatDate(report.period.startDate)} to {formatDate(report.period.endDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => downloadPdf(report)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800">
              <FileText size={15} /> Export PDF
            </button>
            <button type="button" onClick={() => downloadCsv(report)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Download size={15} /> Export CSV
            </button>
            <button type="button" onClick={() => void handleExcelExport()} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <FileSpreadsheet size={15} /> Export Excel
            </button>
          </div>
        </div>
        {excelError && <p role="alert" className="mt-3 text-sm text-red-700 print:hidden">{excelError}</p>}
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Employee name" value={report.employee.name} />
          <Info label="Employee ID" value={report.employee.employeeId} />
          <Info label="Designation" value={report.employee.designation} />
          <Info label="Department" value={report.employee.department} />
          <Info label="Stream" value={report.employee.stream} />
          <Info label="Mobile" value={report.employee.mobile} />
          <Info label="Work email" value={report.employee.workEmail} />
        </dl>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-slate-400 print:shadow-none">
        <h3 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">Leave history · leaves taken</h3>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[900px] table-fixed text-left text-sm print:min-w-0 print:text-[10px]">
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "36%" }} />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase text-slate-600 print:bg-slate-100">
              <tr>
                <th className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">Leave start date</th>
                <th className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">Leave end date</th>
                <th className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">Duration</th>
                <th className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">Leave type</th>
                <th className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">Applied on</th>
                <th className="px-2 py-3 print:px-1 print:py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {report.leaveHistory.map((leave, index) => (
                <tr key={leave.id} className={`break-inside-avoid border-t border-slate-100 align-top ${index % 2 === 1 ? "bg-slate-50/70 print:bg-slate-50" : ""}`}>
                  <td className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">{formatDate(leave.startDate)}</td>
                  <td className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">{formatDate(leave.endDate)}</td>
                  <td className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">{leave.duration} day{leave.duration === 1 ? "" : "s"}</td>
                  <td className="break-words px-2 py-3 print:px-1 print:py-2">{leave.leaveType}</td>
                  <td className="whitespace-nowrap px-2 py-3 print:px-1 print:py-2">{formatDate(leave.appliedAt)}</td>
                  <td className="whitespace-pre-wrap break-words px-2 py-3 print:px-1 print:py-2">{leave.reason || "—"}</td>
                </tr>
              ))}
              {!report.leaveHistory.length && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">No leave was taken during this reporting period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}
