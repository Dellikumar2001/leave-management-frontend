"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Baby,
  ChevronDown,
  MessageSquare,
  Paperclip,
  Trash2,
  X,
} from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

/* ─── Types ─────────────────────────────────────────────── */

type MaternityEmployee = {
  employeeId: string;
  name: string;
  gender: "Male" | "Female";
  stream: string;
  department: string;
  isEligible: boolean;
  daysAllowed: number;
  leaveBalance: number;
};

type MaternityLeaveType = {
  code: string;
  name: string;
  daysAllowed: number;
  status: "ACTIVE" | "INACTIVE";
};

type SubmittedMaternityRecord = {
  id: string;
  employeeId: string;
  name: string;
  gender: string;
  stream: string;
  department: string;
  daysAllowed: number;
  remarkRequired: "yes" | "no";
  remarkText: string;
  attachmentRequired: "yes" | "no";
  medicalCertRequired: boolean;
  birthCertRequired: boolean;
  status: "Active";
  submittedAt: string;
};

/* ─── Maternity Leave Page ───────────────────────────────── */

export default function MaternityLeavePage() {
  const [employees, setEmployees] = useState<MaternityEmployee[]>([]);
  const [, setLeaveType] = useState<MaternityLeaveType>({
    code: "MLV",
    name: "Maternity Leave",
    daysAllowed: 180,
    status: "ACTIVE",
  });
  const [error, setError] = useState("");

  // ── Filter & Selection states
  const [streamFilter, setStreamFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<MaternityEmployee | null>(null);

  // ── Submitted Records State
  const [submittedRecords, setSubmittedRecords] = useState<SubmittedMaternityRecord[]>([]);

  // ── 1. No of Days State (Default 180 days for Maternity)
  const [numberOfDays, setNumberOfDays] = useState<number | string>(180);

  // ── 2. Remarks States (Radio button + Pop-up Modal)
  const [remarkRequired, setRemarkRequired] = useState<"yes" | "no">("no");
  const [remarkText, setRemarkText] = useState<string>("");
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState<boolean>(false);
  const [tempRemarkText, setTempRemarkText] = useState<string>("");

  // ── 3. Attachment States (Radio button + Pop-up Modal)
  const [attachmentRequired, setAttachmentRequired] = useState<"yes" | "no">("no");
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState<boolean>(false);

  // ── Supporting Documents Toggle States (Inside Attachment Pop-up)
  const [medicalCertRequired, setMedicalCertRequired] = useState<boolean>(true);
  const [birthCertRequired, setBirthCertRequired] = useState<boolean>(true);
  const [tempMedicalCert, setTempMedicalCert] = useState<boolean>(true);
  const [tempBirthCert, setTempBirthCert] = useState<boolean>(true);

  // ── Derived unique departments list
  const allDepartments = useMemo(
    () => [...new Set(employees.map((e) => e.department))].filter(Boolean).sort(),
    [employees],
  );

  // ── Available employees based on Gender (strictly Female), Stream and Department filters
  const availableEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (emp.gender && emp.gender !== "Female") return false;
      if (streamFilter && emp.stream !== streamFilter) return false;
      if (departmentFilter && emp.department !== departmentFilter) return false;
      return true;
    });
  }, [employees, streamFilter, departmentFilter]);

  // ── Load data
  const loadData = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const response = await fetch("/api/maternity-leave", { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error("Unable to load maternity leave data.");
      const empList: MaternityEmployee[] = (result.employees ?? []).filter(
        (e: MaternityEmployee) => !e.gender || e.gender === "Female"
      );
      setEmployees(empList);
      if (result.leaveType) {
        setLeaveType(result.leaveType);
      }
      if (Array.isArray(result.records)) {
        const mappedFromDb: SubmittedMaternityRecord[] = result.records.map((r: {
          id: number | string;
          employeeId: string;
          employeeName: string;
          noOfDays: number;
          remarks: string | null;
          status: string;
          createdAt: string;
        }) => {
          const emp = empList.find((e) => e.employeeId === r.employeeId);
          return {
            id: String(r.id),
            employeeId: r.employeeId,
            name: r.employeeName || emp?.name || r.employeeId,
            gender: "Female",
            stream: emp?.stream || "SFS",
            department: emp?.department || "-",
            daysAllowed: r.noOfDays,
            remarkRequired: r.remarks ? "yes" : "no",
            remarkText: r.remarks || "",
            attachmentRequired: "no",
            medicalCertRequired: false,
            birthCertRequired: false,
            status: "Active",
            submittedAt: r.createdAt ? new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          };
        });
        setSubmittedRecords(mappedFromDb);
        try {
          localStorage.setItem("maternity_submitted_records", JSON.stringify(mappedFromDb));
        } catch {}
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load data.");
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("maternity_submitted_records");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSubmittedRecords(parsed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // ── Remark radio handler
  const handleSelectRemark = (val: "yes" | "no") => {
    if (val === "yes") {
      setTempRemarkText(remarkText || "");
      setIsRemarkModalOpen(true);
    } else {
      setRemarkRequired("no");
    }
  };

  const handleSaveRemarkModal = () => {
    const trimmed = tempRemarkText.trim();
    setRemarkText(trimmed);
    setRemarkRequired("yes");
    setIsRemarkModalOpen(false);
  };

  const handleCloseRemarkModal = () => {
    if (!remarkText) {
      setRemarkRequired("no");
    }
    setIsRemarkModalOpen(false);
  };

  // ── Attachment radio handler
  const handleSelectAttachment = (val: "yes" | "no") => {
    if (val === "yes") {
      setTempMedicalCert(medicalCertRequired);
      setTempBirthCert(birthCertRequired);
      setIsAttachmentModalOpen(true);
    } else {
      setAttachmentRequired("no");
    }
  };

  const handleSaveAttachmentModal = () => {
    setMedicalCertRequired(tempMedicalCert);
    setBirthCertRequired(tempBirthCert);
    setAttachmentRequired("yes");
    setIsAttachmentModalOpen(false);
  };

  const handleCloseAttachmentModal = () => {
    if (!medicalCertRequired && !birthCertRequired) {
      setAttachmentRequired("no");
    }
    setIsAttachmentModalOpen(false);
  };

  // ── Handle employee select
  const handleSelectEmployee = (emp: MaternityEmployee | null) => {
    setSelectedEmployee(emp);
    if (!emp) return;

    const existing = submittedRecords.find((r) => r.employeeId === emp.employeeId);
    if (existing) {
      setNumberOfDays(existing.daysAllowed);
      setRemarkRequired(existing.remarkRequired);
      setRemarkText(existing.remarkText);
      setAttachmentRequired(existing.attachmentRequired);
      setMedicalCertRequired(existing.medicalCertRequired);
      setBirthCertRequired(existing.birthCertRequired);
    } else {
      setNumberOfDays(180);
      setRemarkRequired("no");
      setRemarkText("");
      setAttachmentRequired("no");
      setMedicalCertRequired(true);
      setBirthCertRequired(true);
    }
  };

  // ── Submit configuration
  const handleSubmitConfig = async () => {
    if (!selectedEmployee) {
      setError("Please select an employee before submitting.");
      return;
    }

    if (selectedEmployee.gender && selectedEmployee.gender !== "Female") {
      setError("Maternity leave is strictly applicable to female employees only.");
      return;
    }

    const empToSubmit = selectedEmployee;
    const daysToSubmit = Number(numberOfDays) || 180;
    const remarkToSubmit = remarkRequired === "yes" ? (remarkText || "test") : "";

    const newRecord: SubmittedMaternityRecord = {
      id: empToSubmit.employeeId,
      employeeId: empToSubmit.employeeId,
      name: empToSubmit.name,
      gender: "Female",
      stream: empToSubmit.stream,
      department: empToSubmit.department,
      daysAllowed: daysToSubmit,
      remarkRequired,
      remarkText: remarkToSubmit,
      attachmentRequired,
      medicalCertRequired: attachmentRequired === "yes" && medicalCertRequired,
      birthCertRequired: attachmentRequired === "yes" && birthCertRequired,
      status: "Active",
      submittedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setSubmittedRecords((prev) => {
      const idx = prev.findIndex((r) => r.employeeId === empToSubmit.employeeId);
      const updated = idx >= 0 ? [...prev] : [newRecord, ...prev];
      if (idx >= 0) updated[idx] = newRecord;
      try {
        localStorage.setItem("maternity_submitted_records", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setSelectedEmployee(null);
    setNumberOfDays(180);
    setRemarkRequired("no");
    setRemarkText("");
    setTempRemarkText("");
    setAttachmentRequired("no");
    setMedicalCertRequired(true);
    setBirthCertRequired(true);
    setTempMedicalCert(true);
    setTempBirthCert(true);

    try {
      const res = await fetch("/api/maternity-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: empToSubmit.employeeId,
          employeeName: empToSubmit.name,
          noOfDays: daysToSubmit,
          remarks: remarkToSubmit,
          status: "Active",
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to save record to database.");
      }
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to sync with database.");
    }
  };

  // ── Delete record handler
  const handleDeleteRecord = async (id: string) => {
    const recordToDelete = submittedRecords.find((r) => r.id === id);
    setSubmittedRecords((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem("maternity_submitted_records", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    try {
      const params = new URLSearchParams();
      if (!isNaN(Number(id))) {
        params.set("id", id);
      } else if (recordToDelete?.employeeId) {
        params.set("employeeId", recordToDelete.employeeId);
      }
      await fetch(`/api/maternity-leave?${params.toString()}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete record:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-800">
      <LeaveSidebar activePage="maternity-leave" />

      <div className="p-4 md:p-6 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1280px] space-y-4">

          {/* Card 1: Header Card */}
          <header className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-3.5">
              <span className="grid size-11 place-items-center rounded-xl bg-pink-50 text-pink-600 border border-pink-100/80">
                <Baby size={24} />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Maternity Leave</h1>
                <p className="mt-0.5 text-xs text-slate-500 font-normal">
                  Applicable only for female employees.
                </p>
              </div>
            </div>
          </header>

          {/* Card 2: 3-Dropdown Filter Card */}
          <section
            aria-label="Filters"
            className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Dropdown 1: Stream */}
              <div className="relative">
                <select
                  id="filter-stream"
                  aria-label="Filter stream"
                  value={streamFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStreamFilter(val);
                    if (selectedEmployee && val && selectedEmployee.stream !== val) {
                      const match = employees.find((emp) => emp.stream === val);
                      setSelectedEmployee(match || null);
                    }
                  }}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-pink-500"
                >
                  <option value="">All Streams</option>
                  <option value="SFS">SFS</option>
                  <option value="AIDED">AIDED</option>
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>

              {/* Dropdown 2: Department */}
              <div className="relative">
                <select
                  id="filter-department"
                  aria-label="Filter department"
                  value={departmentFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDepartmentFilter(val);
                    if (selectedEmployee && val && selectedEmployee.department !== val) {
                      const match = employees.find(
                        (emp) =>
                          emp.department === val &&
                          (!streamFilter || emp.stream === streamFilter),
                      );
                      setSelectedEmployee(match || null);
                    }
                  }}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-pink-500"
                >
                  <option value="">All Departments</option>
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>

              {/* Dropdown 3: Employee Name */}
              <div className="relative">
                <select
                  id="filter-employee"
                  aria-label="Filter employee name"
                  value={selectedEmployee?.employeeId || ""}
                  onChange={(e) => {
                    const emp = employees.find((x) => x.employeeId === e.target.value) || null;
                    handleSelectEmployee(emp);
                  }}
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 pr-8 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-pink-500"
                >
                  <option value="">All Employee Names</option>
                  {availableEmployees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </section>

          {/* Feedback messages */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3.5 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {/* Card 3: Configuration Card */}
          <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="rounded-lg bg-[#f8fafc] border border-slate-100 px-4 py-3 text-xs md:text-sm font-semibold text-slate-700">
              {selectedEmployee ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {selectedEmployee.name} - {selectedEmployee.employeeId}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-2.5 py-0.5 text-xs font-semibold text-pink-700 border border-pink-200">
                    <span className="size-1.5 rounded-full bg-pink-600" />
                    Gender: Female
                  </span>
                </div>
              ) : (
                "Select a Female Employee to Configure"
              )}
            </div>

            {/* 3 Boxed Cards Grid */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Box 1: No of Days * */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                <label htmlFor="maternity-no-of-days" className="block text-xs md:text-sm font-bold text-slate-800">
                  No of Days <span className="text-red-500">*</span>
                </label>
                <div className="mt-3">
                  <input
                    id="maternity-no-of-days"
                    type="text"
                    inputMode="numeric"
                    value={numberOfDays}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setNumberOfDays(val);
                    }}
                    onBlur={() => {
                      if (!numberOfDays || Number(numberOfDays) <= 0) {
                        setNumberOfDays(180);
                      }
                    }}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Box 2: Remarks * */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                <span className="block text-xs md:text-sm font-bold text-slate-800">
                  Remarks <span className="text-red-500">*</span>
                </span>
                <div className="mt-3 flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="maternity-remark-radio"
                      value="yes"
                      checked={remarkRequired === "yes"}
                      onChange={() => handleSelectRemark("yes")}
                      className="size-4 text-pink-600 border-slate-300 focus:ring-pink-500"
                    />
                    <span className="text-xs md:text-sm text-slate-700">Yes</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="maternity-remark-radio"
                      value="no"
                      checked={remarkRequired === "no"}
                      onChange={() => handleSelectRemark("no")}
                      className="size-4 text-pink-600 border-slate-300 focus:ring-pink-500"
                    />
                    <span className="text-xs md:text-sm text-slate-700">No</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setTempRemarkText(remarkText || "");
                      setIsRemarkModalOpen(true);
                    }}
                    className="text-xs md:text-sm font-medium text-pink-600 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Box 3: Attachments * */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                <span className="block text-xs md:text-sm font-bold text-slate-800">
                  Attachments <span className="text-red-500">*</span>
                </span>
                <div className="mt-3 flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="maternity-attachment-radio"
                      value="yes"
                      checked={attachmentRequired === "yes"}
                      onChange={() => handleSelectAttachment("yes")}
                      className="size-4 text-pink-600 border-slate-300 focus:ring-pink-500"
                    />
                    <span className="text-xs md:text-sm text-slate-700">Yes</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="maternity-attachment-radio"
                      value="no"
                      checked={attachmentRequired === "no"}
                      onChange={() => handleSelectAttachment("no")}
                      className="size-4 text-pink-600 border-slate-300 focus:ring-pink-500"
                    />
                    <span className="text-xs md:text-sm text-slate-700">No</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setTempMedicalCert(medicalCertRequired);
                      setTempBirthCert(birthCertRequired);
                      setIsAttachmentModalOpen(true);
                    }}
                    className="text-xs md:text-sm font-medium text-pink-600 hover:underline"
                  >
                    Configure
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom-right Submit Button */}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                id="submit-maternity-config-btn"
                onClick={handleSubmitConfig}
                className="rounded-lg bg-[#111827] px-6 py-2 text-xs md:text-sm font-semibold text-white shadow-xs transition-colors hover:bg-slate-800 active:scale-[0.98]"
              >
                Submit
              </button>
            </div>
          </section>

          {/* Card 4: Submitted Records Table Card */}
          <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h2 className="text-sm md:text-base font-bold text-slate-800">
              Submitted Maternity Records
            </h2>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">EMPLOYEE ID</th>
                    <th className="pb-3 px-4 font-semibold">EMPLOYEE NAME</th>
                    <th className="pb-3 px-4 font-semibold">GENDER</th>
                    <th className="pb-3 px-4 font-semibold">DAYS</th>
                    <th className="pb-3 px-4 font-semibold">REMARKS</th>
                    <th className="pb-3 px-4 font-semibold">STATUS</th>
                    <th className="pb-3 pl-4 text-right font-semibold">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {submittedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-xs text-slate-400">
                        No submitted records yet. Select a female employee and click Submit.
                      </td>
                    </tr>
                  ) : (
                    submittedRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pr-4 font-normal text-slate-600">{rec.employeeId}</td>
                        <td className="py-4 px-4 font-bold text-slate-900">{rec.name}</td>
                        <td className="py-4 px-4 font-normal">
                          <span className="inline-block rounded-md bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700 border border-pink-100">
                            {rec.gender || "Female"}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-normal text-slate-600">{rec.daysAllowed} days</td>
                        <td className="py-4 px-4 font-normal text-slate-600">
                          {rec.remarkText || (rec.remarkRequired === "yes" ? "test" : "-")}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-block rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
                            Active
                          </span>
                        </td>
                        <td className="py-4 pl-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(rec.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50/60 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={13} />
                            Inactive &amp; Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>

      {/* ─── 1. Remark Pop-up Modal ─── */}
      {isRemarkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-pink-50 text-pink-600">
                  <MessageSquare size={16} />
                </span>
                <h3 className="text-base font-bold text-slate-900">Configure Remark</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseRemarkModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4">
              <label htmlFor="maternity-remark-text" className="block text-xs font-medium text-slate-600 mb-1.5">
                Remark Text
              </label>
              <textarea
                id="maternity-remark-text"
                rows={4}
                value={tempRemarkText}
                onChange={(e) => setTempRemarkText(e.target.value)}
                placeholder="Enter remarks..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-colors"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseRemarkModal}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs md:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRemarkModal}
                className="rounded-lg bg-pink-600 px-4 py-2 text-xs md:text-sm font-semibold text-white hover:bg-pink-700 transition-colors"
              >
                Save Remark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Attachment Pop-up Modal ─── */}
      {isAttachmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-pink-50 text-pink-600">
                  <Paperclip size={16} />
                </span>
                <h3 className="text-base font-bold text-slate-900">Configure Required Attachments</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseAttachmentModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 hover:bg-slate-50/50 transition-colors cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Medical Certificate</p>
                  <p className="text-xs text-slate-500">Require registered medical practitioner certificate</p>
                </div>
                <input
                  type="checkbox"
                  checked={tempMedicalCert}
                  onChange={(e) => setTempMedicalCert(e.target.checked)}
                  className="size-4.5 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 hover:bg-slate-50/50 transition-colors cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Hospital / Birth Certificate</p>
                  <p className="text-xs text-slate-500">Require official hospital discharge / birth proof</p>
                </div>
                <input
                  type="checkbox"
                  checked={tempBirthCert}
                  onChange={(e) => setTempBirthCert(e.target.checked)}
                  className="size-4.5 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCloseAttachmentModal}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs md:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAttachmentModal}
                className="rounded-lg bg-pink-600 px-4 py-2 text-xs md:text-sm font-semibold text-white hover:bg-pink-700 transition-colors"
              >
                Save Attachments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
