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
  status: string;
  appliedAt: string;
  currentApprovalLevel: number;
  pendingWith: string;
  approvers: { level1: string; level2: string; level3: string; backup: string };
  approvals: { level: number; approver: string; action: string; isBackup: boolean; remarks: string | null }[];
};

const roles: { id: QueueRole; label: string; level: number }[] = [
  { id: "level1", label: "Level 1 Approver", level: 1 },
  { id: "level2", label: "Level 2 Approver", level: 2 },
  { id: "level3", label: "Level 3 Approver", level: 3 },
  { id: "backup", label: "Backup Officer", level: 1 },
];

const roleInfoData: Record<
  QueueRole,
  {
    title: string;
    roleDescription: string;
    howItWorks: string[];
    howToUse: string[];
  }
> = {
  level1: {
    title: "Level 1 Approver",
    roleDescription:
      "First review tier (HOD / Reporting Manager) that verifies department duty coverage and request validity.",
    howItWorks: [
      "New employee leave submissions land directly in this queue first.",
      "Clicking Accept advances request to Level 2. Rejecting terminates the application.",
    ],
    howToUse: [
      "Select 'Needs Approval' tab to see pending requests for your department.",
      "Click 'View' for employee details, then click 'Accept' or 'Reject' with optional remarks.",
    ],
  },
  level2: {
    title: "Level 2 Approver",
    roleDescription:
      "Intermediate review tier (Dean / VP / HR) checking policy compliance and quota rules.",
    howItWorks: [
      "Receives requests only after Level 1 HOD has recommended and approved.",
      "Approval forwards request to Level 3 / Principal. Rejection stops the process.",
    ],
    howToUse: [
      "Switch to 'Level 2 Approver' tab to inspect requests cleared by Level 1.",
      "Review workload balance and click 'Accept' to forward or 'Reject'.",
    ],
  },
  level3: {
    title: "Level 3 Approver",
    roleDescription:
      "Final sanctioning authority (Principal / Director) with supreme executive approving power.",
    howItWorks: [
      "Acts as final step after Level 1 and Level 2 approvals.",
      "Final approval formally sanctions the leave and deducts days from available balance.",
    ],
    howToUse: [
      "Switch to 'Level 3 Approver' tab to view verified submissions.",
      "Click 'Accept' to grant final leave approval or 'Reject' with justification remarks.",
    ],
  },
  backup: {
    title: "Backup Officer",
    roleDescription:
      "Designated proxy officer who steps in when primary approvers (Level 1, 2, or 3) are on leave or absent.",
    howItWorks: [
      "Authorized to act on any pending approval tier when the primary officer is away.",
      "All actions are permanently recorded as taken by the Backup Officer on behalf of the approver.",
    ],
    howToUse: [
      "Click 'Backup Officer' tab to view all requests currently pending across departments.",
      "Click 'Accept' or 'Reject' to clear urgently pending requests without workflow delays.",
    ],
  },
};

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
  const [activeQueueView, setActiveQueueView] = useState<"needs-approval" | "approved-by-me">("needs-approval");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [decisionRequest, setDecisionRequest] = useState<{
    request: ApprovalRequest;
    action: "APPROVED" | "REJECTED";
  } | null>(null);
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoleInfo, setSelectedRoleInfo] = useState<QueueRole | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedRoleInfo) {
        setSelectedRoleInfo(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRoleInfo]);

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
    const assignedApprover = activeRole === "backup"
      ? request.approvers.backup
      : request.approvers[`level${currentRole.level}` as ApprovalLevelKey];
    if (!assignedApprover) return false;

    if (activeQueueView === "approved-by-me") {
      return request.approvals.some((approval) =>
        approval.action.toUpperCase() === "APPROVED" &&
        approval.approver.toLowerCase() === assignedApprover.toLowerCase() &&
        (activeRole === "backup"
          ? approval.isBackup
          : !approval.isBackup && approval.level === currentRole.level)
      );
    }

    return request.status.toLowerCase() === "pending" &&
      (activeRole === "backup" || request.currentApprovalLevel <= currentRole.level);
  }), [activeQueueView, activeRole, currentRole.level, requests]);

  const visibleRequests = useMemo(() => queueRequests.filter((request) => {
    if (leaveTypeFilter !== "all" && request.leaveType !== leaveTypeFilter) return false;
    if (departmentFilter !== "all" && request.department !== departmentFilter) return false;
    if (search && !`${request.employeeId} ${request.employeeName} ${request.department}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [departmentFilter, leaveTypeFilter, queueRequests, search]);

  const leaveTypes = [...new Set(queueRequests.map((request) => request.leaveType))].sort();
  const departments = [...new Set(queueRequests.map((request) => request.department))].sort();
  const actionableCount = activeQueueView === "approved-by-me"
    ? queueRequests.length
    : queueRequests.filter((request) => canActForRole(request, activeRole, currentRole.level)).length;
  const previousLevelCount = queueRequests.filter((request) => !canActForRole(request, activeRole, currentRole.level)).length;
  const pendingWith = (request: ApprovalRequest) => request.status.toLowerCase() === "pending"
    ? `Level ${request.currentApprovalLevel} (${request.pendingWith || "approver not assigned"})`
    : request.status;

  const handleResetFilters = () => {
    setLeaveTypeFilter("all");
    setDepartmentFilter("all");
    setSearch("");
    setActiveQueueView("needs-approval");
  };

  const handleDecision = async (action: "APPROVED" | "REJECTED") => {
    if (!decisionRequest) return;
    const request = decisionRequest.request;
    setSubmitting(true);
    setError("");
    try {
      const actor = activeRole === "backup"
        ? request.approvers.backup
        : request.approvers[`level${currentRole.level}` as ApprovalLevelKey];
      const decisionLevel = activeRole === "backup" ? request.currentApprovalLevel : currentRole.level;
      const response = await fetch("/api/employee-leave-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: request.id,
          level: decisionLevel,
          actor,
          action,
          isBackup: activeRole === "backup",
          remarks,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save decision.");
      setDecisionRequest(null);
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
        <div role="tablist" aria-label="Approver level" className="mt-4 flex gap-1.5 overflow-x-auto">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                activeRole === role.id
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-transparent bg-slate-100/70 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeRole === role.id}
                onClick={() => setActiveRole(role.id)}
                className="cursor-pointer"
              >
                {role.label}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRoleInfo(role.id);
                }}
                className={`inline-flex size-4.5 items-center justify-center rounded-full transition cursor-pointer ${
                  activeRole === role.id
                    ? "bg-violet-700 text-violet-100 hover:bg-violet-800"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-800"
                }`}
                title={`Information about ${role.label}`}
                aria-label={`Information about ${role.label}`}
              >
                <Info size={11} />
              </button>
            </div>
          ))}
        </div>
        <div role="tablist" aria-label="Approval request status" className="mt-3 flex gap-2 border-t border-slate-200 pt-3">
          <button type="button" role="tab" aria-selected={activeQueueView === "needs-approval"} onClick={() => setActiveQueueView("needs-approval")} className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${activeQueueView === "needs-approval" ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Needs Approval</button>
          <button type="button" role="tab" aria-selected={activeQueueView === "approved-by-me"} onClick={() => setActiveQueueView("approved-by-me")} className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${activeQueueView === "approved-by-me" ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Approved by Me</button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className={`grid gap-2 ${activeQueueView === "needs-approval" ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
          <div className="flex items-center gap-3 rounded-md bg-violet-50 px-3 py-2.5 text-violet-900"><Users size={21} /><div><p className="text-[11px]">{activeQueueView === "approved-by-me" ? "Approved by this approver" : "Requests in this queue"}</p><strong className="text-lg leading-5">{queueRequests.length.toString().padStart(2, "0")}</strong></div></div>
          {activeQueueView === "needs-approval" && <>
            <div className="flex items-center gap-3 rounded-md bg-blue-50 px-3 py-2.5 text-blue-900"><Clock3 size={21} /><div><p className="text-[11px]">{activeRole === "backup" ? "Available to backup" : "Ready for this level"}</p><strong className="text-lg leading-5">{actionableCount.toString().padStart(2, "0")}</strong></div></div>
            <div className="flex items-center gap-3 rounded-md bg-amber-50 px-3 py-2.5 text-amber-900"><AlertTriangle size={21} /><div><p className="text-[11px]">Waiting for previous level</p><strong className="text-lg leading-5">{previousLevelCount.toString().padStart(2, "0")}</strong></div></div>
          </>}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-md bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-900">
          <Info size={16} className="mt-0.5 shrink-0" />
          <p>{activeQueueView === "approved-by-me" ? `Showing leave requests approved by ${activeRole === "backup" ? "the backup officer" : currentRole.label}.` : activeRole === "backup" ? "The backup officer can act for any currently pending approval level. A rejection ends the request." : `Approval order: Level 1 → Level 2 → Level 3. ${currentRole.label} can act only after all earlier levels approve; earlier requests stay visible. A rejection ends the request.`}</p>
        </div>
        <div className="my-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <select aria-label="Leave type" value={leaveTypeFilter} onChange={(event) => setLeaveTypeFilter(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"><option value="all">All Leave Types</option>{leaveTypes.map((type) => <option key={type}>{type}</option>)}</select>
          <select aria-label="Department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700"><option value="all">All Departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
          <label className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" /><input aria-label="Search employee" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee..." className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-2.5 text-xs outline-none focus:border-blue-500" /></label>
          <button type="button" onClick={handleResetFilters} className="h-9 rounded-md border border-violet-300 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50">Reset filters</button>
        </div>

        {(error || notice) && <p role={error ? "alert" : "status"} className={`mb-3 rounded-md px-3 py-2 text-xs ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>{error || notice}</p>}

        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-280 w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600">
              <tr>{["Employee ID", "Employee Name", "Department", "Leave Type", "From Date", "To Date", "Duration", "Pending With", "Applied On", "Remarks", "Action"].map((label) => <th key={label} className="border-b border-slate-200 px-3 py-2.5">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">Loading approval requests...</td></tr> : visibleRequests.length === 0 ? <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">{activeQueueView === "approved-by-me" ? "No leave requests have been approved by this approver." : "No requests need approval in this queue."}</td></tr> : visibleRequests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-3 font-mono font-semibold">{request.employeeId}</td>
                  <td className="px-3 py-3 font-medium">{request.employeeName}</td>
                  <td className="px-3 py-3">{request.department}</td>
                  <td className="px-3 py-3"><span className="inline-flex items-center gap-1 rounded border border-violet-600 bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-800  hover:bg-violet-100">{request.leaveType}</span></td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(request.startDate)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(request.endDate)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{request.daysCount} {request.daysCount === 1 ? "Day" : "Days"}</td>
                  <td className="px-3 py-3">{pendingWith(request)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatDate(request.appliedAt)}</td>
                  <td className="max-w-36 truncate px-3 py-3" title={request.reason}>{request.reason || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setSelectedRequest(request)} title="View leave request details" className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-800 hover:bg-blue-100"><Eye size={13} /> View</button>
                      {activeQueueView === "needs-approval" && canActForRole(request, activeRole, currentRole.level) && <>
                        <button type="button" disabled={submitting} onClick={() => { setDecisionRequest({ request, action: "APPROVED" }); setRemarks(""); }} title="Accept leave request" className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"><Check size={13} /> Accept</button>
                        <button type="button" disabled={submitting} onClick={() => { setDecisionRequest({ request, action: "REJECTED" }); setRemarks(""); }} title="Reject leave request" className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"><X size={13} /> Reject</button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pt-3 text-xs text-slate-500">Showing {visibleRequests.length} of {queueRequests.length} requests</div>
      </div>

      {selectedRequest && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRequest(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="approval-detail-title" className="w-full max-w-xl rounded-lg bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 id="approval-detail-title" className="font-bold text-slate-900">Leave request details</h3>
              <p className="mt-0.5 text-xs text-slate-500">{selectedRequest.employeeName} · {selectedRequest.employeeId}</p>
            </div>
            <button type="button" onClick={() => setSelectedRequest(null)} aria-label="Close details" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
          </header>
          <div className="space-y-3 px-5 py-4 text-sm text-slate-700">
            <p><strong>Department:</strong> {selectedRequest.department}</p><p><strong>Leave:</strong> {selectedRequest.leaveType}, {formatDate(selectedRequest.startDate)} to {formatDate(selectedRequest.endDate)} ({selectedRequest.daysCount} days)</p><p><strong>Reason:</strong> {selectedRequest.reason || "No reason provided"}</p><p><strong>Pending with:</strong> {pendingWith(selectedRequest)}</p>
            {selectedRequest.approvals.length > 0 && <div className="rounded bg-slate-50 p-3 text-xs"><strong>Approval history</strong>{selectedRequest.approvals.map((approval) => <p key={approval.level} className="mt-1">Level {approval.level}: {approval.action.toLowerCase()} by {approval.approver}{approval.isBackup ? " (backup officer)" : ""}{approval.remarks ? ` · ${approval.remarks}` : ""}</p>)}</div>}
          </div>
        </section>
      </div>}

      {decisionRequest && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setDecisionRequest(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="approval-decision-title" className="w-full max-w-lg rounded-lg bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h3 id="approval-decision-title" className="font-bold text-slate-900">{decisionRequest.action === "APPROVED" ? "Accept leave request?" : "Reject leave request?"}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{decisionRequest.request.employeeName} · {decisionRequest.request.employeeId}</p>
            </div>
            <button type="button" onClick={() => setDecisionRequest(null)} aria-label="Close decision" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
          </header>
          <div className="space-y-4 px-5 py-4 text-sm text-slate-700">
            <p>{decisionRequest.action === "APPROVED" ? "This will record your approval and move the request to the next approval level." : "This will reject the leave request and end its approval process."}</p>
            <p className="text-xs text-slate-500">{decisionRequest.request.leaveType}, {formatDate(decisionRequest.request.startDate)} to {formatDate(decisionRequest.request.endDate)} ({decisionRequest.request.daysCount} days)</p>
            <label className="block text-xs font-semibold text-slate-600">Remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm font-normal outline-none focus:border-blue-500" /></label>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={() => setDecisionRequest(null)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" disabled={submitting} onClick={() => void handleDecision(decisionRequest.action)} className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${decisionRequest.action === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}>
                {submitting ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : decisionRequest.action === "APPROVED" ? <Check size={14} /> : <X size={14} />}
                {decisionRequest.action === "APPROVED" ? "Accept" : "Reject"}
              </button>
            </div>
          </div>
        </section>
      </div>}

      {/* Information Modal for clicked Approver Role */}
      {selectedRoleInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-[2px] normal-case"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedRoleInfo(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-info-title"
            className="relative my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-xs">
                  <Info size={16} />
                </div>
                <div>
                  <h2 id="role-info-title" className="text-base font-bold text-slate-900 leading-tight">
                    {roleInfoData[selectedRoleInfo].title}
                  </h2>
                  <p className="text-[11px] text-slate-500">Approver role authority, responsibilities, and workflow tier</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoleInfo(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-3 text-xs text-slate-700 leading-relaxed">
              {/* 1. What it is */}
              <div className="rounded-xl bg-violet-50/60 border border-violet-100 p-3">
                <span className="font-semibold text-violet-950">Role Overview</span>
                <p className="mt-0.5 text-violet-900/90 text-[11px] leading-relaxed">
                  {roleInfoData[selectedRoleInfo].roleDescription}
                </p>
              </div>

              {/* 2. How it works & How to use it */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">How it works</span>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                    {roleInfoData[selectedRoleInfo].howItWorks.map((point, index) => (
                      <li key={index} className="flex items-start gap-1.5">
                        <span className="text-violet-600 font-bold">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                  <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">How to use it</span>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                    {roleInfoData[selectedRoleInfo].howToUse.map((point, index) => (
                      <li key={index} className="flex items-start gap-1.5">
                        <span className="text-violet-600 font-bold">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRoleInfo(null)}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}