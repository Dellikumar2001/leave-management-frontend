"use client";

import { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type LeaveType = {
  code: string;
  daysAllowed: number;
  id: number;
  name: string;
  status: "ACTIVE" | "INACTIVE";
};

type EmployeeLeaveRecord = {
  leaveTypeId: number;
  isEligible: boolean;
  daysAllowed: number;
  leaveBalance: number;
};

type Employee = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  leaveRecords: EmployeeLeaveRecord[];
};

type LeaveEligibilityData = {
  employees: Employee[];
  leaveTypes: LeaveType[];
};

function getEligibilityValue(employee: Employee, leaveType: LeaveType) {
  const record = employee.leaveRecords.find((item) => item.leaveTypeId === leaveType.id);
  if (leaveType.status !== "ACTIVE" || record?.isEligible === false) return "Unavailable";
  return `${leaveType.daysAllowed}`;
}

async function fetchLeaveEligibility(): Promise<LeaveEligibilityData> {
  const response = await fetch("/api/leave-eligibility", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Unable to load leave eligibility.");
  return result as LeaveEligibilityData;
}

export default function LeaveEligibilityPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [employeeNameFilter, setEmployeeNameFilter] = useState("");
  const [search, setSearch] = useState("");
  const departments = [...new Set(employees.map((employee) => employee.department))].sort();
  const leaveTypeColumnCount = Math.max(leaveTypes.length, 1);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleEmployees = employees.filter((employee) =>
    (!streamFilter || employee.stream === streamFilter) &&
    (!departmentFilter || employee.department === departmentFilter) &&
    (!employeeIdFilter || employee.employeeId === employeeIdFilter) &&
    (!employeeNameFilter || employee.name === employeeNameFilter) &&
    (!normalizedSearch || employee.name.toLowerCase().includes(normalizedSearch) || employee.employeeId.toLowerCase().includes(normalizedSearch))
  );
  const handleExport = () => {
    const rows = [
      ["EMPLOYEE ID", "EMPLOYEE NAME", "STREAM", "DEPARTMENT", ...leaveTypes.map((leaveType) => `ELIGIBILITY: ${leaveType.code}`), ...leaveTypes.map((leaveType) => `BALANCE: ${leaveType.code}`)],
      ...visibleEmployees.map((employee) => [
        employee.employeeId,
        employee.name,
        employee.stream,
        employee.department,
        ...leaveTypes.map((leaveType) => getEligibilityValue(employee, leaveType)),
        ...leaveTypes.map((leaveType) => employee.leaveRecords.find((item) => item.leaveTypeId === leaveType.id)?.leaveBalance ?? "N/A"),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "leave-eligibility.csv";
    link.click();
    URL.revokeObjectURL(url);
  };


  useEffect(() => {
    let isMounted = true;

    fetchLeaveEligibility()
      .then((result) => {
        if (isMounted) {
          setEmployees(result.employees);
          setLeaveTypes(result.leaveTypes);
        }
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
      <div className="p-4 min-[801px]:ml-[175px] uppercase">
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
              aria-label="Filter by employee ID"
              value={employeeIdFilter}
              onChange={(event) => setEmployeeIdFilter(event.target.value)}
              className="h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="">All Employee IDs</option>
              {employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.employeeId}</option>)}
            </select>

            <select
              aria-label="Filter by employee name"
              value={employeeNameFilter}
              onChange={(event) => setEmployeeNameFilter(event.target.value)}
              className="h-10 min-w-48 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="">All Employee Names</option>
              {employees.map((employee) => <option key={employee.employeeId} value={employee.name}>{employee.name}</option>)}
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
                    <th rowSpan={2} className="whitespace-nowrap px-5 py-3 font-medium">STREAM</th>
                    <th rowSpan={2} className="whitespace-nowrap px-5 py-3 font-medium">DEPARTMENT</th>
                    <th colSpan={leaveTypeColumnCount} className="px-5 py-3 text-center font-medium bg-green-100/60">LEAVE ELIGIBILITY IN DAYS</th>
                    <th colSpan={leaveTypeColumnCount} className="px-5 py-3 text-center font-medium bg-yellow-100/50">LEAVE BALANCE IN DAYS</th>
                  </tr>
                  <tr>
                    {leaveTypes.length > 0 ? leaveTypes.map((leaveType) => (
                      <th key={`eligibility-${leaveType.id}`} className="whitespace-nowrap px-5 py-3 font-medium bg-green-100/60">
                        {leaveType.code}
                      </th>
                    )) : <th className="px-5 py-3 font-normal text-slate-400">No leave types</th>}
                    {leaveTypes.length > 0 ? leaveTypes.map((leaveType) => (
                      <th key={`balance-${leaveType.id}`} className="whitespace-nowrap px-5 py-3 font-medium bg-yellow-100/50">
                        {leaveType.code}
                      </th>
                    )) : <th className="px-5 py-3 font-normal text-slate-400">No leave types</th>}
                  </tr>
                </thead>
                <tbody>
                  {!isLoading && !error && visibleEmployees.map((employee) => (
                    <tr key={employee.employeeId} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">{employee.employeeId}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">{employee.name}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{employee.stream}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{employee.department}</td>
                      {leaveTypes.map((leaveType) => (
                        <td key={`eligibility-${employee.employeeId}-${leaveType.id}`} className="whitespace-nowrap px-5 py-4 text-slate-700 bg-green-100/60">
                          {getEligibilityValue(employee, leaveType)}
                        </td>
                      ))}
                      {leaveTypes.map((leaveType) => (
                        <td key={`balance-${employee.employeeId}-${leaveType.id}`} className="whitespace-nowrap px-5 py-4 text-slate-500 bg-yellow-100/50">
                          {employee.leaveRecords.find((record) => record.leaveTypeId === leaveType.id)?.leaveBalance ?? "N/A"}
                        </td>
                      ))}
                      {leaveTypes.length === 0 && (
                        <>
                          <td className="px-5 py-4 text-slate-400">N/A</td>
                          <td className="px-5 py-4 text-slate-400">N/A</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {!isLoading && !error && visibleEmployees.length === 0 && (
                    <tr className="border-t border-slate-200">
                      <td colSpan={4 + leaveTypeColumnCount * 2} className="px-5 py-12 text-center text-slate-500">
                        {employees.length === 0 ? "No employee records found in the database." : "No employees match the selected filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}