"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Image as ImageIcon,
  Link as LinkIcon,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";
import DateInput from "../components/DateInput";

type HolidayType = "national" | "festival" | "special";
type HolidayStatus = "active" | "inactive";

type Holiday = {
  id: number;
  name: string;
  date: string;
  type: HolidayType;
  description: string;
  repeatEveryYear: boolean;
  status: HolidayStatus;
  isHoliday: boolean;
};

type ParsedHoliday = {
  name: string;
  date: string;
  type?: string;
  description?: string;
  isHoliday?: boolean;
};

const holidayTypeLabels: Record<HolidayType, string> = {
  national: "National Holiday",
  festival: "Festival",
  special: "Public Holiday",
};

const holidayTypeColors: Record<HolidayType, string> = {
  national: "bg-red-50 text-red-600 border border-red-200",
  festival: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  special: "bg-blue-50 text-blue-700 border border-blue-200",
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2020, index, 1))
);

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", options).format(new Date(`${value}T12:00:00`));
}

function formatDisplayDate(value: string): string {
  if (!value) return "";
  const parts = value.slice(0, 10).split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
  }
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function cleanHolidayTitle(title: string): string {
  if (!title) return "";
  return title
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, "")
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, "")
    .replace(/\bCD\s*\d+\b/gi, "")
    .replace(/\bW\b/g, "")
    .replace(/\s*[-–—/]\s*$/, "")
    .replace(/^[\s.*•\-|–—:;,\d]+/, "")
    .replace(/[\s.*•\-|–—:;,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ALLOWED_EXTENSIONS = [".pdf", ".xlsx", ".xls", ".csv", ".png", ".jpg", ".jpeg", ".webp"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const INVALID_FILE_TYPE_ERROR = "Kindly upload mentioned file types: PDF, XLSX, XLS, CSV, PNG, JPG.";
const FILE_SIZE_ERROR = "File size must not exceed 2 MB.";

function validateUploadedFile(file: File): { isValid: boolean; error?: string } {
  const fileName = file.name.toLowerCase();
  const isAllowedType = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!isAllowedType) {
    return { isValid: false, error: INVALID_FILE_TYPE_ERROR };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, error: FILE_SIZE_ERROR };
  }

  return { isValid: true };
}

export default function HolidayCalendarPage() {
  const [month, setMonth] = useState(() => dateKey(new Date()).slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [name, setName] = useState("");
  const [holidayType, setHolidayType] = useState<HolidayType>("national");
  const [description, setDescription] = useState("");
  const [repeatEveryYear, setRepeatEveryYear] = useState(false);
  const [status, setStatus] = useState<HolidayStatus>("active");
  const [view, setView] = useState<"month" | "list" | "year">("month");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | HolidayType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | HolidayStatus>("all");
  const [recordsScope, setRecordsScope] = useState<"month" | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);

  // Import State
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);

  const [isLoadingHolidays, setIsLoadingHolidays] = useState(true);
  const [holidayError, setHolidayError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  function validateAndSetFile(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validation = validateUploadedFile(file);
    if (!validation.isValid) {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadError(validation.error || INVALID_FILE_TYPE_ERROR);
      setUploadSuccess("");
      return;
    }

    setSelectedFile(file);
    setUploadError("");
    setUploadSuccess("");
  }

  useEffect(() => {
    let isMounted = true;

    async function loadHolidays() {
      try {
        const response = await fetch("/api/holidays", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load holidays.");

        const databaseHolidays = (Array.isArray(result) ? result : []).sort(
          (a: Holiday, b: Holiday) => a.date.localeCompare(b.date) || a.id - b.id
        );

        if (!isMounted) return;
        setHolidays(databaseHolidays);
        setHolidayError("");
      } catch (loadError) {
        if (isMounted) setHolidayError(loadError instanceof Error ? loadError.message : "Unable to load holidays.");
      } finally {
        if (isMounted) setIsLoadingHolidays(false);
      }
    }

    void loadHolidays();
    return () => {
      isMounted = false;
    };
  }, []);

  const shownMonth = month || dateKey(new Date()).slice(0, 7);
  const monthDate = new Date(`${shownMonth}-01T12:00:00`);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const monthTitle = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(monthDate);
  const years = Array.from({ length: 21 }, (_, index) => new Date().getFullYear() - 10 + index);
  if (!years.includes(year)) years.push(year);

  const monthHolidays = holidays
    .filter((holiday) => holiday.isHoliday)
    .flatMap((holiday) => {
      const holidayMonth = holiday.date.slice(5, 7);
      if (holiday.repeatEveryYear ? holidayMonth !== shownMonth.slice(5, 7) : !holiday.date.startsWith(shownMonth)) {
        return [];
      }
      const displayDate = holiday.repeatEveryYear ? `${shownMonth}-${holiday.date.slice(8, 10)}` : holiday.date;
      const displayDateValue = new Date(`${displayDate}T12:00:00`);
      if (dateKey(displayDateValue) !== displayDate) return [];
      return [{ ...holiday, displayDate }];
    })
    .sort((a, b) => a.displayDate.localeCompare(b.displayDate));

  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysCount = new Date(year, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDay + 1;
    return day > 0 && day <= daysCount ? day : null;
  });

  const listDays = Array.from({ length: daysCount }, (_, index) => {
    const date = `${shownMonth}-${String(index + 1).padStart(2, "0")}`;
    return {
      date,
      holidays: monthHolidays.filter((holiday) => holiday.displayDate === date),
    };
  });

  const baseRecords =
    recordsScope === "month"
      ? monthHolidays
      : holidays
        .filter((holiday) => holiday.isHoliday)
        .map((h) => ({ ...h, displayDate: h.date }))
        .sort((a, b) => a.displayDate.localeCompare(b.displayDate));

  const filteredHolidays = baseRecords.filter((holiday) => {
    const query = search.trim().toLowerCase();
    return (
      (!query || holiday.name.toLowerCase().includes(query) || holiday.description.toLowerCase().includes(query)) &&
      (typeFilter === "all" || holiday.type === typeFilter) &&
      (statusFilter === "all" || holiday.status === statusFilter)
    );
  });

  async function addHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const holidayName = cleanHolidayTitle(name);
    if (!holidayName) return;
    if (!selectedDate) {
      setHolidayError("Please select or enter a valid holiday date (DD/MM/YYYY).");
      return;
    }
    const payload = {
      name: holidayName,
      date: selectedDate,
      type: holidayType,
      description: description.trim() || holidayTypeLabels[holidayType],
      repeatEveryYear,
      status,
      isHoliday: true,
    };

    setHolidayError("");
    try {
      const isEditing = editingHolidayId !== null;
      const response = await fetch(isEditing ? `/api/holidays/${editingHolidayId}` : "/api/holidays", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save holiday.");
      const savedHoliday = result as Holiday;
      setHolidays((current) =>
        isEditing
          ? current.map((holiday) => (holiday.id === savedHoliday.id ? savedHoliday : holiday))
          : [...current, savedHoliday]
      );
    } catch (saveError) {
      setHolidayError(saveError instanceof Error ? saveError.message : "Unable to save holiday.");
      return;
    }
    closeHolidayForm();
  }

  async function resetHolidays() {
    if (!holidays.length || !window.confirm("Delete all holidays from the calendar and table?")) return;
    setHolidayError("");
    try {
      const response = await fetch("/api/holidays", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to reset holidays.");
      setHolidays([]);
    } catch (resetError) {
      setHolidayError(resetError instanceof Error ? resetError.message : "Unable to reset holidays.");
    }
  }

  function closeHolidayForm() {
    setShowForm(false);
    setEditingHolidayId(null);
    setName("");
    setHolidayType("national");
    setDescription("");
    setRepeatEveryYear(false);
    setStatus("active");
  }

  function editHoliday(holiday: Holiday) {
    setEditingHolidayId(holiday.id);
    setName(cleanHolidayTitle(holiday.name));
    setSelectedDate(holiday.date);
    setMonth(holiday.date.slice(0, 7));
    setHolidayType(holiday.type);
    setDescription(holiday.description);
    setRepeatEveryYear(holiday.repeatEveryYear);
    setStatus(holiday.status);
    setShowForm(true);
    setShowUpload(false);
  }

  async function deleteHoliday(holidayId: number) {
    setHolidayError("");
    try {
      const response = await fetch(`/api/holidays/${holidayId}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Unable to delete holiday.");
      }
      setHolidays((current) => current.filter((holiday) => holiday.id !== holidayId));
    } catch (deleteError) {
      setHolidayError(deleteError instanceof Error ? deleteError.message : "Unable to delete holiday.");
    }
  }

  function changeMonth(offset: number) {
    const nextMonth = new Date(year, monthIndex + offset, 1);
    const value = dateKey(nextMonth).slice(0, 7);
    setMonth(value);
    setSelectedDate(`${value}-01`);
  }

  function exportHolidays() {
    const rows = [
      ["DATE", "HOLIDAY", "TYPE", "DESCRIPTION", "REPEATS EVERY YEAR", "STATUS"],
      ...filteredHolidays.map((holiday) => [
        formatDisplayDate(holiday.displayDate),
        cleanHolidayTitle(holiday.name),
        holidayTypeLabels[holiday.type],
        holiday.description,
        holiday.repeatEveryYear ? "Yes" : "No",
        holiday.status,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `holidays-${recordsScope === "month" ? shownMonth : "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Unified File / Link Reader
  async function readUpload() {
    if (uploadMode === "link") {
      const trimmed = linkUrl.trim();
      if (!trimmed) {
        setUploadError("Enter a valid calendar URL first.");
        return;
      }
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          setUploadError("Please enter a valid HTTP or HTTPS calendar URL.");
          return;
        }
      } catch {
        setUploadError("Please enter a valid calendar URL (e.g., https://example.com/calendar.pdf).");
        return;
      }
    }
    if (uploadMode === "file") {
      if (!selectedFile) {
        setUploadError("Choose a calendar file first (PDF, Excel, CSV, or Image).");
        return;
      }
      const validation = validateUploadedFile(selectedFile);
      if (!validation.isValid) {
        setUploadError(validation.error || INVALID_FILE_TYPE_ERROR);
        return;
      }
    }

    setIsReadingFile(true);
    setUploadError("");
    setUploadProgress(
      uploadMode === "link"
        ? "Fetching and analyzing link..."
        : "Extracting holidays automatically using smart document parser..."
    );

    try {
      let response: Response;

      if (uploadMode === "link") {
        response = await fetch("/api/holidays/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: linkUrl.trim(), year }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile!);
        formData.append("year", String(year));
        response = await fetch("/api/holidays/extract", {
          method: "POST",
          body: formData,
        });
      }

      const parsedRows = await response.json();
      if (!response.ok) {
        throw new Error(parsedRows?.error || "Failed to extract holidays from this source.");
      }

      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        throw new Error("No holidays were found in this source.");
      }

      // Check existing dates in calendar
      const known = new Set(holidays.map((h) => `${h.date}\0${h.name.toLowerCase()}`));
      const candidates = parsedRows.filter((row: ParsedHoliday) => {
        if (!row?.date || !row?.name) return false;
        const key = `${row.date}\0${row.name.toLowerCase()}`;
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });

      if (candidates.length === 0) {
        throw new Error("All detected holidays are already present in your calendar.");
      }

      const imported = candidates.map((row: ParsedHoliday) => {
        const rowType = row.type === "national" || row.type === "festival" ? row.type : "special";
        return {
          name: cleanHolidayTitle(row.name),
          date: row.date,
          type: rowType,
          description: row.description || holidayTypeLabels[rowType as HolidayType] || "Imported holiday",
          repeatEveryYear: false,
          status: "active",
          isHoliday: true,
        };
      });

      imported.sort((a, b) => a.date.localeCompare(b.date));

      setUploadProgress("Saving holidays to database...");
      const saveResponse = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imported),
      });

      const savedHolidays = await saveResponse.json();
      if (!saveResponse.ok) {
        throw new Error(savedHolidays?.error || "Unable to save imported holidays to database.");
      }

      const savedRecords = (Array.isArray(savedHolidays) ? savedHolidays : [savedHolidays]) as Holiday[];
      setHolidays((current) => [...current, ...savedRecords]);

      if (savedRecords.length > 0) {
        setMonth(savedRecords[0].date.slice(0, 7));
        setSelectedDate(savedRecords[0].date);
      }
      setSelectedFile(null);
      setLinkUrl("");
      setUploadSuccess(`Successfully imported ${imported.length} holidays with exact dates!`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadProgress("");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to process this source.");
      setUploadSuccess("");
      setUploadProgress("");
    } finally {
      setIsReadingFile(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="holiday-calendar" />

      <div className="p-4 min-[801px]:ml-[175px]">
        <div className="mx-auto max-w-[1400px] space-y-4">
          {/* Header Card matching Leave Administration system */}
          <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#f5f7fa] px-6 py-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                <span>Leave Admin</span>
                <span>/</span>
                <span className="font-semibold text-slate-800">Holiday Calendar</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-800">
                Holiday Calendar
              </h1>
            </div>

            {/* Top Toolbar: Month, Year, Import, Reset, Add Holiday */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Month selector */}
              <div className="relative">
                <label className="sr-only" htmlFor="calendar-month">Month</label>
                <select
                  id="calendar-month"
                  value={monthIndex}
                  onChange={(event) => {
                    const value = `${year}-${String(Number(event.target.value) + 1).padStart(2, "0")}`;
                    setMonth(value);
                    setSelectedDate(`${value}-01`);
                  }}
                  className="h-10 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
                >
                  {months.map((monthName, index) => (
                    <option key={monthName} value={index}>{monthName}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              {/* Year selector */}
              <div className="relative">
                <label className="sr-only" htmlFor="calendar-year">Year</label>
                <select
                  id="calendar-year"
                  value={year}
                  onChange={(event) => {
                    const value = `${event.target.value}-${String(monthIndex + 1).padStart(2, "0")}`;
                    setMonth(value);
                    setSelectedDate(`${value}-01`);
                  }}
                  className="h-10 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
                >
                  {years.sort((first, second) => first - second).map((yearOption) => (
                    <option key={yearOption} value={yearOption}>{yearOption}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              {/* Import Button */}
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                onClick={() => {
                  setShowUpload(true);
                  setShowForm(false);
                  setUploadError("");
                  setUploadSuccess("");
                }}
              >
                <FileUp size={16} aria-hidden="true" />
                <span>Import</span>
              </button>

              {/* Reset Button */}
              <button
                type="button"
                disabled={holidays.length === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={resetHolidays}
              >
                <RotateCcw size={15} aria-hidden="true" />
                <span>Reset</span>
              </button>

              {/* Add Holiday Button */}
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 active:scale-[0.98]"
                onClick={() => {
                  setShowForm(true);
                  setShowUpload(false);
                }}
              >
                <Plus size={16} aria-hidden="true" />
                <span>Add holiday</span>
              </button>
            </div>
          </header>

          {holidayError && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
              {holidayError}
            </p>
          )}

          {/* Calendar Showcase Card */}
          <section
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            aria-label="Holiday calendar"
          >
            <div className="grid min-h-[440px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
              {/* Left Calendar Grid View */}
              <div className="min-w-0 p-5">
                {/* Month title & View switcher */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
                      aria-label="Previous month"
                      onClick={() => changeMonth(-1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <h2 className="min-w-[140px] text-center text-lg font-bold text-slate-800">
                      {monthTitle}
                    </h2>
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
                      aria-label="Next month"
                      onClick={() => changeMonth(1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* View Switcher Pills */}
                  <div className="inline-flex items-center rounded-lg bg-slate-100 p-1" role="group" aria-label="Calendar view">
                    {(["month", "list", "year"] as const).map((viewOption) => (
                      <button
                        key={viewOption}
                        type="button"
                        aria-pressed={view === viewOption}
                        onClick={() => setView(viewOption)}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-semibold capitalize transition-all ${view === viewOption
                          ? "bg-white text-emerald-800 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                          }`}
                      >
                        {viewOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1. Month View */}
                {view === "month" && (
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                      {weekdays.map((day) => (
                        <div
                          className="flex h-10 items-center justify-center text-xs font-semibold uppercase tracking-wider text-slate-600"
                          key={day}
                        >
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-white">
                      {days.map((day, index) => {
                        const value = day ? `${shownMonth}-${String(day).padStart(2, "0")}` : "";
                        const dayHolidays = monthHolidays.filter(
                          (holiday) => holiday.displayDate === value && holiday.status === "active"
                        );
                        const today = value === dateKey(new Date());
                        const isSelected = selectedDate === value;

                        return (
                          <div
                            key={index}
                            className={`min-h-[105px] p-2 transition-colors ${!day ? "bg-slate-50/60" : isSelected ? "bg-emerald-50/60 ring-2 ring-inset ring-emerald-500" : "bg-white hover:bg-slate-50/40"
                              }`}
                          >
                            {day && (
                              <>
                                <div className="flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDate(value)}
                                    className={`size-6 rounded-full text-xs font-semibold transition-colors ${today
                                      ? "bg-emerald-600 text-white"
                                      : isSelected
                                        ? "bg-slate-800 text-white"
                                        : "text-slate-700 hover:bg-slate-100"
                                      }`}
                                  >
                                    {day}
                                  </button>
                                  {dayHolidays.length > 0 && (
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                  )}
                                </div>
                                <div className="mt-1.5 flex flex-col gap-1">
                                  {dayHolidays.slice(0, 2).map((holiday) => (
                                    <span
                                      key={holiday.id}
                                      className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${holidayTypeColors[holiday.type]
                                        }`}
                                      title={cleanHolidayTitle(holiday.name)}
                                    >
                                      {cleanHolidayTitle(holiday.name)}
                                    </span>
                                  ))}
                                  {dayHolidays.length > 2 && (
                                    <span className="text-[10px] font-medium text-slate-500">
                                      +{dayHolidays.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. List View */}
                {view === "list" && (
                  <div className="h-[600px] overflow-y-auto rounded-lg border border-slate-200">
                    <div className="grid grid-cols-[105px_90px_minmax(0,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                      <span>Date</span>
                      <span>Day</span>
                      <span>Holiday</span>
                    </div>
                    {listDays.map((listDay) => {
                      const dayHolidays = listDay.holidays;
                      return (
                        <div
                          className="grid min-h-12 grid-cols-[105px_90px_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm hover:bg-slate-50/60"
                          key={listDay.date}
                        >
                          <time dateTime={listDay.date} className="font-medium text-slate-800">
                            {formatDisplayDate(listDay.date)}
                          </time>
                          <span className="text-slate-500">
                            {formatDate(listDay.date, { weekday: "short" })}
                          </span>
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {dayHolidays.map((holiday) => (
                              <span
                                key={holiday.id}
                                className={`rounded px-2 py-0.5 text-xs font-medium ${holidayTypeColors[holiday.type]}`}
                                title={`${cleanHolidayTitle(holiday.name)}${holiday.status === "inactive" ? " (inactive)" : ""}`}
                              >
                                {cleanHolidayTitle(holiday.name)}
                                {holiday.status === "inactive" ? " · Inactive" : ""}
                              </span>
                            ))}
                            {dayHolidays.length === 0 && <span className="text-slate-400">—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Year View */}
                {view === "year" && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {months.map((monthName, index) => {
                      const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
                      const count = holidays.filter(
                        (holiday) =>
                          holiday.isHoliday &&
                          holiday.status === "active" &&
                          (holiday.repeatEveryYear
                            ? holiday.date.slice(5, 7) === monthKey.slice(5, 7)
                            : holiday.date.startsWith(monthKey))
                      ).length;

                      return (
                        <button
                          key={monthName}
                          type="button"
                          className="flex min-h-[95px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-3.5 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/50"
                          onClick={() => {
                            setMonth(monthKey);
                            setSelectedDate(`${monthKey}-01`);
                            setView("month");
                          }}
                        >
                          <strong className="text-sm font-bold text-slate-800">{monthName}</strong>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <span className="size-2 rounded-full bg-emerald-500" />
                            {count} {count === 1 ? "holiday" : "holidays"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Aside: Holidays in Selected Month */}
              <aside
                className="border-t border-slate-200 bg-slate-50/50 p-5 xl:border-l xl:border-t-0"
                aria-label={`Holidays in ${monthTitle}`}
              >
                <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-800">Month Holidays</h3>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {monthHolidays.length}
                  </span>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-[500px]">
                  {monthHolidays.length ? (
                    monthHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-700">
                              {formatDisplayDate(holiday.displayDate)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {formatDate(holiday.displayDate, { weekday: "short" })}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs font-semibold text-slate-900" title={cleanHolidayTitle(holiday.name)}>
                            {cleanHolidayTitle(holiday.name)}
                          </p>
                          <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${holidayTypeColors[holiday.type]}`}>
                            {holidayTypeLabels[holiday.type]}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="grid size-7 shrink-0 place-items-center rounded border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-100"
                          aria-label={`Remove ${holiday.name}`}
                          onClick={() => deleteHoliday(holiday.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No holidays declared in {monthTitle}.
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </section>

          {/* Holiday Records Table Section */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="holiday-records-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <h2 id="holiday-records-title" className="text-base font-bold text-slate-800">
                Holiday Records
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Showing:</span>
                <button
                  type="button"
                  onClick={() => setRecordsScope("month")}
                  className={`rounded-md px-3 py-1 font-semibold transition-colors ${recordsScope === "month"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  {monthTitle}
                </button>
                <button
                  type="button"
                  onClick={() => setRecordsScope("all")}
                  className={`rounded-md px-3 py-1 font-semibold transition-colors ${recordsScope === "all"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                >
                  All Months ({holidays.filter((holiday) => holiday.isHoliday).length})
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 items-end gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2 xl:grid-cols-12">
              <div className="flex min-w-0 flex-col gap-1 xl:col-span-5">
                <label htmlFor="search-holidays" className="text-[11px] font-semibold uppercase text-slate-500">
                  Search
                </label>
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="search-holidays"
                    aria-label="Search holidays"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by holiday name or description…"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-1 xl:col-span-3">
                <label htmlFor="filter-type" className="text-[11px] font-semibold uppercase text-slate-500">
                  Holiday Type
                </label>
                <div className="relative">
                  <select
                    id="filter-type"
                    aria-label="Filter by type"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as "all" | HolidayType)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
                  >
                    <option value="all">All Types</option>
                    <option value="national">National Holiday</option>
                    <option value="festival">Festival</option>
                    <option value="special">Public Holiday</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-1 xl:col-span-2">
                <label htmlFor="filter-status" className="text-[11px] font-semibold uppercase text-slate-500">
                  Status
                </label>
                <div className="relative">
                  <select
                    id="filter-status"
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as "all" | HolidayStatus)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 active:scale-[0.98] xl:col-span-2"
                onClick={exportHolidays}
              >
                <Download size={15} aria-hidden="true" />
                <span>Export CSV</span>
              </button>
            </div>

            {/* Semantic Table with Balanced Column Layout */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="w-14 px-5 py-3.5 font-semibold text-center border-b border-slate-200">#</th>
                    <th className="w-36 px-5 py-3.5 font-semibold text-left border-b border-slate-200 whitespace-nowrap">DATE</th>
                    <th className="w-56 px-5 py-3.5 font-semibold text-left border-b border-slate-200">HOLIDAY NAME</th>
                    <th className="w-40 px-5 py-3.5 font-semibold text-left border-b border-slate-200">TYPE</th>
                    <th className="min-w-[200px] px-5 py-3.5 font-semibold text-left border-b border-slate-200">DESCRIPTION</th>
                    <th className="w-28 px-5 py-3.5 font-semibold text-center border-b border-slate-200">STATUS</th>
                    <th className="w-24 px-5 py-3.5 font-semibold text-right border-b border-slate-200">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHolidays.length ? (
                    filteredHolidays.map((holiday, index) => (
                      <tr key={holiday.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 text-center text-slate-500 font-medium align-middle">
                          {index + 1}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap font-medium text-slate-700 align-middle">
                          {formatDisplayDate(holiday.displayDate)}
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-900 align-middle">
                          {cleanHolidayTitle(holiday.name)}
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${holidayTypeColors[holiday.type]}`}>
                            {holidayTypeLabels[holiday.type]}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 align-middle">
                          {holiday.description || "—"}
                        </td>
                        <td className="px-5 py-4 text-center align-middle">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${holiday.status === "inactive"
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                          >
                            <span className={`size-1.5 rounded-full ${holiday.status === "inactive" ? "bg-slate-400" : "bg-emerald-500"}`} />
                            {holiday.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right align-middle">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => editHoliday(holiday)}
                              className="grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteHoliday(holiday.id)}
                              className="grid size-7 place-items-center rounded text-red-500 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : isLoadingHolidays ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        Loading holidays from database…
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                        No holidays match the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3.5 text-xs text-slate-500">
              <div>
                Showing <strong className="text-slate-700">{filteredHolidays.length}</strong> holiday record(s)
              </div>
            </footer>
          </section>
        </div>
      </div>

      {/* ── Add / Edit Holiday Modal ── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeHolidayForm();
          }}
        >
          <section
            className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="holiday-form-title"
          >
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 id="holiday-form-title" className="text-lg font-bold text-slate-800">
                  {editingHolidayId ? "Edit Holiday" : "New Holiday"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {editingHolidayId ? "Update official holiday record." : "Add a recognized date-specific holiday."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close form"
                onClick={closeHolidayForm}
                className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={addHoliday} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Holiday Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Independence Day, Pongal"
                  className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Holiday Date <span className="text-red-500">*</span>
                </label>
                <div className="mt-1.5">
                  <DateInput
                    id="holiday-date-input"
                    value={selectedDate}
                    onChange={(val) => {
                      setSelectedDate(val);
                      if (val) setMonth(val.slice(0, 7));
                    }}
                    placeholder="dd / mm / yyyy"
                    aria-label="Holiday Date"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Holiday Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={holidayType}
                    onChange={(event) => setHolidayType(event.target.value as HolidayType)}
                    className="mt-1.5 h-10 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-800 outline-none transition-colors focus:border-blue-400"
                  >
                    <option value="national">National Holiday</option>
                    <option value="festival">Festival</option>
                    <option value="special">Public Holiday</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Description
                </label>
                <textarea
                  maxLength={500}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Additional context or official gazette notes…"
                  className="mt-1.5 h-20 w-full resize-none rounded-md border border-slate-300 p-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-blue-400"
                />
              </div>


              <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  className="h-10 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={closeHolidayForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-800 px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
                >
                  {editingHolidayId ? "Save Changes" : "Create Holiday"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ── Import Holiday Calendar Modal ── */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowUpload(false);
          }}
        >
          <section
            className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="holiday-upload-title"
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <FileUp size={18} />
                </span>
                <div>
                  <h2 id="holiday-upload-title" className="text-base font-bold text-slate-800">
                    Import Holiday Calendar
                  </h2>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close file import"
                onClick={() => setShowUpload(false)}
                className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <X size={17} />
              </button>
            </div>

            {/* Source Tab Switcher */}
            <div className="mb-4 flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setUploadMode("file");
                  setUploadError("");
                  setUploadSuccess("");
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold transition-all ${uploadMode === "file" ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <FileSpreadsheet size={14} />
                <span>File (PDF / Excel / CSV / Image)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUploadMode("link");
                  setUploadError("");
                  setUploadSuccess("");
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold transition-all ${uploadMode === "link" ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <LinkIcon size={14} />
                <span>Web URL</span>
              </button>
            </div>

            {/* File Upload Tab */}
            {uploadMode === "file" ? (
              <div className="space-y-3">
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0] ?? null;
                    validateAndSetFile(file);
                  }}
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center cursor-pointer transition-colors hover:border-emerald-500 hover:bg-emerald-50/30"
                >
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <FileText size={20} />
                    <FileSpreadsheet size={20} />
                    <ImageIcon size={20} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    Click to browse or drop calendar file
                  </span>
                  <span className="mt-1 text-[11px] text-slate-400">
                    Supports .PDF, .XLSX, .XLS, .CSV, and image files (.PNG, .JPG) (Max 2 MB)
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      validateAndSetFile(file);
                    }}
                    className="sr-only"
                  />
                </label>

                {selectedFile && (
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-slate-800 truncate">{selectedFile.name}</span>
                      <span className="text-slate-400">({Math.round(selectedFile.size / 1024)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        setUploadError("");
                        setUploadSuccess("");
                      }}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1.5">
                  Calendar Document URL
                </label>
                <div className="relative">
                  <LinkIcon size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => {
                      setLinkUrl(e.target.value);
                      setUploadError("");
                      setUploadSuccess("");
                    }}
                    placeholder="https://example.com/calendar.pdf"
                    className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-400"
                  />
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="button"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isReadingFile || (uploadMode === "link" ? !linkUrl.trim() : !selectedFile)}
              onClick={readUpload}
            >
              {isReadingFile ? (
                <>
                  <Sparkles size={15} className="animate-spin" />
                  <span>{uploadProgress || "Extracting Holidays…"}</span>
                </>
              ) : (
                <>
                  <FileUp size={15} />
                  <span>Read & Import Holidays</span>
                </>
              )}
            </button>

            {/* Status alerts */}
            {uploadError && (
              <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                {uploadError}
              </p>
            )}
            {uploadProgress && (
              <p role="status" className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-700">
                {uploadProgress}
              </p>
            )}
            {uploadSuccess && (
              <p role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                {uploadSuccess}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
