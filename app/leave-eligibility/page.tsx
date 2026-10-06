"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

type LeaveEligibilityRow = {
  id: number;
  stream: string;
  department: string;
  employee: string;
  type: string;
  from: string;
  status: "Pending" | "Approved";
};

const mockRows: LeaveEligibilityRow[] = [
  {
    id: 1,
    stream: "SFS",
    department: "Commerce",
    employee: "Student A",
    type: "Medical",
    from: "05 Oct",
    status: "Pending",
  },
  {
    id: 2,
    stream: "Aided",
    department: "CS",
    employee: "Staff B",
    type: "Casual",
    from: "07 Oct",
    status: "Approved",
  },
];

function formatLocalTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

async function loadMockRows(): Promise<LeaveEligibilityRow[]> {
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  return mockRows.map((row) => ({ ...row }));
}

export default function LeaveEligibility() {
  const [rows, setRows] = useState<LeaveEligibilityRow[]>(mockRows);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshLock = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLastUpdated(formatLocalTime(new Date()));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const handleRefresh = async () => {
    if (refreshLock.current) return;

    refreshLock.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const refreshedRows = await loadMockRows();
      setRows(refreshedRows);
      setLastUpdated(formatLocalTime(new Date()));
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "Unable to refresh leave eligibility data.",
      );
    } finally {
      refreshLock.current = false;
      setIsRefreshing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 sm:p-6 lg:p-8">
      <section
        aria-labelledby="leave-eligibility-title"
        aria-busy={isRefreshing}
        className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <h1
              id="leave-eligibility-title"
              className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl"
            >
              Leave Eligibility
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Last updated: {lastUpdated ?? "—"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw
              aria-hidden="true"
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {refreshError && (
          <p
            role="alert"
            className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-7"
          >
            {refreshError}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-600 sm:text-sm">
                <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-4 sm:px-6">
                  S.No
                </th>
                <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-4 sm:px-6">
                  Stream
                </th>
                <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-4 sm:px-6">
                  Department
                </th>
                <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-4 sm:px-6">
                  Name
                </th>
                <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-4 sm:px-6">
                  Type
                </th>
                <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-4 sm:px-6">
                  From
                </th>
                <th scope="col" className="whitespace-nowrap border-b border-slate-200 px-4 py-4 sm:px-6">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-white text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap border-b border-slate-100 px-4 py-4 font-medium text-slate-500 sm:px-6">
                    {row.id}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-4 py-4 sm:px-6">
                    {row.stream}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-4 py-4 sm:px-6">
                    {row.department}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-4 py-4 font-medium text-slate-800 sm:px-6">
                    {row.employee}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-4 py-4 sm:px-6">
                    {row.type}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-4 py-4 sm:px-6">
                    {row.from}
                  </td>
                  <td className="whitespace-nowrap border-b border-slate-100 px-4 py-4 sm:px-6">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        row.status === "Approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
