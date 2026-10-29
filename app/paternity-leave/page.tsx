"use client";

import { useEffect, useRef, useState } from "react";
import { Baby, ChevronDown, Info, Paperclip, Trash2, X } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type Employee = {
  employeeId: string;
  name: string;
  stream: string;
  department: string;
  employeeType?: string;
  gender?: string;
};

type SupportingDocumentRule = {
  id: string;
  name: string;
  required: boolean;
};

type PaternityRecord = {
  employeeId: string;
  employeeName: string;
  noOfDays: number;
  remarks: string;
  status: "Active" | "Inactive";
};

const FEMALE_NAMES = ["diya", "kavya", "sneha", "ananya", "priya", "pooja", "meera"];

function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  disabled = false,
}: {
  label: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayLabel = disabled
    ? `Select ${label}`
    : selectedValues.length === 0
    ? `Select ${label}`
    : selectedValues.length === 1
    ? selectedValues[0]
    : `${selectedValues.length} ${label} selected`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3.5 text-sm transition-colors ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
            : isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 text-slate-800"
            : "border-slate-300 text-slate-600 hover:border-slate-400"
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-full min-w-[200px] rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              placeholder="Filter list..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none border border-slate-200 placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-52 overflow-y-auto p-1.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option)}
                    onChange={(e) => {
                      onChange(
                        e.target.checked
                          ? [...selectedValues, option]
                          : selectedValues.filter((v) => v !== option)
                      );
                    }}
                    className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-0"
                  />
                  <span className="truncate uppercase">{option}</span>
                </label>
              ))
            ) : (
              <p className="py-3 text-center text-xs text-slate-400">No options found</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() => onChange(Array.from(new Set([...selectedValues, ...filteredOptions])))}
              className="text-emerald-700 hover:text-emerald-800 font-medium"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
        checked ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function PaternityLeavePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState("");
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showInfoModal) setShowInfoModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfoModal]);

  const [streamFilters, setStreamFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  const [employeeTypeFilters, setEmployeeTypeFilters] = useState<string[]>([]);
  const [employeeNameFilters, setEmployeeNameFilters] = useState<string[]>([]);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [days, setDays] = useState("");
  const [hasRemarks, setHasRemarks] = useState<boolean | null>(null);
  const [remarksText, setRemarksText] = useState("");
  const [hasAttachments, setHasAttachments] = useState<boolean | null>(null);

  const [documentConfigs, setDocumentConfigs] = useState<SupportingDocumentRule[]>([
    {
      id: "medical-cert",
      name: "Medical Certificate (Expected Delivery Date)",
      required: true,
    },
    {
      id: "birth-cert",
      name: "Birth Certificate / Proof (after delivery)",
      required: true,
    },
  ]);

  const [activeDialog, setActiveDialog] = useState<"remarks" | "attachments" | null>(null);
  const [submittedRecords, setSubmittedRecords] = useState<PaternityRecord[]>([]);

  const maleEmployees = employees.filter((emp) => {
    if (emp.gender) {
      return emp.gender.toLowerCase() === "male" || emp.gender.toLowerCase() === "m";
    }
    return !FEMALE_NAMES.some((fn) => emp.name.toLowerCase().includes(fn));
  });

  // Step 1: All available streams for male employees
  const streams = [...new Set(maleEmployees.map((e) => e.stream))].filter(Boolean).sort();

  // Step 2: Departments only unlocked and computed after Stream is selected
  const isDepartmentDisabled = streamFilters.length === 0;
  const departments = isDepartmentDisabled
    ? []
    : [
        ...new Set(
          maleEmployees
            .filter((e) => streamFilters.includes(e.stream))
            .map((e) => e.department)
        ),
      ].filter(Boolean).sort();

  // Step 3: Employee Types only unlocked after Department is selected
  const isEmployeeTypeDisabled = isDepartmentDisabled || departmentFilters.length === 0;
  const employeeTypes = isEmployeeTypeDisabled
    ? []
    : [
        ...new Set(
          maleEmployees
            .filter((e) => streamFilters.includes(e.stream) && departmentFilters.includes(e.department))
            .map((e) => e.employeeType)
        ),
      ].filter(Boolean) as string[];
  const employeeTypeOptions = isEmployeeTypeDisabled
    ? []
    : Array.from(new Set(["Teaching", "Non-Teaching", ...employeeTypes])).sort();

  // Step 4: Employees only unlocked and computed after Employee Type is selected
  const isEmployeeDisabled = isEmployeeTypeDisabled || employeeTypeFilters.length === 0;
  const availableEmployees = isEmployeeDisabled
    ? []
    : maleEmployees.filter(
        (e) =>
          streamFilters.includes(e.stream) &&
          departmentFilters.includes(e.department) &&
          employeeTypeFilters.includes(e.employeeType || "Teaching")
      );

  const employeeNames = [...new Set(availableEmployees.map((e) => e.name))].filter(Boolean).sort();

  const handleStreamChange = (newStreams: string[]) => {
    setStreamFilters(newStreams);
    // Reset downstream selections when stream changes or is cleared
    setDepartmentFilters([]);
    setEmployeeTypeFilters([]);
    setEmployeeNameFilters([]);
    setSelectedEmployee(null);
  };

  const handleDepartmentChange = (newDepts: string[]) => {
    setDepartmentFilters(newDepts);
    // Reset downstream selections when department changes or is cleared
    setEmployeeTypeFilters([]);
    setEmployeeNameFilters([]);
    setSelectedEmployee(null);
  };

  const handleEmployeeTypeChange = (newTypes: string[]) => {
    setEmployeeTypeFilters(newTypes);
    setEmployeeNameFilters([]);
    setSelectedEmployee(null);
  };

  const handleEmployeeNameChange = (newNames: string[]) => {
    setEmployeeNameFilters(newNames);
    if (newNames.length > 0) {
      const chosenName = newNames[newNames.length - 1];
      const found = availableEmployees.find((e) => e.name === chosenName) ?? null;
      setSelectedEmployee(found);
      setDays("");
      setHasRemarks(null);
      setRemarksText("");
      setHasAttachments(null);
    } else {
      setSelectedEmployee(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetch("/api/leave-eligibility?gender=male", { cache: "no-store" }),
      fetch("/api/paternity-leave", { cache: "no-store" }),
    ])
      .then(async ([employeeResponse, recordResponse]) => {
        const [employeeResult, recordResult] = await Promise.all([
          employeeResponse.json(),
          recordResponse.json(),
        ]);
        if (!employeeResponse.ok && !recordResponse.ok) {
          throw new Error(employeeResult.error || recordResult.error || "Unable to load data.");
        }
        return {
          employees: ((employeeResult.employees || recordResult.employees) ?? []) as Employee[],
          records: ((recordResult.records || []) ?? []) as PaternityRecord[],
        };
      })
      .then((result) => {
        if (isMounted) {
          setEmployees(result.employees);
          setSubmittedRecords(result.records);
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "Unable to load paternity leave data.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleDocumentRequirement = (id: string, required: boolean) => {
    setDocumentConfigs((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, required } : doc))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployee) {
      alert("Please select an employee.");
      return;
    }

    if (!days || hasRemarks === null || hasAttachments === null) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      const response = await fetch("/api/paternity-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.employeeId,
          employeeName: selectedEmployee.name,
          noOfDays: Number(days),
          remarks: remarksText.trim() || "No remarks provided",
          status: "Active",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save paternity leave record.");
      setError("");
      setSubmittedRecords((prev) => [
        ...prev.filter((item) => item.employeeId !== selectedEmployee.employeeId),
        result.record as PaternityRecord,
      ]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save paternity leave record.");
    }
  };

  const handleInactiveAndDelete = async (employeeId: string) => {
    try {
      const response = await fetch(`/api/paternity-leave?employeeId=${encodeURIComponent(employeeId)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to delete paternity leave record.");
      setError("");
      setSubmittedRecords((prev) => prev.filter((record) => record.employeeId !== employeeId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete paternity leave record.");
    }
  };

  return (
    <div className="min-h-screen bg-[#edf1f5] text-slate-800">
      <LeaveSidebar activePage="paternity-leave" />
      <div className="p-6 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1440px]">
          <header className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Baby aria-hidden="true" size={28} className="text-emerald-700" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-800">Paternity Leave</h1>
                  <button
                    type="button"
                    onClick={() => setShowInfoModal(true)}
                    title="About Paternity Leave"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:bg-blue-100 hover:text-blue-800"
                    aria-label="About Paternity Leave"
                  >
                    <Info size={14} />
                  </button>
                </div>
                <p className="text-xs font-medium text-slate-500">Eligible for male employees only</p>
              </div>
            </div>
          </header>

          {/* Sequential 4-Step Selection Row */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Step 1: Streams always active */}
              <div className="w-full">
                <MultiSelectDropdown
                  label="Streams"
                  options={streams}
                  selectedValues={streamFilters}
                  onChange={handleStreamChange}
                />
              </div>

              {/* Step 2: Departments disabled until Stream is chosen */}
              <div className="w-full">
                <MultiSelectDropdown
                  label="Departments"
                  options={departments}
                  selectedValues={departmentFilters}
                  onChange={handleDepartmentChange}
                  disabled={isDepartmentDisabled}
                />
              </div>

              {/* Step 3: Employee Type */}
              <div className="w-full">
                <MultiSelectDropdown
                  label="Employee Types"
                  options={employeeTypeOptions}
                  selectedValues={employeeTypeFilters}
                  onChange={handleEmployeeTypeChange}
                  disabled={isEmployeeTypeDisabled}
                />
              </div>

              {/* Step 4: Employee Names disabled until Department is chosen */}
              <div className="w-full">
                <MultiSelectDropdown
                  label="Employee Names"
                  options={employeeNames}
                  selectedValues={employeeNameFilters}
                  onChange={handleEmployeeNameChange}
                  disabled={isEmployeeDisabled}
                />
              </div>
            </div>
          </div>

          {/* Always visible form */}
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            {error && (
              <p role="alert" className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              {selectedEmployee ? (
                `${selectedEmployee.name} - ${selectedEmployee.employeeId}`
              ) : (
                <span className="text-slate-400 font-normal">Select an employee from the dropdown above to continue</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <label htmlFor="no-of-days" className="block text-sm font-semibold text-slate-700">
                  No of Days <span className="text-red-500">*</span>
                </label>
                <div className="mt-3">
                  <input
                    id="no-of-days"
                    type="text"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Enter days"
                    value={days}
                    onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <span className="block text-sm font-semibold text-slate-700">
                  Remarks <span className="text-red-500">*</span>
                </span>
                <div className="mt-4 flex items-center gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="hasRemarks"
                      required
                      checked={hasRemarks === true}
                      onChange={() => {
                        setHasRemarks(true);
                        setActiveDialog("remarks");
                      }}
                      className="size-4 accent-slate-800"
                    />
                    Yes
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="hasRemarks"
                      required
                      checked={hasRemarks === false}
                      onChange={() => {
                        setHasRemarks(false);
                        setRemarksText("");
                      }}
                      className="size-4 accent-slate-800"
                    />
                    No
                  </label>

                  {hasRemarks && (
                    <button
                      type="button"
                      onClick={() => setActiveDialog("remarks")}
                      className="text-xs font-medium text-blue-700 underline hover:text-blue-800"
                    >
                      {remarksText ? "Edit" : "Add"}
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                <span className="block text-sm font-semibold text-slate-700">
                  Attachments <span className="text-red-500">*</span>
                </span>
                <div className="mt-4 flex items-center gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="hasAttachments"
                      required
                      checked={hasAttachments === true}
                      onChange={() => {
                        setHasAttachments(true);
                        setActiveDialog("attachments");
                      }}
                      className="size-4 accent-slate-800"
                    />
                    Yes
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="hasAttachments"
                      required
                      checked={hasAttachments === false}
                      onChange={() => setHasAttachments(false)}
                      className="size-4 accent-slate-800"
                    />
                    No
                  </label>

                  {hasAttachments && (
                    <button
                      type="button"
                      onClick={() => setActiveDialog("attachments")}
                      className="text-xs font-medium text-blue-700 underline hover:text-blue-800"
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-[#1a2332] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Submit
              </button>
            </div>
          </form>

          {submittedRecords.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-800">Submitted Paternity Records</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-6 py-3.5 font-medium">EMPLOYEE ID</th>
                      <th className="px-6 py-3.5 font-medium">EMPLOYEE NAME</th>
                      <th className="px-6 py-3.5 font-medium">DAYS</th>
                      <th className="px-6 py-3.5 font-medium">REMARKS</th>
                      <th className="px-6 py-3.5 font-medium">STATUS</th>
                      <th className="px-6 py-3.5 text-right font-medium">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submittedRecords.map((record) => (
                      <tr key={record.employeeId} className="border-t border-slate-200 hover:bg-slate-50/60">
                        <td className="px-6 py-4 font-medium text-slate-700">{record.employeeId}</td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{record.employeeName}</td>
                        <td className="px-6 py-4 text-slate-700">{record.noOfDays} days</td>
                        <td className="max-w-xs truncate px-6 py-4 text-slate-600">{record.remarks}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleInactiveAndDelete(record.employeeId)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
                          >
                            <Trash2 size={13} />
                            Inactive &amp; Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeDialog === "remarks" && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-5"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiveDialog(null);
          }}
        >
          <section
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Paternity Leave Remarks</h2>
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              autoFocus
              rows={5}
              value={remarksText}
              onChange={(e) => setRemarksText(e.target.value)}
              placeholder="Enter remarks..."
              className="w-full rounded-md border border-slate-300 p-3 text-sm text-slate-700 outline-none focus:border-blue-500"
            />
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Supporting Documents Admin Access Pop-up Modal */}
      {activeDialog === "attachments" && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-5"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiveDialog(null);
          }}
        >
          <section
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Paperclip className="size-5 rotate-45 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Supporting Documents</h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              {documentConfigs.map((doc, idx) => (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between bg-white px-4 py-3.5 ${
                    idx !== 0 ? "border-t border-slate-100" : ""
                  }`}
                >
                  <span className="text-sm font-medium text-slate-700">{doc.name}</span>
                  <div className="flex items-center gap-3">
                    <ToggleSwitch
                      checked={doc.required}
                      onChange={(val) => toggleDocumentRequirement(doc.id, val)}
                    />
                    <span className="w-16 text-right text-xs font-medium text-slate-700">
                      {doc.required ? "Required" : "Optional"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveDialog(null)}
                className="rounded-md bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {showInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Baby className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">About Paternity Leave</h3>
                  <p className="text-xs text-slate-500">Statutory leave benefit for male staff</p>
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
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">What is Paternity Leave?</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-blue-950">
                  A paid leave entitlement granted to male employees following the birth or legal adoption of a child to support their partner and bond with the newborn.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                    How it works
                  </h5>
                  <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
                    <li>Filtered exclusively to eligible male employees.</li>
                    <li>Allocates configured entitlement (e.g. 5 to 15 days).</li>
                    <li>Validates hospital discharge or birth certificate proofs.</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                  <h5 className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    How to use it
                  </h5>
                  <ol className="space-y-1.5 text-slate-600 list-decimal list-inside">
                    <li>Select Stream, Department, and Employee Name in sequence.</li>
                    <li>Enter the total number of approved leave days.</li>
                    <li>Verify required attachments (hospital / birth certificate).</li>
                    <li>Click <strong>Submit</strong> to record the paternity allocation.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
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
