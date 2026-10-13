"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Download, FileText, LoaderCircle, Search } from "lucide-react";
import LeaveSidebar from "../../components/LeaveSidebar";
import FilterMultiSelect from "../../components/leave-admin/FilterMultiSelect";

type EmployeeOption = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
};

type ReportData = {
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
    academicYearStart: string;
    academicYearEnd: string;
  };
  leaveTypes: {
    id: number;
    code: string;
    name: string;
    category: string | null;
    allocatedPeriod: number;
    allocatedYear: number;
    leavesTaken: number;
    balance: number;
  }[];
  leaveHistory: {
    id: number;
    startDate: string;
    endDate: string;
    duration: number;
    leaveType: string;
    status: string;
    reason: string;
    approver: string | null;
    reviewedAt: string | null;
  }[];
  analytics: {
    workdays: number;
    missedWorkdays: number;
    absenteeismRate: number;
    utilizationRate: number;
    longestContinuousLeave: number;
    frequentlyUsedLeaveType: string;
    leaveTypeDays: { type: string; days: number }[];
  };
};

type Semester = "FULL" | "ODD" | "EVEN";

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { timeZone: "UTC", dateStyle: "medium", ...options }).format(date);
}

function academicYearStartFor(date: Date) {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

function dateRangeForSemester(startYear: number, semester: Semester) {
  if (semester === "ODD") return { start: `${startYear}-07-01`, end: `${startYear}-12-31` };
  if (semester === "EVEN") return { start: `${startYear + 1}-01-01`, end: `${startYear + 1}-06-30` };
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(text) as unknown;
  } catch {
    throw new Error(text.trim() || "The server returned an empty or invalid response.");
  }
  if (!response.ok) {
    const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Unable to load the individual leave report.";
    throw new Error(error);
  }
  return result as T;
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function IndividualLeaveReportPage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [streams, setStreams] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [employeeListOpen, setEmployeeListOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [semester, setSemester] = useState<Semester>("FULL");
  const [academicYearStart, setAcademicYearStart] = useState(() => academicYearStartFor(new Date()));
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [period, setPeriod] = useState<{ start: string; end: string; yearStart: string; yearEnd: string; mode: "dates" | "academic" } | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [durationError, setDurationError] = useState("");
  const employeePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadEmployees() {
      try {
        const response = await fetch("/api/block-leave?category=ANNUAL", { cache: "no-store" });
        const data = await readJson<{ employees: EmployeeOption[]; streams: string[]; departments: string[] }>(response);
        if (cancelled) return;
        setEmployees(data.employees);
        setStreams(data.streams);
        setDepartments(data.departments);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load employees.");
      } finally {
        if (!cancelled) setIsLoadingEmployees(false);
      }
    }
    void loadEmployees();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !employeePickerRef.current?.contains(event.target)) {
        setEmployeeListOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  const visibleEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) =>
      (!selectedStreams.length || selectedStreams.includes(employee.stream)) &&
      (!selectedDepartments.length || selectedDepartments.includes(employee.department)) &&
      (!search || employee.name.toLowerCase().includes(search) || employee.employeeId.toLowerCase().includes(search))
    );
  }, [employees, employeeSearch, selectedDepartments, selectedStreams]);

  const yearOptions = useMemo(() => {
    const currentYear = academicYearStartFor(new Date());
    return Array.from({ length: 11 }, (_, index) => currentYear - index);
  }, []);
  const customDateRangeIsValid = useMemo(() => {
    if (!customStart || !customEnd || customEnd < customStart) return false;
    const startYear = academicYearStartFor(new Date(`${customStart}T00:00:00.000Z`));
    const academicDates = dateRangeForSemester(startYear, "FULL");
    return customStart >= academicDates.start && customEnd <= academicDates.end;
  }, [customEnd, customStart]);

  const durationLabel = period
    ? `${formatDate(period.start)} – ${formatDate(period.end)}`
    : "Select reporting duration";

  const openDurationDialog = () => {
    const currentYear = academicYearStartFor(new Date());
    setAcademicYearStart(period ? Number(period.yearStart.slice(0, 4)) : currentYear);
    setSemester("FULL");
    setCustomStart(period?.mode === "dates" ? period.start : "");
    setCustomEnd(period?.mode === "dates" ? period.end : "");
    setDurationError("");
    setDurationOpen(true);
  };

  const proceedDuration = () => {
    let dates: { start: string; end: string };
    let startYear: number;
    if (customStart || customEnd) {
      if (!customDateRangeIsValid) {
        setDurationError("Choose a valid start and end date.");
        return;
      }
      startYear = academicYearStartFor(new Date(`${customStart}T00:00:00.000Z`));
      const yearDates = dateRangeForSemester(startYear, "FULL");
      if (customStart < yearDates.start || customEnd > yearDates.end) {
        setDurationError("The custom date range must fit within one academic year.");
        return;
      }
      dates = { start: customStart, end: customEnd };
    } else {
      startYear = academicYearStart;
      dates = dateRangeForSemester(academicYearStart, semester);
    }

    const academicDates = dateRangeForSemester(startYear, "FULL");
    setPeriod({
      ...dates,
      yearStart: academicDates.start,
      yearEnd: academicDates.end,
      mode: customStart || customEnd ? "dates" : "academic",
    });
    setReport(null);
    setError("");
    setDurationOpen(false);
  };

  const generateReport = async () => {
    if (!selectedEmployee || !period) return;
    setIsGenerating(true);
    setError("");
    setReport(null);
    try {
      const params = new URLSearchParams({
        employeeId: selectedEmployee.employeeId,
        startDate: period.start,
        endDate: period.end,
        academicYearStart: period.yearStart,
        academicYearEnd: period.yearEnd,
      });
      const response = await fetch(`/api/individual-report?${params.toString()}`, { cache: "no-store" });
      setReport(await readJson<ReportData>(response));
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Unable to generate the report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const rows: (string | number | null)[][] = [
      ["Individual Leave Report"],
      ["Employee", report.employee.name],
      ["Employee ID", report.employee.employeeId],
      ["Designation", report.employee.designation ?? "Not recorded"],
      ["Department", report.employee.department],
      ["Stream", report.employee.stream],
      ["Mobile", report.employee.mobile ?? "Not recorded"],
      ["Work email", report.employee.workEmail ?? "Not recorded"],
      ["Period", `${report.period.startDate.slice(0, 10)} to ${report.period.endDate.slice(0, 10)}`],
      [],
      ["Leave Type", "Total allocated (period)", "Total allocated (academic year)", "Leaves taken", "Balance"],
      ...report.leaveTypes.map((type) => [type.name, type.allocatedPeriod, type.allocatedYear, type.leavesTaken, type.balance]),
      [],
      ["Leave History"],
      ["Start Date", "End Date", "Day(s)", "Duration", "Leave Type", "Status", "Reason", "Approver", "Reviewed on"],
      ...report.leaveHistory.map((leave) => [
        leave.startDate.slice(0, 10),
        leave.endDate.slice(0, 10),
        dayRange(leave.startDate, leave.endDate),
        leave.duration,
        leave.leaveType,
        leave.status,
        leave.reason,
        leave.approver,
        leave.reviewedAt?.slice(0, 10) ?? "",
      ]),
    ];
    const content = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `leave-report-${report.employee.employeeId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const pieGradient = (() => {
    const segments = report?.analytics.leaveTypeDays.filter((item) => item.days > 0) ?? [];
    const workdays = report?.analytics.workdays ?? 0;
    if (!segments.length || workdays === 0) return "conic-gradient(#e2e8f0 0% 100%)";
    const totalMissed = segments.reduce((sum, item) => sum + item.days, 0);
    const scale = Math.min(1, workdays / totalMissed);
    const colors = ["#047857", "#0f766e", "#0284c7", "#7c3aed", "#d97706", "#dc2626"];
    let position = 0;
    const slices = segments.map((item, index) => {
      const next = position + item.days * scale / workdays * 100;
      const segment = `${colors[index % colors.length]} ${position}% ${next}%`;
      position = next;
      return segment;
    });
    if (position < 100) slices.push(`#e2e8f0 ${position}% 100%`);
    return `conic-gradient(${slices.join(", ")})`;
  })();
  const pieSegments = report?.analytics.leaveTypeDays.filter((item) => item.days > 0) ?? [];

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="individual-report" />
      <main className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px]">
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm print:hidden">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Leave Report</p>
            <h1 className="text-3xl font-bold text-slate-800">Individual Report</h1>
            <p className="mt-1 text-sm text-slate-500">Review an employee’s leave allocation, history, and usage analytics.</p>
          </header>

          <section aria-label="Employee and report filters" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(130px,1fr)_minmax(150px,1.1fr)_minmax(220px,1.5fr)_minmax(230px,1.25fr)_auto]">
              <FilterMultiSelect label="Stream" options={streams} selected={selectedStreams} onChange={(values) => {
                setSelectedStreams(values);
                setSelectedEmployee(null);
                setReport(null);
              }} />
              <FilterMultiSelect label="Department" options={departments} selected={selectedDepartments} onChange={(values) => {
                setSelectedDepartments(values);
                setSelectedEmployee(null);
                setReport(null);
              }} />
              <div ref={employeePickerRef} className={`relative min-w-0 ${employeeListOpen ? "z-30" : ""}`}>
                <label className="mb-1.5 block text-xs font-medium text-slate-600" htmlFor="report-employee">Employee</label>
                <button id="report-employee" type="button" aria-expanded={employeeListOpen}
                  onClick={() => setEmployeeListOpen((open) => !open)}
                  className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 px-3 text-left text-sm hover:border-slate-400">
                  <span className="truncate">{selectedEmployee ? `${selectedEmployee.name} (${selectedEmployee.employeeId})` : "Select an employee"}</span>
                  <ChevronDown size={16} className="ml-2 shrink-0" />
                </button>
                {employeeListOpen && (
                  <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-full min-w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input autoFocus type="search" value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === "Escape") setEmployeeListOpen(false);
                        }}
                        placeholder="Search by employee name or ID" aria-label="Search employees"
                        className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
                    </div>
                    <div className="mt-2 max-h-56 overflow-y-auto" role="listbox" aria-label="Employees">
                      {visibleEmployees.map((employee) => (
                        <button type="button" key={employee.employeeId} role="option" aria-selected={selectedEmployee?.employeeId === employee.employeeId}
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setEmployeeSearch("");
                            setEmployeeListOpen(false);
                            setReport(null);
                          }}
                          className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-50">
                          <span className="block font-medium">{employee.name}</span>
                          <span className="text-xs text-slate-500">{employee.employeeId} · {employee.department} · {employee.stream}</span>
                        </button>
                      ))}
                      {!visibleEmployees.length && <p className="px-3 py-4 text-center text-sm text-slate-500">No employees match these filters.</p>}
                    </div>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">Report duration</span>
                <button type="button" onClick={openDurationDialog}
                  className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 text-left text-sm hover:border-slate-400">
                  <span className="truncate">{durationLabel}</span><CalendarDays size={16} className="shrink-0 text-slate-500" />
                </button>
              </div>
              <button type="button" disabled={!selectedEmployee || !period || isGenerating || isLoadingEmployees} onClick={() => void generateReport()}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                {isGenerating ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />}
                GENERATE
              </button>
            </div>
            {isLoadingEmployees && <p className="mt-3 text-sm text-slate-500">Loading employees…</p>}
            {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          </section>

          {report && (
            <article className="mt-5 space-y-4" aria-label="Individual leave report">
              <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Official Leave Report</p>
                    <h2 className="mt-1 text-2xl font-bold">{report.employee.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">{report.employee.employeeId} · {formatDate(report.period.startDate)} to {formatDate(report.period.endDate)}</p>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50"><Download size={15} />Export CSV</button>
                    <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-900"><FileText size={15} />Print / Save PDF</button>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <InfoItem label="Employee ID" value={report.employee.employeeId} />
                  <InfoItem label="Designation" value={report.employee.designation ?? "Not recorded in employee profile"} />
                  <InfoItem label="Department and stream" value={`${report.employee.department} · ${report.employee.stream}`} />
                  <InfoItem label="Mobile" value={report.employee.mobile ?? "Not recorded in employee profile"} />
                  <InfoItem label="Work email" value={report.employee.workEmail ?? "Not recorded in employee profile"} />
                </dl>
              </header>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <h3 className="border-b border-slate-200 px-5 py-4 text-base font-semibold">Leave allocation and balance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                      <tr><th className="px-5 py-3">Leave type</th><th className="px-4 py-3">Allocated in period</th><th className="px-4 py-3">Allocated in academic year</th><th className="px-4 py-3">Leaves taken</th><th className="px-4 py-3">Balance</th></tr>
                    </thead>
                    <tbody>
                      {report.leaveTypes.map((type) => (
                        <tr key={type.id} className="border-t border-slate-100">
                          <td className="px-5 py-3"><span className="font-medium">{type.name}</span><span className="ml-2 text-xs text-slate-500">{type.code}{type.category ? ` · ${type.category}` : ""}</span></td>
                          <td className="px-4 py-3">{type.allocatedPeriod} days</td><td className="px-4 py-3">{type.allocatedYear} days</td><td className="px-4 py-3">{type.leavesTaken} days</td><td className="px-4 py-3 font-semibold">{type.balance} days</td>
                        </tr>
                      ))}
                      {!report.leaveTypes.length && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No eligible leave types are configured for this employee.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <h3 className="border-b border-slate-200 px-5 py-4 text-base font-semibold">Leave history</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                      <tr><th className="px-4 py-3">Start date</th><th className="px-4 py-3">End date</th><th className="px-4 py-3">Day(s)</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Leave type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Approver / reviewed on</th></tr>
                    </thead>
                    <tbody>
                      {report.leaveHistory.map((leave) => (
                        <tr key={leave.id} className="border-t border-slate-100 align-top">
                          <td className="whitespace-nowrap px-4 py-3">{formatDate(leave.startDate)}</td><td className="whitespace-nowrap px-4 py-3">{formatDate(leave.endDate)}</td>
                          <td className="whitespace-nowrap px-4 py-3">{dayRange(leave.startDate, leave.endDate)}</td><td className="px-4 py-3">{leave.duration} day{leave.duration === 1 ? "" : "s"}</td>
                          <td className="px-4 py-3">{leave.leaveType}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{leave.status}</span></td>
                          <td className="max-w-64 px-4 py-3">{leave.reason || "—"}</td>
                          <td className="px-4 py-3">{leave.approver ?? "—"}{leave.reviewedAt && <span className="block whitespace-nowrap text-xs text-slate-500">{formatDate(leave.reviewedAt)}</span>}</td>
                        </tr>
                      ))}
                      {!report.leaveHistory.length && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500">No leave history found in this reporting period.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold">Analytics</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Absenteeism rate" value={`${report.analytics.absenteeismRate.toFixed(1)}%`} detail={`${report.analytics.missedWorkdays} of ${report.analytics.workdays} workdays missed`} />
                  <Metric label="Leave utilization" value={`${report.analytics.utilizationRate.toFixed(1)}%`} detail="Leaves used against allocated leave for this period" />
                  <Metric label="Longest continuous leave" value={`${report.analytics.longestContinuousLeave} days`} detail="Based on taken leave records" />
                  <Metric label="Frequently used leave type" value={report.analytics.frequentlyUsedLeaveType} detail="Most working days missed by leave type" />
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-slate-100 pt-5">
                  <div aria-label="Pie chart of missed workdays by leave type" role="img" className="size-36 shrink-0 rounded-full" style={{ background: pieGradient }} />
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">Missed workdays by leave type</p>
                    {pieSegments.length
                      ? <>
                        {pieSegments.map((item, index) => (
                          <p key={item.type} className="flex items-center gap-2 text-slate-600">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: ["#047857", "#0f766e", "#0284c7", "#7c3aed", "#d97706", "#dc2626"][index % 6] }} />
                            {item.type}: {item.days} day{item.days === 1 ? "" : "s"}
                          </p>
                        ))}
                        {report.analytics.workdays > report.analytics.missedWorkdays && <p className="flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-full bg-slate-200" />Workdays without leave: {report.analytics.workdays - report.analytics.missedWorkdays}</p>}
                      </>
                      : <p className="text-slate-500">No taken leave days in this period.</p>}
                  </div>
                </div>
              </section>
              <p className="text-xs text-slate-500">Profile fields not recorded in the database are shown as “Not recorded”. Allocations are prorated across the academic year (July–June); holidays and weekends are excluded from absenteeism.</p>
            </article>
          )}
        </div>
      </main>

      {durationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDurationOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="duration-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="duration-title" className="text-xl font-bold">Report duration</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-600">Start date<input type="date" value={customStart} onChange={(event) => { setCustomStart(event.target.value); setDurationError(""); }} aria-label="Report start date" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-800" /></label>
              <label className="text-sm font-medium text-slate-600">End date<input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => { setCustomEnd(event.target.value); setDurationError(""); }} aria-label="Report end date" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-800" /></label>
            </div>
            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-600">Academic year
                <select value={academicYearStart} onChange={(event) => {
                  setAcademicYearStart(Number(event.target.value));
                  setCustomStart("");
                  setCustomEnd("");
                }} aria-label="Academic year" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">
                  {yearOptions.map((year) => <option key={year} value={year}>{year}–{year + 1}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-600">Semester
                <select value={semester} onChange={(event) => {
                  setSemester(event.target.value as Semester);
                  setCustomStart("");
                  setCustomEnd("");
                }} aria-label="Semester" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">
                  <option value="FULL">Whole year (both semesters)</option><option value="ODD">Odd semester</option><option value="EVEN">Even semester</option>
                </select>
              </label>
            </div>
            {(durationError || (Boolean(customStart || customEnd) && !customDateRangeIsValid)) && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {durationError || "Choose valid dates within the same academic year."}
              </p>
            )}
            <footer className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => setDurationOpen(false)} className="h-10 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700">CANCEL</button>
              <button type="button" disabled={Boolean(customStart || customEnd) && !customDateRangeIsValid} onClick={proceedDuration} className="h-10 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">PROCEED</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function dayRange(start: string, end: string) {
  const startDate = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  const endDate = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
  const weekday = (date: Date) => new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "long" }).format(date);
  return start.slice(0, 10) === end.slice(0, 10) ? weekday(startDate) : `${weekday(startDate)} – ${weekday(endDate)}`;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value}</dd></div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-800">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}
