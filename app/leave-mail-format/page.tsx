"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Save,
  Send,
  Ban,
  CheckCircle2,
  XCircle,
  User,
  ShieldCheck,
  Copy,
  Eye,
  Check,
} from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type RoleType = "employee" | "approver";
type TemplateKey = `${RoleType}_${string}`;

type MailTemplateData = {
  id: string;
  role: RoleType;
  type: string;
  title: string;
  triggerDescription: string;
  recipientDescription: string;
  subject: string;
  body: string;
  isActive: boolean;
};

const initialTemplates: Record<string, MailTemplateData> = {
  "employee_applied": {
    id: "employee_applied",
    role: "employee",
    type: "applied",
    title: "Employee - Leave Applied Format",
    triggerDescription: "Triggered when an employee submits a new leave request.",
    recipientDescription: "Reporting Manager / Approver (cc: Employee)",
    subject: "Leave Application Submitted: {employee_name} ({leave_type})",
    body: `Dear {manager_name},

{employee_name} ({employee_id}) from {department} has submitted a new leave application.

Leave Details:
- Leave Type: {leave_type}
- Duration: {from_date} to {to_date} ({total_days} day(s))
- Reason: {reason}
- Current Leave Balance: {balance_days} day(s)

Please review and take action by logging into the Leave Management Portal.

Portal Link: {portal_url}

Thank you,
Leave Flow System`,
    isActive: true,
  },
  "employee_cancelled": {
    id: "employee_cancelled",
    role: "employee",
    type: "cancelled",
    title: "Employee - Leave Cancel Format",
    triggerDescription: "Triggered when an employee cancels a leave application.",
    recipientDescription: "Reporting Manager / Approver & HR Department",
    subject: "Leave Cancellation Notice: {employee_name} ({leave_type})",
    body: `Dear {manager_name},

Please note that {employee_name} ({employee_id}) has CANCELLED their leave request.

Cancelled Leave Details:
- Leave Type: {leave_type}
- Dates: {from_date} to {to_date} ({total_days} day(s))
- Cancellation Reason: {cancellation_reason}

The employee's leave balance has been automatically credited back.
Updated Balance: {balance_days} day(s)

Thank you,
Leave Flow System`,
    isActive: true,
  },
  "approver_approved": {
    id: "approver_approved",
    role: "approver",
    type: "approved",
    title: "Approver - Leave Approve Format",
    triggerDescription: "Triggered when a manager or approver approves a leave request.",
    recipientDescription: "Applicant Employee (cc: Manager & HR)",
    subject: "Leave Request Approved - {leave_type}",
    body: `Dear {employee_name},

Your leave application has been APPROVED by {manager_name}.

Approved Details:
- Leave Type: {leave_type}
- From Date: {from_date}
- To Date: {to_date}
- Total Duration: {total_days} working day(s)
- Remaining Balance: {balance_days} day(s)
- Approver Comments: {approver_notes}

Please ensure handovers and emergency contacts are updated accordingly.

Best regards,
{manager_name} / HR Operations`,
    isActive: true,
  },
  "approver_rejected": {
    id: "approver_rejected",
    role: "approver",
    type: "rejected",
    title: "Approver - Leave Reject Format",
    triggerDescription: "Triggered when a manager or approver rejects a leave request.",
    recipientDescription: "Applicant Employee",
    subject: "Leave Request Update: Not Approved - {leave_type}",
    body: `Dear {employee_name},

We regret to inform you that your leave request for {leave_type} ({from_date} to {to_date}) could not be approved at this time.

Reason for Decision:
{rejection_reason}

If you would like to discuss this or propose alternative dates, please speak directly with your reporting manager {manager_name}.

Regards,
Leave Management Team`,
    isActive: true,
  },
};

const placeholders = [
  { tag: "{employee_name}", desc: "Employee's full name" },
  { tag: "{employee_id}", desc: "Employee code" },
  { tag: "{department}", desc: "Department name" },
  { tag: "{manager_name}", desc: "Reporting manager's name" },
  { tag: "{leave_type}", desc: "Leave type (Casual, Sick, etc.)" },
  { tag: "{from_date}", desc: "Start date (DD/MM/YYYY)" },
  { tag: "{to_date}", desc: "End date (DD/MM/YYYY)" },
  { tag: "{total_days}", desc: "Total leave days requested" },
  { tag: "{balance_days}", desc: "Remaining leave balance" },
  { tag: "{reason}", desc: "Employee reason for leave" },
  { tag: "{approver_notes}", desc: "Approver remarks/comments" },
  { tag: "{rejection_reason}", desc: "Rejection explanation" },
  { tag: "{cancellation_reason}", desc: "Employee cancellation note" },
  { tag: "{portal_url}", desc: "Direct portal link" },
];

function LeaveMailFormatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlRole = searchParams.get("role");
  const urlType = searchParams.get("type");

  const [activeRole, setActiveRole] = useState<RoleType>(
    urlRole === "approver" ? "approver" : "employee"
  );

  const [activeType, setActiveType] = useState<string>(() => {
    if (urlRole === "approver") {
      return urlType === "rejected" ? "rejected" : "approved";
    }
    return urlType === "cancelled" ? "cancelled" : "applied";
  });

  const [templates, setTemplates] = useState(initialTemplates);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Sync state when URL search params change
  useEffect(() => {
    if (urlRole === "approver") {
      setActiveRole("approver");
      setActiveType(urlType === "rejected" ? "rejected" : "approved");
    } else if (urlRole === "employee") {
      setActiveRole("employee");
      setActiveType(urlType === "cancelled" ? "cancelled" : "applied");
    }
  }, [urlRole, urlType]);

  const handleSelectTab = (role: RoleType, type: string) => {
    setActiveRole(role);
    setActiveType(type);
    setSaved(false);
    router.push(`/leave-mail-format?role=${role}&type=${type}`);
  };

  const handleRoleChange = (newRole: RoleType) => {
    const newType = newRole === "employee" ? "applied" : "approved";
    handleSelectTab(newRole, newType);
  };

  const currentKey: TemplateKey = `${activeRole}_${activeType}` as TemplateKey;
  const currentTemplate = templates[currentKey] || initialTemplates["employee_applied"];

  const handleFieldChange = (field: keyof MailTemplateData, value: any) => {
    setTemplates((prev) => ({
      ...prev,
      [currentKey]: {
        ...prev[currentKey],
        [field]: value,
      },
    }));
    setSaved(false);
  };

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const getRenderedPreview = (text: string) => {
    return text
      .replace(/{employee_name}/g, "John Doe")
      .replace(/{employee_id}/g, "EMP-1042")
      .replace(/{department}/g, "Software Engineering")
      .replace(/{manager_name}/g, "Sarah Connor")
      .replace(/{leave_type}/g, "Casual Leave")
      .replace(/{from_date}/g, "24/10/2026")
      .replace(/{to_date}/g, "25/10/2026")
      .replace(/{total_days}/g, "2")
      .replace(/{balance_days}/g, "8.5")
      .replace(/{reason}/g, "Personal urgent work at home")
      .replace(/{approver_notes}/g, "Approved, please ensure task handover.")
      .replace(/{rejection_reason}/g, "Critical project release scheduled for these dates")
      .replace(/{cancellation_reason}/g, "Plans changed, returning to work")
      .replace(/{portal_url}/g, "https://leave.company.internal/approvals/1042");
  };

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="leave-mail-format" />

      <main className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px] space-y-4">
          {/* Header */}
          <header className="rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                  <Mail className="size-6 text-emerald-700" />
                  Leave Mail Format
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Configure automated email formats triggered during leave applications and approvals.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold shadow-xs transition ${previewMode
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  <Eye size={15} />
                  {previewMode ? "Exit Preview" : "Preview Email"}
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                >
                  {saved ? (
                    <>
                      <Check size={16} /> Saved!
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Format
                    </>
                  )}
                </button>
              </div>
            </div>
          </header>

          {/* Main Role Selector Bar (Employee vs Approver) */}
          <section
            aria-label="Role selection"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Category:
              </span>
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => handleRoleChange("employee")}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold transition ${activeRole === "employee"
                      ? "bg-white text-emerald-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <User size={15} className={activeRole === "employee" ? "text-emerald-700" : "text-slate-400"} />
                  Employee
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange("approver")}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold transition ${activeRole === "approver"
                      ? "bg-white text-emerald-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <ShieldCheck size={15} className={activeRole === "approver" ? "text-emerald-700" : "text-slate-400"} />
                  Approver
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Editing: <strong className="capitalize text-emerald-800">{activeRole}</strong> &rarr; <strong className="capitalize text-emerald-800">{activeType === "cancelled" ? "Cancel" : activeType}</strong>
            </div>
          </section>

          {/* 3-Column Grid View */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* 1st Column: Event Subtabs (Vertical) */}
            <div className="lg:col-span-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Event Subtabs
                  </h2>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold capitalize text-emerald-700 border border-emerald-200">
                    {activeRole}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {activeRole === "employee" ? (
                    <>
                      {/* Employee Applied Subtab */}
                      <button
                        type="button"
                        onClick={() => handleSelectTab("employee", "applied")}
                        className={`w-full text-left rounded-lg p-3 transition border ${activeType === "applied"
                            ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Send
                              size={15}
                              className={
                                activeType === "applied" ? "text-emerald-700" : "text-slate-500"
                              }
                            />
                            Applied
                          </span>
                          <span
                            className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${activeType === "applied"
                                ? "bg-emerald-200 text-emerald-900 font-bold"
                                : "bg-slate-100 text-slate-500"
                              }`}
                          >
                            On Submit
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                          Sent when an employee submits a new leave request.
                        </p>
                      </button>

                      {/* Employee Cancel Subtab */}
                      <button
                        type="button"
                        onClick={() => handleSelectTab("employee", "cancelled")}
                        className={`w-full text-left rounded-lg p-3 transition border ${activeType === "cancelled"
                            ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Ban
                              size={15}
                              className={
                                activeType === "cancelled" ? "text-amber-600" : "text-slate-500"
                              }
                            />
                            Cancel
                          </span>
                          <span
                            className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${activeType === "cancelled"
                                ? "bg-amber-100 text-amber-900 font-bold"
                                : "bg-slate-100 text-slate-500"
                              }`}
                          >
                            On Cancel
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                          Sent when an employee cancels a leave application.
                        </p>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Approver Approve Subtab */}
                      <button
                        type="button"
                        onClick={() => handleSelectTab("approver", "approved")}
                        className={`w-full text-left rounded-lg p-3 transition border ${activeType === "approved"
                            ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <CheckCircle2
                              size={15}
                              className={
                                activeType === "approved" ? "text-emerald-700" : "text-slate-500"
                              }
                            />
                            Approve
                          </span>
                          <span
                            className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${activeType === "approved"
                                ? "bg-emerald-200 text-emerald-900 font-bold"
                                : "bg-slate-100 text-slate-500"
                              }`}
                          >
                            On Approve
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                          Sent when a manager approves an employee's leave request.
                        </p>
                      </button>

                      {/* Approver Reject Subtab */}
                      <button
                        type="button"
                        onClick={() => handleSelectTab("approver", "rejected")}
                        className={`w-full text-left rounded-lg p-3 transition border ${activeType === "rejected"
                            ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <XCircle
                              size={15}
                              className={
                                activeType === "rejected" ? "text-red-600" : "text-slate-500"
                              }
                            />
                            Reject
                          </span>
                          <span
                            className={`text-[10.5px] px-2 py-0.5 rounded-full font-medium ${activeType === "rejected"
                                ? "bg-red-100 text-red-900 font-bold"
                                : "bg-slate-100 text-slate-500"
                              }`}
                          >
                            On Reject
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                          Sent when a manager rejects an employee's leave request.
                        </p>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2nd Column: Template Editor */}
            <div className="lg:col-span-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      {currentTemplate.title}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {currentTemplate.triggerDescription}
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={currentTemplate.isActive}
                      onChange={(e) => handleFieldChange("isActive", e.target.checked)}
                      className="size-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    Enable template
                  </label>
                </div>

                {previewMode ? (
                  /* Rendered Email Preview */
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="text-xs text-slate-500 flex items-center justify-between border-b border-slate-200 pb-2">
                      <span>
                        <strong>Recipient:</strong> {currentTemplate.recipientDescription}
                      </span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                        Live Mock Preview
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400">
                        Subject Line
                      </div>
                      <div className="text-sm font-bold text-slate-800 mt-0.5">
                        {getRenderedPreview(currentTemplate.subject)}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <div className="text-xs font-semibold uppercase text-slate-400 mb-1">
                        Body Content
                      </div>
                      <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 bg-white p-4 rounded-md border border-slate-200 shadow-2xs">
                        {getRenderedPreview(currentTemplate.body)}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Edit Mode */
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                          Subject Line
                        </label>
                        <span className="text-[11px] text-slate-400">
                          To: {currentTemplate.recipientDescription}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={currentTemplate.subject}
                        onChange={(e) => handleFieldChange("subject", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans"
                        placeholder="Enter email subject line..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                        Mail Body Format
                      </label>
                      <textarea
                        rows={13}
                        value={currentTemplate.body}
                        onChange={(e) => handleFieldChange("body", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        placeholder="Compose email template body..."
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Changes apply to future automated notifications</span>
                  <span>Use curly braces (e.g. &#123;employee_name&#125;) for dynamic values</span>
                </div>
              </div>
            </div>

            {/* 3rd Column: Template Placeholders */}
            <div className="lg:col-span-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Template Placeholders
                  </h3>
                  {copiedTag && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                      Copied!
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  Click any variable to copy to clipboard and paste into subject or body:
                </p>

                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {placeholders.map(({ tag, desc }) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleCopyTag(tag)}
                      className="group flex w-full items-center justify-between rounded-md border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition"
                    >
                      <div>
                        <div className="font-mono text-xs font-semibold text-slate-800 group-hover:text-emerald-800">
                          {tag}
                        </div>
                        <div className="text-[11px] text-slate-500">{desc}</div>
                      </div>
                      <Copy
                        size={12}
                        className="text-slate-400 group-hover:text-emerald-700 shrink-0"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LeaveMailFormatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#e9edf3]">
          <div className="text-sm font-semibold text-slate-600">Loading Mail Format...</div>
        </div>
      }
    >
      <LeaveMailFormatContent />
    </Suspense>
  );
}
