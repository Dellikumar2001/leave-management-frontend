"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type FilterMultiSelectProps = {
  label: "Stream" | "Department";
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

export default function FilterMultiSelect({ label, options, selected, onChange }: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const visibleOptions = options.filter((option) => option.toLowerCase().includes(search.trim().toLowerCase()));
  const allSelected = visibleOptions.length > 0 && visibleOptions.every((option) => selected.includes(option));
  const summary = selected.length === 0 ? `All ${label}s` : `${selected.length} selected`;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    searchRef.current?.focus();
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  const toggleOption = (option: string) => {
    onChange(selected.includes(option)
      ? selected.filter((value) => value !== option)
      : [...selected, option]);
  };

  return (
    <div ref={wrapperRef} className={`relative min-w-0 ${open ? "z-40" : ""}`}>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      <button
        type="button"
        aria-label={`Filter by ${label.toLowerCase()}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-left text-sm text-slate-700 hover:border-slate-400 focus:border-emerald-500 focus:outline-none"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-full min-w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
          <div className="relative">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === "Escape") setOpen(false);
              }}
              placeholder={`Search ${label.toLowerCase()}s`}
              aria-label={`Search ${label.toLowerCase()} options`}
              className="h-9 w-full rounded-md border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2 py-2 text-xs font-semibold text-emerald-800">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange(allSelected
                ? selected.filter((value) => !visibleOptions.includes(value))
                : [...new Set([...selected, ...visibleOptions])])}
              className="accent-emerald-700"
            />
            Select All{visibleOptions.length ? ` (${visibleOptions.length})` : ""}
          </label>
          <div className="max-h-56 overflow-y-auto pt-1">
            {visibleOptions.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <input type="checkbox" checked={selected.includes(option)} onChange={() => toggleOption(option)} className="accent-emerald-700" />
                <span className="truncate">{option}</span>
                {selected.includes(option) && <Check size={14} aria-hidden="true" className="ml-auto shrink-0 text-emerald-700" />}
              </label>
            ))}
            {visibleOptions.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-500">No matches found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
