"use client";

import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

const departments = ["Computer Science", "Commerce", "English", "Mathematics", "Physics"];
const employeeNames = [
  "Anandh",
  "Arjun",
  "Diya Menon",
  "cenkatesh",
  "Kavya",
  "Rohan Das",
  "Sneha Thomas",
  "Vikram",
];
const employees = employeeNames.map((name, employeeIndex) => ({
  id: `EMP-${String(employeeIndex + 1).padStart(3, "0")}`,
  name,
  department: departments[employeeIndex % departments.length],
  stream: employeeIndex % 2 === 0 ? "SFS" : "AIDED",
}));

type LeaveType = {
  code: string;
  id: number;
  name: string;
  daysAllowed: number;
  status: "ACTIVE" | "INACTIVE";
};

export default function LeaveEligibilityPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [search, setSearch] = useState("");
  const leaveTypeColumnCount = Math.max(leaveTypes.length, 1);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleEmployees = employees.filter((employee) =>
    (!streamFilter || employee.stream === streamFilter) &&
    (!departmentFilter || employee.department === departmentFilter) &&
    (!employeeFilter || employee.name === employeeFilter) &&
    (!normalizedSearch || employee.name.toLowerCase().includes(normalizedSearch) || employee.id.toLowerCase().includes(normalizedSearch))
  );
  const handleExport = () => {
    const rows = [
      ["EMPLOYEE ID", "EMPLOYEE NAME", ...leaveTypes.map((leaveType) => `ELIGIBILITY: ${leaveType.code}`), ...leaveTypes.map((leaveType) => `BALANCE: ${leaveType.code}`)],
      ...visibleEmployees.map((employee) => [
        employee.id,
        employee.name,
        ...leaveTypes.map((leaveType) => leaveType.status === "ACTIVE" ? `${leaveType.daysAllowed} days` : "Unavailable"),
        ...leaveTypes.map(() => "Not available"),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "leave-eligibility.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let isMounted = true;

    fetch("/api/leave-types")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load leave eligibility.");
        return result as LeaveType[];
      })
      .then((result) => {
        if (isMounted) setLeaveTypes(result);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leave eligibility.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="eligibility" />
      <div className="p-4 min-[801px]:ml-[175px]">
      <div className="mx-auto max-w-[1400px]">
        <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-800">Leave Eligibility</h1>
        </header>

        <section aria-label="Employee filters" className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center">
          <select
            aria-label="Filter by stream"
            value={streamFilter}
            onChange={(event) => setStreamFilter(event.target.value)}
            className="h-10 min-w-36 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">All Streams</option>
            <option value="SFS">SFS</option>
            <option value="AIDED">AIDED</option>
          </select>

          <select
            aria-label="Filter by department"
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">All Departments</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>

          <select
            aria-label="Filter by employee"
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
            className="h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="">All Employees</option>
            {employees.map((employee) => <option key={employee.id} value={employee.name}>{employee.name}</option>)}
          </select>

          <label className="relative min-w-48 flex-1">
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              aria-label="Search employees"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employees"
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
            />
          </label>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
          >
            <Download size={16} aria-hidden="true" />
            Export
          </button>
        </section>

        <main className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {error && (
            <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th rowSpan={2} className="whitespace-nowrap px-5 py-3 font-medium">EMPLOYEE ID</th>
                  <th rowSpan={2} className="whitespace-nowrap px-5 py-3 font-medium">EMPLOYEE NAME</th>
                  <th colSpan={leaveTypeColumnCount} className="px-5 py-3 text-center font-medium">LEAVE ELIGIBILITY</th>
                  <th colSpan={leaveTypeColumnCount} className="px-5 py-3 text-center font-medium">LEAVE BALANCE</th>
                </tr>
                <tr>
                  {leaveTypes.length > 0 ? leaveTypes.map((leaveType) => (
                    <th key={`eligibility-${leaveType.id}`} className="whitespace-nowrap px-5 py-3 font-medium">
                      {leaveType.code}
                    </th>
                  )) : <th className="px-5 py-3 font-normal text-slate-400">No leave types</th>}
                  {leaveTypes.length > 0 ? leaveTypes.map((leaveType) => (
                    <th key={`balance-${leaveType.id}`} className="whitespace-nowrap px-5 py-3 font-medium">
                      {leaveType.code}
                    </th>
                  )) : <th className="px-5 py-3 font-normal text-slate-400">No leave types</th>}
                </tr>
              </thead>
              <tbody>
                {!isLoading && !error && visibleEmployees.map((employee) => (
                  <tr key={employee.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">{employee.id}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">{employee.name}</td>
                    {leaveTypes.map((leaveType) => (
                      <td key={`eligibility-${employee.id}-${leaveType.id}`} className="whitespace-nowrap px-5 py-4 text-slate-700">
                        {leaveType.status === "ACTIVE" ? `${leaveType.daysAllowed} DAYS` : "Unavailable"}
                      </td>
                    ))}
                    {leaveTypes.map((leaveType) => (
                      <td key={`balance-${employee.id}-${leaveType.id}`} className="whitespace-nowrap px-5 py-4 text-slate-500">
                        Not available
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && !error && visibleEmployees.length === 0 && leaveTypes.length > 0 && (
                  <tr className="border-t border-slate-200">
                    <td colSpan={2 + leaveTypeColumnCount * 2} className="px-5 py-12 text-center text-slate-500">
                      "No employees match the selected filters."
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isLoading && <div className="flex items-center justify-center px-6 py-12 text-slate-500">Loading leave eligibility...</div>}
          {!isLoading && !error && leaveTypes.length === 0 && (
            <div className="flex items-center justify-center px-6 py-12 text-slate-500">No leave types found.</div>
          )}
        </main>
      </div>
      </div>
    </div>
  );
}