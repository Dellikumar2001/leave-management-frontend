"use client";

import { useState } from "react";
import { X } from "lucide-react";
import DateInput, { formatToDisplayDate } from "../DateInput";
import { EmployeeRow } from "./EmployeeTable";

export type BlockedDateRecord = { id: number; employeeId: string; date: string };
export type CreditRecord = {
  id: number;
  employeeId: string;
  category: "ANNUAL" | "MEDICAL";
  days: number;
  createdAt: string;
  balanceLeaveType: { name: string; code: string };
};

type Props = {
  mode: "block" | "credit";
  action: "view" | "edit" | "delete";
  category: "ANNUAL" | "MEDICAL";
  employee: EmployeeRow;
  records: (BlockedDateRecord | CreditRecord)[];
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (id: number, value: string | number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

function dateValue(value: string) {
  return value.slice(0, 10);
}

export default function LeaveRecordDialog({
  mode, action, category, employee, records, error, saving, onClose, onSave, onDelete,
}: Props) {
  const firstRecord = action === "edit" ? records[0] : undefined;
  const [editingId, setEditingId] = useState<number | null>(firstRecord?.id ?? null);
  const [deletingId, setDeletingId] = useState<number | null>(action === "delete" && records.length === 1 ? records[0].id : null);
  const [value, setValue] = useState(firstRecord
    ? mode === "block" ? dateValue((firstRecord as BlockedDateRecord).date) : String((firstRecord as CreditRecord).days)
    : "");

  const title = mode === "block"
    ? `Blocked dates for ${employee.name}`
    : `${category === "ANNUAL" ? "Annual" : "Medical"} credits for ${employee.name}`;

  const beginEdit = (record: BlockedDateRecord | CreditRecord) => {
    setEditingId(record.id);
    setDeletingId(null);
    setValue(mode === "block" ? dateValue((record as BlockedDateRecord).date) : String((record as CreditRecord).days));
  };

  const showConfirm = deletingId !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{showConfirm ? `Delete this ${mode === "block" ? "blocked date" : "credit"}?` : title}</h2>
            <p className="mt-1 text-sm text-slate-500">{employee.employeeId} · {employee.department} · {employee.stream}</p>
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        {showConfirm ? (
          <p className="mt-5 text-sm leading-6 text-slate-600">
            {mode === "block"
              ? "Deleting this blocked date will make the date available for leave requests again."
              : "Deleting this credit will reverse the credited days from the employee's balance."}
          </p>
        ) : (
          <div className="mt-5 max-h-[55vh] space-y-2 overflow-y-auto">
            {records.map((record) => (
              <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                {mode === "block" ? (
                  editingId === record.id ? (
                    <div className="w-48">
                      <DateInput
                        aria-label="Blocked date"
                        value={value}
                        onChange={(val) => setValue(val)}
                        placeholder="dd / mm / yyyy"
                        className="h-10"
                      />
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-slate-700">{formatToDisplayDate(dateValue((record as BlockedDateRecord).date))}</span>
                  )
                ) : (
                  editingId === record.id ? (
                    <label className="text-sm text-slate-600">Days
                      <input aria-label="Credited days" type="number" min={1} value={value} onChange={(event) => setValue(event.target.value)} className="ml-2 h-10 w-24 rounded border border-slate-300 px-2" />
                    </label>
                  ) : (
                    <span className="text-sm font-medium text-slate-700">{(record as CreditRecord).days} days · {new Date((record as CreditRecord).createdAt).toLocaleDateString()}</span>
                  )
                )}
                {action !== "view" && (
                  <div className="flex gap-2">
                    {editingId === record.id ? (
                      <>
                        <button type="button" disabled={saving || !value} onClick={() => void onSave(record.id, mode === "block" ? value : Number(value))} className="text-sm font-semibold text-emerald-800 disabled:opacity-50">Save</button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-sm text-slate-500">Cancel</button>
                      </>
                    ) : (
                      <>
                        {action === "edit" && (
                          <button type="button" onClick={() => beginEdit(record)} className="text-sm font-semibold text-slate-600 hover:text-emerald-800">Edit</button>
                        )}
                        {action === "delete" && (
                          <button type="button" onClick={() => setDeletingId(record.id)} className="text-sm font-semibold text-red-600 hover:text-red-800">Delete</button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!records.length && <p className="py-6 text-center text-sm text-slate-500">No records found.</p>}
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <footer className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" disabled={saving} onClick={() => showConfirm ? setDeletingId(null) : onClose()} className="h-10 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700 disabled:opacity-50">
            {showConfirm ? "CANCEL" : "CLOSE"}
          </button>
          {showConfirm && (
            <button type="button" disabled={saving} onClick={() => void onDelete(deletingId)} className="h-10 rounded-lg bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? "DELETING..." : "DELETE"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
