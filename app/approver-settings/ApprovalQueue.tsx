"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock3, Eye, Info, Search, Users, X } from "lucide-react";

type QueueRole = "level1" | "level2" | "level3" | "backup";
type ApprovalLevelKey = "level1" | "level2" | "level3";

type ApprovalRequest = {
  id: number;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  appliedAt: string;
  currentApprovalLevel: number;
  pendingWith: string;
  approvers: { level1: string; level2: string; level3: string; backup: string };
  approvals: { level: number; approver: string; action: string; isBackup: boolean; remarks: string | null }[];
};

const roles: { id: QueueRole; label: string; subtitle: string; level: number }[] = [
  { id: "level1", label: "Level 1 Approver", subtitle: "HOD", level: 1 },
  { id: "level2", label: "Level 2 Approver", subtitle: "Vice Principal", level: 2 },
  { id: "level3", label: "Level 3 Approver", subtitle: "Principal", level: 3 },
  { id: "backup", label: "Backup Officer", subtitle: "Dean / Leave In-charge", level: 1 },
];

function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function canActForRole(request: ApprovalRequest, role: QueueRole, level: number) {
  return role === "backup" ? request.currentApprovalLevel >= 1 && request.currentApprovalLevel <= 3 : request.currentApprovalLevel === level;
}

