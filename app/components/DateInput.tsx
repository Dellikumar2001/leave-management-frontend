"use client";

import React, { useRef, useState } from "react";
import { Calendar } from "lucide-react";

interface DateInputProps {
  id?: string;
  value: string; // ISO format "YYYY-MM-DD"
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  title?: string;
}

/** Formats ISO "YYYY-MM-DD" to "DD/MM/YYYY" */
export function formatToDisplayDate(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const [year, month, day] = parts;
  if (!year || !month || !day) return isoDate;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

/** Formats ISO "YYYY-MM-DD" to "DD-MM-YYYY" */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || dateStr === "—") return dateStr || "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  if (!year || !month || !day) return dateStr;
  return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
}

/** Automatically formats raw numeric digits into DD/MM/YYYY structure */
export function formatDigits(digits: string): string {
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/** Validates 8 digits and parses to ISO "YYYY-MM-DD" */
export function parseDigitsToIso(digits: string): string | null {
  if (digits.length !== 8) return null;
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const numDay = parseInt(day, 10);
  const numMonth = parseInt(month, 10);
  const numYear = parseInt(year, 10);

  if (numMonth < 1 || numMonth > 12) return null;
  if (numDay < 1 || numDay > 31) return null;
  if (numYear < 1900 || numYear > 2100) return null;

  // Validate days in the specific month
  const daysInMonth = new Date(numYear, numMonth, 0).getDate();
  if (numDay > daysInMonth) return null;

  return `${year}-${month}-${day}`;
}

/** Parses user input like "DD/MM/YYYY" or "DD-MM-YYYY" to ISO "YYYY-MM-DD" */
export function parseToIsoDate(displayDate: string): string | null {
  if (!displayDate) return "";
  const digits = displayDate.replace(/\D/g, "");
  return parseDigitsToIso(digits);
}

export default function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  placeholder = "dd / mm / yyyy",
  className = "",
  "aria-label": ariaLabel,
  title,
}: DateInputProps) {
  const [prevValue, setPrevValue] = useState(value);
  const [text, setText] = useState<string>(() => formatToDisplayDate(value));
  const nativeInputRef = useRef<HTMLInputElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setText(formatToDisplayDate(value));
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control / navigation keys
    if (
      [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    // If user presses slash or hyphen after a single digit, pad with leading zero
    if (e.key === "/" || e.key === "-") {
      e.preventDefault();
      const currentDigits = text.replace(/\D/g, "");
      if (currentDigits.length === 1) {
        const next = `0${currentDigits}`;
        setText(next);
      } else if (currentDigits.length === 3) {
        const next = `${currentDigits.slice(0, 2)}/0${currentDigits.slice(2)}`;
        setText(next);
      }
      return;
    }

    // Strictly restrict alphabets and any non-numeric keys
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Extract only numeric digits, max 8 (DDMMYYYY)
    const rawDigits = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = formatDigits(rawDigits);
    setText(formatted);

    if (!rawDigits) {
      onChange("");
      return;
    }

    if (rawDigits.length === 8) {
      const iso = parseDigitsToIso(rawDigits);
      if (iso) {
        onChange(iso);
      }
    } else if (value) {
      // Input is partially typed/incomplete, clear parent value until valid
      onChange("");
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextIso = e.target.value;
    onChange(nextIso);
    setText(formatToDisplayDate(nextIso));
  };

  const handleBlur = () => {
    const rawDigits = text.replace(/\D/g, "");
    if (!rawDigits) {
      onChange("");
      setText("");
      return;
    }

    if (rawDigits.length === 8) {
      const iso = parseDigitsToIso(rawDigits);
      if (iso) {
        onChange(iso);
        setText(formatToDisplayDate(iso));
        return;
      }
    }

    // Revert incomplete or invalid date to last valid value or empty
    setText(formatToDisplayDate(value));
  };

  const openPicker = () => {
    if (disabled) return;
    try {
      nativeInputRef.current?.showPicker();
    } catch {
      nativeInputRef.current?.focus();
    }
  };

  return (
    <div
      className={`relative flex items-center h-10 w-full min-w-0 rounded-md border bg-white transition-colors ${
        disabled
          ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
          : "border-slate-300 text-slate-700 hover:border-slate-400 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
      } ${className}`}
      title={title}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onChange={handleTextChange}
        onBlur={handleBlur}
        aria-label={ariaLabel}
        maxLength={10}
        className="h-full w-full min-w-0 bg-transparent pl-2.5 pr-8 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
      />
      <div className="absolute right-2.5 flex items-center justify-center">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openPicker}
          aria-label="Open calendar"
          className="text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
        >
          <Calendar size={16} aria-hidden="true" />
        </button>
        <input
          ref={nativeInputRef}
          type="date"
          tabIndex={-1}
          disabled={disabled}
          value={value || ""}
          min={min}
          max={max}
          onChange={handleNativeChange}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
