"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type LeaveCategoryOption = {
  id: number;
  name: string;
};

type LeaveCategoryMultiSelectProps = {
  values: string[];
  options: LeaveCategoryOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
};

export default function LeaveCategoryMultiSelect({
  values,
  options,
  onChange,
  disabled = false,
}: LeaveCategoryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selectedNames = values
    .map((value) => options.find((option) => String(option.id) === value)?.name ?? value)
    .filter(Boolean);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => !disabled && setOpen((current) => !current)}
        className={`flex min-h-[46px] w-full flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm uppercase text-slate-700 outline-none transition focus:border-blue-300 ${
          disabled ? "cursor-not-allowed opacity-70" : "hover:border-slate-400"
        }`}
      >
        <span className="flex flex-1 flex-wrap gap-2">
          {selectedNames.length ? (
            selectedNames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700"
              >
                {name}
              </span>
            ))
          ) : (
            <span className="text-slate-400">Select leave categories</span>
          )}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !disabled && (
        <>
          <button
            type="button"
            aria-label="Close leave category options"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {options.length ? (
              options.map((option) => {
                const value = String(option.id);
                const checked = values.includes(value);
                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 uppercase hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onChange(
                        checked ? values.filter((item) => item !== value) : [...values, value],
                      )}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
                    />
                    <span className="text-sm font-medium text-slate-700">{option.name}</span>
                  </label>
                );
              })
            ) : (
              <div className="px-2 py-3 text-sm uppercase text-slate-500">No leave categories available</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}