export default function ApprovalQueue() {
  const [activeRole, setActiveRole] = useState<QueueRole>("level1");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/employee-leave-approvals", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load leave requests.");
      setRequests(data.requests || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/employee-leave-approvals", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load leave requests.");
        if (active) setRequests(data.requests || []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load leave requests.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentRole = roles.find((role) => role.id === activeRole)!;
  const queueRequests = useMemo(() => requests.filter((request) => {
    if (activeRole === "backup") return Boolean(request.approvers.backup);
    const approver = request.approvers[`level${currentRole.level}` as ApprovalLevelKey];
    return request.currentApprovalLevel <= currentRole.level && Boolean(approver);
  }), [activeRole, currentRole.level, requests]);

  const visibleRequests = useMemo(() => queueRequests.filter((request) => {
    if (leaveTypeFilter !== "all" && request.leaveType !== leaveTypeFilter) return false;
    if (departmentFilter !== "all" && request.department !== departmentFilter) return false;
    if (activeRole !== "backup" && statusFilter === "actionable" && request.currentApprovalLevel !== currentRole.level) return false;
    if (activeRole !== "backup" && statusFilter === "previous" && request.currentApprovalLevel >= currentRole.level) return false;
    if (search && !`${request.employeeId} ${request.employeeName} ${request.department}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [activeRole, currentRole.level, departmentFilter, leaveTypeFilter, queueRequests, search, statusFilter]);

  const leaveTypes = [...new Set(queueRequests.map((request) => request.leaveType))].sort();
  const departments = [...new Set(queueRequests.map((request) => request.department))].sort();
  const actionableCount = activeRole === "backup"
    ? queueRequests.length
    : queueRequests.filter((request) => request.currentApprovalLevel === currentRole.level).length;
  const previousLevelCount = activeRole === "backup"
    ? queueRequests.filter((request) => request.currentApprovalLevel > 1).length
    : queueRequests.filter((request) => request.currentApprovalLevel < currentRole.level).length;
  const pendingWith = (request: ApprovalRequest) => `Level ${request.currentApprovalLevel} (${request.pendingWith || "approver not assigned"})`;

  const handleDecision = async (action: "APPROVED" | "REJECTED") => {
    if (!selectedRequest) return;
    setSubmitting(true);
    setError("");
    try {
      const actor = activeRole === "backup"
        ? selectedRequest.approvers.backup
        : selectedRequest.approvers[`level${currentRole.level}` as ApprovalLevelKey];
      const decisionLevel = activeRole === "backup" ? selectedRequest.currentApprovalLevel : currentRole.level;
      const response = await fetch("/api/employee-leave-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedRequest.id,
          level: decisionLevel,
          actor,
          action,
          isBackup: activeRole === "backup",
          remarks,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save decision.");
      setSelectedRequest(null);
      setRemarks("");
      setNotice(action === "APPROVED" ? "Approval recorded. The request moved to the next level." : "Request rejected.");
      await loadRequests();
      window.setTimeout(() => setNotice(""), 4000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save decision.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label="Leave approval queues" className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[#f5f7fa] px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Leave Approve/Reject</h2>
            <p className="mt-0.5 text-sm text-slate-500">Review requests in their assigned approval order.</p>
          </div>
          <button type="button" onClick={() => void loadRequests()} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
        </div>
        <div role="tablist" aria-label="Approver level" className="mt-4 flex gap-1 overflow-x-auto">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={activeRole === role.id}
              onClick={() => setActiveRole(role.id)}
              className={`min-w-max border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition-colors ${activeRole === role.id ? "border-violet-600 bg-violet-600 text-white" : "border-transparent text-slate-600 hover:bg-slate-100"}`}
            >
              {role.label}<span className={`ml-1.5 ${activeRole === role.id ? "text-violet-100" : "text-slate-400"}`}>· {role.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-md bg-violet-50 px-3 py-2.5 text-violet-900"><Users size={21} /><div><p className="text-[11px]">Requests in this queue</p><strong className="text-lg leading-5">{queueRequests.length.toString().padStart(2, "0")}</strong></div></div>
          <div className="flex items-center gap-3 rounded-md bg-blue-50 px-3 py-2.5 text-blue-900"><Clock3 size={21} /><div><p className="text-[11px]">{activeRole === "backup" ? "Available to backup" : "Ready for this level"}</p><strong className="text-lg leading-5">{actionableCount.toString().padStart(2, "0")}</strong></div></div>
          <div className="flex items-center gap-3 rounded-md bg-amber-50 px-3 py-2.5 text-amber-900"><AlertTriangle size={21} /><div><p className="text-[11px]">{activeRole === "backup" ? "Level 2/3 requests" : "Waiting for previous level"}</p><strong className="text-lg leading-5">{previousLevelCount.toString().padStart(2, "0")}</strong></div></div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>{activeRole === "backup" ? "Approval order: HOD (Level 1) → Vice Principal (Level 2) → Principal (Level 3). The backup officer may substitute for the HOD; the request keeps its Level 1 pending label and the decision is recorded as a backup action. A rejection ends the request." : `Approval order: HOD (Level 1) → Vice Principal (Level 2) → Principal (Level 3). ${currentRole.label} can act only after all earlier levels approve; earlier requests stay visible but locked. A rejection ends the request.`}</p>
        </div>

        <div className="my-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <select aria-label="Leave type" value={leaveTypeFilter} onChange={(event) => setLeaveTypeFilter(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"><option value="all">All Leave Types</option>{leaveTypes.map((type) => <option key={type}>{type}</option>)}</select>
          <select aria-label="Department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"><option value="all">All Departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
          <select aria-label="Approval status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"><option value="all">All Queue Statuses</option><option value="actionable">Ready for this level</option><option value="previous">Pending with previous level</option></select>
          <label className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" /><input aria-label="Search employee" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee..." className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-2.5 text-xs outline-none focus:border-blue-500" /></label>
          <button type="button" onClick={() => { setLeaveTypeFilter("all"); setDepartmentFilter("all"); setStatusFilter("all"); setSearch(""); }} className="h-9 rounded-md border border-violet-300 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50">Reset filters</button>
        </div>

        {(error || notice) && <p role={error ? "alert" : "status"} className={`mb-3 rounded-md px-3 py-2 text-xs ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>{error || notice}</p>}

        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-280 w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
              <tr>{["Employee ID", "Employee Name", "Department", "Leave Type", "From Date", "To Date", "Duration", "Current Approval Level", "Pending With", "Applied On", "Remarks", "View Details"].map((label) => <th key={label} className="border-b border-slate-200 px-3 py-2.5">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">Loading approval requests...</td></tr> : visibleRequests.length === 0 ? <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400">No requests found for this queue.</td></tr> : visibleRequests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3 font-mono font-semibold">{request.employeeId}</td>
                  <td className="px-3 py-3 font-medium">{request.employeeName}</td>
                  <td className="px-3 py-3">{request.department}</td>
                  <td className="px-3 py-3"><span className="rounded bg-violet-50 px-2 py-1 font-semibold text-violet-800">{request.leaveType}</span></td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(request.startDate)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(request.endDate)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{request.daysCount} {request.daysCount === 1 ? "Day" : "Days"}</td>
                  <td className="whitespace-nowrap px-3 py-3">Level {request.currentApprovalLevel}</td>
                  <td className="px-3 py-3">{pendingWith(request)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(request.appliedAt)}</td>
                  <td className="max-w-36 truncate px-3 py-3" title={request.reason}>{request.reason || "—"}</td>
                  <td className="px-3 py-3"><button type="button" onClick={() => { setSelectedRequest(request); setRemarks(""); }} className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-800 hover:bg-blue-100"><Eye size={13} /> View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pt-3 text-xs text-slate-500">Showing {visibleRequests.length} of {queueRequests.length} requests</div>
      </div>

      {selectedRequest && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRequest(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="approval-detail-title" className="w-full max-w-xl rounded-lg bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 id="approval-detail-title" className="font-bold text-slate-900">Leave request details</h3><p className="mt-0.5 text-xs text-slate-500">{selectedRequest.employeeName} · {selectedRequest.employeeId}</p></div><button type="button" onClick={() => setSelectedRequest(null)} aria-label="Close details" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header>
          <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
            <p><strong>Department:</strong> {selectedRequest.department}</p><p><strong>Leave:</strong> {selectedRequest.leaveType}, {formatDate(selectedRequest.startDate)} to {formatDate(selectedRequest.endDate)} ({selectedRequest.daysCount} days)</p><p><strong>Reason:</strong> {selectedRequest.reason || "No reason provided"}</p><p><strong>Pending with:</strong> {pendingWith(selectedRequest)}</p>
            {selectedRequest.approvals.length > 0 && <div className="rounded bg-slate-50 p-3 text-xs"><strong>Approval history</strong>{selectedRequest.approvals.map((approval) => <p key={approval.level} className="mt-1">Level {approval.level}: {approval.action.toLowerCase()} by {approval.approver}{approval.isBackup ? " (backup officer)" : ""}{approval.remarks ? ` · ${approval.remarks}` : ""}</p>)}</div>}
            {canActForRole(selectedRequest, activeRole, currentRole.level) ? <><label className="block text-xs font-semibold text-slate-600">Remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm font-normal outline-none focus:border-blue-500" /></label><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">Decision by {activeRole === "backup" ? selectedRequest.approvers.backup : selectedRequest.approvers[`level${currentRole.level}` as ApprovalLevelKey]}</span><div className="flex gap-2"><button type="button" disabled={submitting} onClick={() => void handleDecision("REJECTED")} className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"><X size={14} /> Reject</button><button type="button" disabled={submitting} onClick={() => void handleDecision("APPROVED")} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Check size={14} /> Approve</button></div></div></> : <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Action disabled: this request must be approved by {pendingWith(selectedRequest)} first.</p>}
          </div>
        </section>
      </div>}
    </section>
  );
}