"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";

export type EmployeeRow = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  employeeType?: string;
  balance: number;
  blockedLeaveCount: number;
  creditCount: number;
};

type HistoryAction = "view" | "edit" | "delete";
type SortColumn = "employeeId" | "name" | "stream" | "department" | "balance";

export default function EmployeeTable({
  employees,
  selectedIds,
  onToggleEmployee,
  onToggleVisible,
  onHistory,
  mode,
}: {
  employees: EmployeeRow[];
  selectedIds: string[];
  onToggleEmployee: (employeeId: string) => void;
  onToggleVisible: () => void;
  onHistory: (employee: EmployeeRow, action: HistoryAction) => void;
  mode: "block" | "credit";
}) {
  const [sort, setSort] = useState<{ column: SortColumn; ascending: boolean }>({
    column: "employeeId",
    ascending: true,
  });
  const sortedEmployees = useMemo(() => [...employees].sort((left, right) => {
    const streamRank = (stream: string) => stream.toUpperCase() === "AIDED" ? 0 : stream.toUpperCase() === "SFS" ? 1 : 2;
    if (sort.column === "employeeId") {
      return streamRank(left.stream) - streamRank(right.stream) ||
        left.employeeId.localeCompare(right.employeeId, undefined, { numeric: true, sensitivity: "base" }) * (sort.ascending ? 1 : -1);
    }
    const comparison = sort.column === "balance"
      ? left.balance - right.balance
      : left[sort.column].localeCompare(right[sort.column], undefined, { numeric: true, sensitivity: "base" });
    return comparison * (sort.ascending ? 1 : -1) ||
      streamRank(left.stream) - streamRank(right.stream) ||
      left.employeeId.localeCompare(right.employeeId, undefined, { numeric: true, sensitivity: "base" });
  }), [employees, sort]);

  const toggleSort = (column: SortColumn) => {
    setSort((current) => current.column === column
      ? { column, ascending: !current.ascending }
      : { column, ascending: true });
  };
  const sortHeading = (column: SortColumn, label: string) => (
    <button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1 font-semibold hover:text-emerald-800">
      {label}<span aria-hidden="true" className="text-slate-400">{sort.column === column ? (sort.ascending ? "↑" : "↓") : "↕"}</span>
    </button>
  );
  const allSelected = sortedEmployees.length > 0 && sortedEmployees.every(({ employeeId }) => selectedIds.includes(employeeId));

  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-800">Employees</h2>
        <span className="text-xs text-slate-500">{selectedIds.length} selected · {sortedEmployees.length} shown</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="w-12 px-5 py-3">
                <input type="checkbox" aria-label="Select all shown employees" checked={allSelected} onChange={onToggleVisible} className="accent-emerald-700" />
              </th>
              <th className="px-4 py-3">{sortHeading("employeeId", "EMPLOYEE ID")}</th>
              <th className="px-4 py-3">{sortHeading("name", "EMPLOYEE NAME")}</th>
              <th className="px-4 py-3">{sortHeading("stream", "STREAM")}</th>
              <th className="px-4 py-3">{sortHeading("department", "DEPARTMENT")}</th>
              {mode === "credit" && <th className="px-4 py-3">{sortHeading("balance", "CURRENT BALANCE")}</th>}
              <th className="px-4 py-3">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {sortedEmployees.map((employee) => {
              const hasHistory = mode === "block" ? employee.blockedLeaveCount > 0 : employee.creditCount > 0;
              return (
                <tr key={employee.employeeId} className="border-t border-slate-100">
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${employee.name}`}
                      checked={selectedIds.includes(employee.employeeId)}
                      onChange={() => onToggleEmployee(employee.employeeId)}
                      className="accent-emerald-700"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{employee.employeeId}</td>
                  <td className="px-4 py-3">{employee.name}</td>
                  <td className="px-4 py-3">{employee.stream}</td>
                  <td className="px-4 py-3">{employee.department}</td>
                  {mode === "credit" && <td className="px-4 py-3 font-medium text-emerald-800">{employee.balance} days</td>}
                  <td className="px-4 py-2">
                    {hasHistory && (
                      <div className="flex gap-1">
                        <button type="button" title="View records" aria-label={`View leave records for ${employee.name}`} onClick={() => onHistory(employee, "view")} className="rounded p-2 text-slate-600 hover:bg-slate-100"><Eye size={15} /></button>
                        <button type="button" title="Edit records" aria-label={`Edit leave records for ${employee.name}`} onClick={() => onHistory(employee, "edit")} className="rounded p-2 text-slate-600 hover:bg-slate-100"><Pencil size={15} /></button>
                        <button type="button" title="Delete records" aria-label={`Delete leave records for ${employee.name}`} onClick={() => onHistory(employee, "delete")} className="rounded p-2 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {sortedEmployees.length === 0 && (
              <tr><td colSpan={mode === "credit" ? 7 : 6} className="px-5 py-10 text-center text-slate-500">No employees match those filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
