"use client";

import { useEffect, useState } from "react";
import { ArrowRight, FileText, Info, LoaderCircle, UserRound, X } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";
import EmployeeReportDocument, { type EmployeeReportData } from "../leave-report/EmployeeReportDocument";

type EmployeeProfile = EmployeeReportData["employee"];

type ApiResponse<T> = T | { error: string };

async function readJson<T>(response: Response): Promise<T> {
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(
      result && typeof result === "object" && "error" in result
        ? result.error
        : "Unable to load your leave report."
    );
  }
  return result as T;
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

export default function MyReportPage() {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");
  const [report, setReport] = useState<EmployeeReportData | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showInfoModal) setShowInfoModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfoModal]);

  useEffect(() => {
    let cancelled = false;
    async function loadEmployee() {
      try {
        const response = await fetch("/api/my-report", { cache: "no-store" });
        const result = await readJson<{ employee: EmployeeProfile }>(response);
        if (!cancelled) setEmployee(result.employee);
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load employee profile."
          );
      } finally {
        if (!cancelled) setIsLoadingEmployee(false);
      }
    }
    void loadEmployee();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartDate = (value: string) => {
    setStartDate(value);
    setReport(null);
    if (endDate && value && value > endDate) {
      setDateError("Start date cannot be after end date.");
    } else {
      setDateError("");
    }
  };

  const handleEndDate = (value: string) => {
    setEndDate(value);
    setReport(null);
    if (startDate && value && value < startDate) {
      setDateError("End date cannot be before start date.");
    } else {
      setDateError("");
    }
  };

  async function generateReport() {
    if (!startDate || !endDate || dateError) return;
    setIsGenerating(true);
    setError("");
    setReport(null);
    try {
      const bounds = academicYearBounds(startDate, endDate);
      const params = new URLSearchParams({
        startDate,
        endDate,
        academicYearStart: bounds.academicYearStart,
        academicYearEnd: bounds.academicYearEnd,
      });
      const response = await fetch(`/api/my-report?${params}`, { cache: "no-store" });
      setReport(await readJson<EmployeeReportData>(response));
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Unable to generate your report."
      );
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
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Leave Report - Employee
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">My Report</h1>
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                title="About My Report"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:bg-sky-100 hover:text-sky-800"
                aria-label="About My Report"
              >
                <Info size={15} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              View and export your leave history for the selected reporting period.
            </p>
          </header>

          <section
            aria-label="My report controls"
            className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden"
          >
            {employee && (
              <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
                <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-800">
                  <UserRound size={20} />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{employee.name}</p>
                  <p className="text-sm text-slate-500">
                    {employee.employeeId} · {employee.department} · {employee.stream}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {/* Date Range — Kept outside like Leave Status Report & Individual Report */}
              <div className="min-w-0 max-w-md flex-1">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Date Range
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    id="filter-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDate(e.target.value)}
                    disabled={!employee || isLoadingEmployee}
                    aria-label="Start date"
                    title="Start date"
                    className={`h-11 min-w-0 w-full rounded-lg border px-3 text-sm outline-none transition-colors ${
                      employee && !isLoadingEmployee
                        ? "border-slate-300 bg-white text-slate-700 cursor-pointer focus:border-emerald-600"
                        : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none opacity-60"
                    }`}
                  />
                  <ArrowRight
                    size={15}
                    className={`shrink-0 ${
                      employee && !isLoadingEmployee ? "text-slate-400" : "text-slate-300"
                    }`}
                    aria-hidden="true"
                  />
                  <input
                    id="filter-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDate(e.target.value)}
                    disabled={!employee || isLoadingEmployee}
                    aria-label="End date"
                    title="End date"
                    min={startDate || undefined}
                    className={`h-11 min-w-0 w-full rounded-lg border px-3 text-sm outline-none transition-colors ${
                      employee && !isLoadingEmployee
                        ? "border-slate-300 bg-white text-slate-700 cursor-pointer focus:border-emerald-600"
                        : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none opacity-60"
                    }`}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={
                  !employee ||
                  !startDate ||
                  !endDate ||
                  Boolean(dateError) ||
                  isGenerating ||
                  isLoadingEmployee
                }
                onClick={() => void generateReport()}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isGenerating ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                GENERATE
              </button>
            </div>

            {dateError && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700"
              >
                {dateError}
              </p>
            )}

            {(isLoadingEmployee || isGenerating) && (
              <p className="mt-3 text-sm text-slate-500">
                {isLoadingEmployee
                  ? "Loading employee profile…"
                  : "Generating your report…"}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {error}
              </p>
            )}
          </section>

          {report && <EmployeeReportDocument report={report} />}
        </div>
      </main>

      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 print:hidden"
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
                  <h3 className="text-lg font-bold text-slate-800">About My Report</h3>
                  <p className="text-xs text-slate-500">Personal leave history, entitlements & ledger</p>
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900">What is My Report?</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-sky-950">
                  A personal self-service statement displaying your allocated leave quotas, approved absences, available balances, and academic year summaries.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
                    How it works
                  </h5>
                  <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                    <li>Retrieves your individual leave records for the specified date span.</li>
                    <li>Summarizes days allowed, days taken, and remaining balances per leave type.</li>
                    <li>Generates a clean statement ready for viewing or printing.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    How to use it
                  </h5>
                  <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
                    <li>Pick the <strong>Start Date</strong> and <strong>End Date</strong>.</li>
                    <li>Click <strong>Generate</strong> to fetch your personal report.</li>
                    <li>Review your balance ledger and applied leave details.</li>
                    <li>Click <strong>Print / Export</strong> to download a PDF copy.</li>
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
