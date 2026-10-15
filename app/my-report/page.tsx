"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, ChevronDown, FileText, LoaderCircle, UserRound } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";
import EmployeeReportDocument, { type EmployeeReportData } from "../leave-report/EmployeeReportDocument";

type EmployeeProfile = EmployeeReportData["employee"];
type Semester = "FULL" | "ODD" | "EVEN";
type ReportingPeriod = {
  start: string;
  end: string;
  academicYearStart: string;
  academicYearEnd: string;
};

type ApiResponse<T> = T | { error: string };

async function readJson<T>(response: Response): Promise<T> {
  const result = await response.json() as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(result && typeof result === "object" && "error" in result
      ? result.error
      : "Unable to load your leave report.");
  }
  return result as T;
}

function currentAcademicYearStart() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function academicYearRange(startYear: number, semester: Semester) {
  if (semester === "ODD") return { start: `${startYear}-07-01`, end: `${startYear}-12-31` };
  if (semester === "EVEN") return { start: `${startYear + 1}-01-01`, end: `${startYear + 1}-06-30` };
  return { start: `${startYear}-07-01`, end: `${startYear + 1}-06-30` };
}

function academicYearBounds(startDate: string, endDate: string) {
  const academicYearFor = (date: string) => {
    const year = Number(date.slice(0, 4));
    return Number(date.slice(5, 7)) < 7 ? year - 1 : year;
  };
  const firstYear = academicYearFor(startDate);
  const lastYear = academicYearFor(endDate);
  return {
    academicYearStart: `${firstYear}-07-01`,
    academicYearEnd: `${lastYear + 1}-06-30`,
  };
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export default function MyReportPage() {
  const currentYear = useMemo(currentAcademicYearStart, []);
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [durationOpen, setDurationOpen] = useState(false);
  const [academicYear, setAcademicYear] = useState(currentYear);
  const [semester, setSemester] = useState<Semester>("FULL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState<ReportingPeriod | null>(null);
  const [report, setReport] = useState<EmployeeReportData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadEmployee() {
      try {
        const response = await fetch("/api/my-report", { cache: "no-store" });
        const result = await readJson<{ employee: EmployeeProfile }>(response);
        if (!cancelled) setEmployee(result.employee);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load employee profile.");
      } finally {
        if (!cancelled) setIsLoadingEmployee(false);
      }
    }
    void loadEmployee();
    return () => { cancelled = true; };
  }, []);

  const yearOptions = useMemo(
    () => Array.from({ length: Math.max(1, currentYear - 2010 + 1) }, (_, index) => currentYear - index),
    [currentYear],
  );
  const selectedAcademicRange = academicYearRange(academicYear, semester);
  const hasCustomDates = Boolean(startDate || endDate);
  const customDatesValid = Boolean(startDate && endDate && endDate >= startDate);
  const canProceed = hasCustomDates ? customDatesValid : Boolean(selectedAcademicRange.start && selectedAcademicRange.end);
  const durationLabel = period
    ? `${formatDate(period.start)} – ${formatDate(period.end)}`
    : "Select reporting duration";

  function openDurationDialog() {
    setStartDate("");
    setEndDate("");
    setAcademicYear(currentYear);
    setSemester("FULL");
    setDurationOpen(true);
  }

  function proceedDuration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canProceed) return;
    const selectedPeriod = hasCustomDates
      ? { start: startDate, end: endDate, ...academicYearBounds(startDate, endDate) }
      : {
          ...selectedAcademicRange,
          academicYearStart: `${academicYear}-07-01`,
          academicYearEnd: `${academicYear + 1}-06-30`,
        };
    setPeriod(selectedPeriod);
    setReport(null);
    setError("");
    setDurationOpen(false);
  }

  async function generateReport() {
    if (!period) return;
    setIsGenerating(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate: period.start,
        endDate: period.end,
        academicYearStart: period.academicYearStart,
        academicYearEnd: period.academicYearEnd,
      });
      const response = await fetch(`/api/my-report?${params}`, { cache: "no-store" });
      setReport(await readJson<EmployeeReportData>(response));
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Unable to generate your report.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="my-report" />
      <main className="p-4 min-[801px]:ml-[175px] print:ml-0 print:p-0">
        <div className="mx-auto max-w-[1200px] print:max-w-none">
          <header className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm print:hidden">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Leave Report - Employee</p>
            <h1 className="text-3xl font-bold text-slate-900">My Report</h1>
            <p className="mt-1 text-sm text-slate-600">View and export your leave history for the selected reporting period.</p>
          </header>

          <section aria-label="My report controls" className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
            {employee && (
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-800"><UserRound size={20} /></span>
                <div>
                  <p className="font-semibold text-slate-900">{employee.name}</p>
                  <p className="text-sm text-slate-500">{employee.employeeId} · {employee.department} · {employee.stream}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Report duration</label>
                <button
                  type="button"
                  disabled={!employee || isLoadingEmployee}
                  onClick={openDurationDialog}
                  className="flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-4 text-left text-sm text-slate-800 transition hover:border-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <span>{durationLabel}</span>
                  <CalendarDays size={18} className="shrink-0 text-emerald-700" />
                </button>
              </div>
              <button
                type="button"
                disabled={!employee || !period || isGenerating}
                onClick={() => void generateReport()}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isGenerating ? <LoaderCircle size={17} className="animate-spin" /> : <FileText size={17} />}
                GENERATE
              </button>
            </div>
            {(isLoadingEmployee || isGenerating) && (
              <p className="mt-3 text-sm text-slate-500">{isLoadingEmployee ? "Loading employee profile…" : "Generating your report…"}</p>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          </section>

          {report && <EmployeeReportDocument report={report} />}
        </div>
      </main>

      {durationOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setDurationOpen(false); }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="duration-title"
            onSubmit={proceedDuration}
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 id="duration-title" className="text-xl font-bold text-slate-900">Choose report duration</h2>
            <p className="mt-1 text-sm text-slate-500">Select an exact date range or choose an academic year and semester.</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-600">
                Start date
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(event) => { setStartDate(event.target.value); setError(""); }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-800"
                />
              </label>
              <label className="text-sm font-medium text-slate-600">
                End date
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => { setEndDate(event.target.value); setError(""); }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-800"
                />
              </label>
            </div>
            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />OR<span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-600">
                Academic year
                <span className="relative mt-1.5 block">
                  <select
                    value={academicYear}
                    onChange={(event) => { setAcademicYear(Number(event.target.value)); setStartDate(""); setEndDate(""); }}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-slate-800"
                  >
                    {yearOptions.map((year) => <option key={year} value={year}>{year}–{year + 1}</option>)}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                </span>
              </label>
              <label className="text-sm font-medium text-slate-600">
                Semester
                <span className="relative mt-1.5 block">
                  <select
                    value={semester}
                    onChange={(event) => { setSemester(event.target.value as Semester); setStartDate(""); setEndDate(""); }}
                    className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-9 text-slate-800"
                  >
                    <option value="FULL">Whole year (both semesters)</option>
                    <option value="ODD">Odd semester</option>
                    <option value="EVEN">Even semester</option>
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                </span>
              </label>
            </div>
            {hasCustomDates && !customDatesValid && (
              <p role="alert" className="mt-3 text-sm text-red-700">Choose valid start and end dates; the end date must not precede the start date.</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDurationOpen(false)} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={!canProceed} className="h-10 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">PROCEED</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
