"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bell, ChevronLeft, ChevronRight, Download, FileUp, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type HolidayType = "national" | "special" | "festival";
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
type ParsedHoliday = Pick<Holiday, "name" | "date" | "type" | "description" | "isHoliday">;

const storageKey = "leave-management-holidays";

const holidayTypeLabels: Record<HolidayType, string> = {
  national: "National holiday",
  special: "Academic event",
  festival: "Festival / Holiday",
};

const holidayTypeColors: Record<HolidayType, string> = {
  national: "bg-red-50 text-red-600",
  special: "bg-blue-50 text-blue-700",
  festival: "bg-emerald-50 text-emerald-700",
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2020, index, 1))
);

const monthNamesMap: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", options).format(new Date(`${value}T12:00:00`));
}

function classifyEvent(name: string): { type: HolidayType; isOfficialHoliday: boolean } {
  const lower = name.toLowerCase();
  const isOfficialHoliday = lower.includes("- holiday") || lower.includes("holiday");

  if (lower.includes("independence") || lower.includes("republic") || lower.includes("gandhi")) {
    return { type: "national", isOfficialHoliday: true };
  }
  if (
    lower.includes("pooja") || lower.includes("puja") || lower.includes("dasami") ||
    lower.includes("deepavali") || lower.includes("diwali") || lower.includes("muharram") ||
    lower.includes("milad") || lower.includes("chathurthi") || lower.includes("jayanthi") ||
    lower.includes("christmas") || lower.includes("pongal")
  ) {
    return { type: "festival", isOfficialHoliday: true };
  }
  return { type: "special", isOfficialHoliday };
}

interface PageData {
  text: string;
  pageNumber: number;
}

function parseCollegeCalendarPages(pages: PageData[], defaultYear = 2026): ParsedHoliday[] {
  const results: ParsedHoliday[] = [];
  let currentYear = defaultYear;
  let activeMonth = 6; // June default

  for (const page of pages) {
    const lines = page.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Look for header in the top 10 lines of each page
    let pageFirstMonth: number | null = null;
    let pageSecondMonth: number | null = null;

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      const headerMatch = line.match(
        /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)(?:\s*\/\s*(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER))?(?:\s+(\d{4}))?\b/i
      );

      if (headerMatch) {
        if (headerMatch[3]) currentYear = Number(headerMatch[3]);
        const m1 = monthNamesMap[headerMatch[1].toLowerCase()];
        if (m1) pageFirstMonth = m1;
        if (headerMatch[2]) {
          pageSecondMonth = monthNamesMap[headerMatch[2].toLowerCase()] ?? null;
        }
        break;
      }
    }

    if (pageFirstMonth) activeMonth = pageFirstMonth;

    // Parse each line on this page
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Identify whether this line has an entry (either explicitly ending with - Holiday or key event)
      const hasHoliday = /[-–—]\s*holiday\b/i.test(line);
      const isKeyEvent = /^(?:College reopens|Classes begin|Annual Staff Retreat|Senatus Meeting|ICA Test|Vinayakar|Gandhi|Ayutha|Vijaya|Deepavali|Milad|Krishna|Muharram|End of Semester Examinations|ESE Practicals|Study Holidays)\b/i.test(line);

      if (!hasHoliday && !isKeyEvent) continue;

      let dayNum: number | null = null;

      // Pattern 1: Same line has day and weekday: e.g. "15 SAT Independence Day - Holiday" or "SAT 15 ..."
      const sameLineMatch =
        line.match(/\b(\d{1,2})\s+(?:MON|TUE|WED|THU|FRI|SAT|SUN)\b/i) ||
        line.match(/\b(?:MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2})\b/i);

      if (sameLineMatch) {
        dayNum = Number(sameLineMatch[1]);
      } else {
        // Pattern 2: Day and weekday are on the immediate preceding line (e.g. line i-1 has "15 SAT")
        for (let lookback = 1; lookback <= 2; lookback++) {
          if (i - lookback < 0) break;
          const prev = lines[i - lookback];
          const prevMatch =
            prev.match(/\b(\d{1,2})\s+(?:MON|TUE|WED|THU|FRI|SAT|SUN)\b/i) ||
            prev.match(/\b(?:MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2})\b/i);
          if (prevMatch) {
            dayNum = Number(prevMatch[1]);
            break;
          }
        }
      }

      if (!dayNum || dayNum < 1 || dayNum > 31) continue;

      // Clean holiday/event name
      let cleanName = line
        .replace(/\b(\d{1,2})\s+(?:MON|TUE|WED|THU|FRI|SAT|SUN)\b/gi, "")
        .replace(/\b(?:MON|TUE|WED|THU|FRI|SAT|SUN)\s+(\d{1,2})\b/gi, "")
        .replace(/\s*[-–—]\s*holiday\b/i, "")
        .replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/gi, "")
        .replace(/^\d+\s*/, "")
        .replace(/\s+\d+\s*$/, "") // remove trailing order numbers like " 1" or " 6"
        .replace(/^[|•\s-]+/, "")
        .trim();

      if (!cleanName || cleanName.length < 3 || /^(?:date|day|page|working|semesters)\b/i.test(cleanName)) continue;

      // Handle split months like JUNE/JULY or SEPTEMBER/OCTOBER
      let targetMonth = activeMonth;
      if (pageSecondMonth && dayNum <= 15) {
        targetMonth = pageSecondMonth;
      }

      const formattedMonth = String(targetMonth).padStart(2, "0");
      const formattedDay = String(dayNum).padStart(2, "0");
      const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;

      const { type, isOfficialHoliday } = classifyEvent(line);

      results.push({
        name: cleanName,
        date: dateStr,
        type,
        description: isOfficialHoliday ? "Official College Holiday" : "Academic Schedule Event",
        isHoliday: isOfficialHoliday,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return results.filter((item) => {
    const key = `${item.date}|${item.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function extractPdfPages(file: File, onProgress: (message: string) => void): Promise<PageData[]> {
  if (file.size > 25 * 1024 * 1024) throw new Error("PDF files must be smaller than 25 MB.");

  const pdfjs = await import("pdfjs-dist");
  const pdfWorker = new Worker(new URL("/pdf.worker.min.mjs", window.location.origin), { type: "module" });
  pdfjs.GlobalWorkerOptions.workerPort = pdfWorker;

  let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
  const pages: PageData[] = [];

  try {
    loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const document = await loadingTask.promise;

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      onProgress(`Reading page ${pageNumber} of ${document.numPages}...`);
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const rawItems: { x: number; y: number; str: string }[] = [];
      for (const item of textContent.items) {
        if ("str" in item && item.str.trim()) {
          rawItems.push({
            x: Math.round(item.transform[4]),
            y: Math.round(item.transform[5]),
            str: item.str.trim(),
          });
        }
      }

      // Group words on the same line (within 4px Y)
      const groupedRows: { y: number; items: typeof rawItems }[] = [];
      for (const item of rawItems) {
        const existing = groupedRows.find((row) => Math.abs(row.y - item.y) <= 4);
        if (existing) {
          existing.items.push(item);
        } else {
          groupedRows.push({ y: item.y, items: [item] });
        }
      }

      // Sort lines top to bottom, words left to right
      const pageText = groupedRows
        .sort((a, b) => b.y - a.y)
        .map((row) =>
          row.items
            .sort((a, b) => a.x - b.x)
            .map((item) => item.str)
            .join(" ")
        )
        .join("\n");

      pages.push({ text: pageText, pageNumber });
    }
  } finally {
    await loadingTask?.destroy();
    pdfWorker.terminate();
    if (pdfjs.GlobalWorkerOptions.workerPort === pdfWorker) {
      pdfjs.GlobalWorkerOptions.workerPort = null;
    }
  }

  return pages;
}

export default function HolidayCalendarPage() {
  const [month, setMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
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
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(true);
  const [holidayError, setHolidayError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    let isMounted = true;
    const today = new Date();
    setMonth(dateKey(today).slice(0, 7));
    setSelectedDate(dateKey(today));
    const legacyHolidays: Omit<Holiday, "id">[] = [];
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) {
        const validHolidays = saved.filter(
          (item): item is Record<string, unknown> =>
            typeof item?.id === "string" &&
            typeof item?.name === "string" &&
            typeof item?.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        );
        legacyHolidays.push(...validHolidays.map((item) => ({
            name: item.name as string,
            date: item.date as string,
            type: item.type === "national" || item.type === "festival" ? item.type : "special" as HolidayType,
            description: typeof item.description === "string" ? item.description : "",
            repeatEveryYear: item.repeatEveryYear === true,
            status: item.status === "inactive" ? "inactive" : "active" as HolidayStatus,
            isHoliday: typeof item.isHoliday === "boolean"
              ? item.isHoliday
              : item.description === "Official College Holiday" || item.type === "national" || item.type === "festival",
          })));
      }
    } catch { /* Ignore invalid legacy browser data. */ }

    async function loadHolidays() {
      try {
        const response = await fetch("/api/holidays", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load holidays from the database.");

        let databaseHolidays = result as Holiday[];
        const existingKeys = new Set(databaseHolidays.map((holiday) => `${holiday.date}\0${holiday.name.toLowerCase()}`));
        const missingLegacyHolidays = legacyHolidays.filter((holiday) => {
          const key = `${holiday.date}\0${holiday.name.toLowerCase()}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });

        if (missingLegacyHolidays.length > 0) {
          const importResponse = await fetch("/api/holidays", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(missingLegacyHolidays),
          });
          const imported = await importResponse.json();
          if (!importResponse.ok) throw new Error(imported.error ?? "Unable to migrate saved holidays to the database.");
          databaseHolidays = [...databaseHolidays, ...(imported as Holiday[])];
        }

        if (!isMounted) return;
        setHolidays(databaseHolidays.sort((first, second) => first.date.localeCompare(second.date) || first.id - second.id));
        setHolidayError("");
        if (legacyHolidays.length > 0) localStorage.removeItem(storageKey);
      } catch (loadError) {
        if (isMounted) setHolidayError(loadError instanceof Error ? loadError.message : "Unable to load holidays from the database.");
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
      if (holiday.repeatEveryYear ? holidayMonth !== shownMonth.slice(5, 7) : !holiday.date.startsWith(shownMonth))
        return [];
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

  const baseRecords = recordsScope === "month"
    ? monthHolidays
    : holidays.filter((holiday) => holiday.isHoliday).map((h) => ({ ...h, displayDate: h.date })).sort((a, b) => a.displayDate.localeCompare(b.displayDate));

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
    const holidayName = name.trim();
    if (!holidayName || !selectedDate) return;
    const payload = {
      name: holidayName,
      date: selectedDate,
      type: holidayType,
      description: description.trim(),
      repeatEveryYear,
      status,
      isHoliday: holidayType !== "special",
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
      setHolidays((current) => isEditing
        ? current.map((holiday) => holiday.id === savedHoliday.id ? savedHoliday : holiday)
        : [...current, savedHoliday]);
    } catch (saveError) {
      setHolidayError(saveError instanceof Error ? saveError.message : "Unable to save holiday.");
      return;
    }
    setEditingHolidayId(null);
    setName("");
    setHolidayType("national");
    setDescription("");
    setRepeatEveryYear(false);
    setStatus("active");
    setShowForm(false);
  }

  async function resetHolidays() {
    if (!holidays.length || !window.confirm("Delete all holidays and events from the calendar and table?")) return;
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
    setName(holiday.name);
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
        holiday.displayDate,
        holiday.name,
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

  async function readUpload() {
    if (!selectedFile) {
      setUploadError("Choose a PDF file first.");
      return;
    }
    setIsReadingFile(true);
    setUploadError("");
    setUploadProgress("Extracting text across all pages...");

    try {
      const extractedPages = await extractPdfPages(selectedFile, setUploadProgress);
      const parsedRows = parseCollegeCalendarPages(extractedPages, year);

      if (parsedRows.length === 0) {
        throw new Error("No holidays or events were detected in this calendar PDF.");
      }

      const known = new Set(holidays.map((h) => `${h.date}\0${h.name.toLowerCase()}`));
      const candidates = parsedRows.filter((row) => {
        const key = `${row.date}\0${row.name.toLowerCase()}`;
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });

      if (candidates.length === 0) {
        throw new Error("All detected dates are already present in your calendar.");
      }

      const imported: Omit<Holiday, "id">[] = candidates.map((row) => ({
        name: row.name,
        date: row.date,
        type: row.type,
        description: row.description,
        repeatEveryYear: false,
        status: "active",
        isHoliday: row.isHoliday,
      }));

      imported.sort((a, b) => a.date.localeCompare(b.date));

      const response = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imported),
      });
      const savedHolidays = await response.json();
      if (!response.ok) throw new Error(savedHolidays.error ?? "Unable to save imported holidays to the database.");
      const savedRecords = savedHolidays as Holiday[];
      setHolidays((current) => [...current, ...savedRecords]);
      setMonth(savedRecords[0].date.slice(0, 7));
      setSelectedDate(savedRecords[0].date);
      setSelectedFile(null);
      setUploadSuccess(`Successfully imported ${imported.length} events and holidays with exact dates!`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadProgress("");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to read this file.");
      setUploadSuccess("");
      setUploadProgress("");
    } finally {
      setIsReadingFile(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#e9edf3] text-slate-800">
      <LeaveSidebar activePage="holiday-calendar" />
      <div className="ml-0 min-w-0 w-full min-[801px]:ml-[175px] min-[801px]:w-[calc(100%-175px)]">
        <header className="flex h-[66px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-[22px]">
          <span className="text-[13px] font-semibold text-slate-700">Leave Management</span>
          <div className="flex items-center gap-3 text-[13px] text-slate-700 sm:gap-[15px]">
            <span className="hidden sm:inline">Admin</span>
            <span className="relative grid place-items-center" aria-label="Notifications">
              <Bell size={17} />
              <i className="absolute right-0 top-0 size-1.5 rounded-full bg-red-500" />
            </span>
            <span className="grid size-7 place-items-center rounded-full bg-[#173c6b] text-xs text-white" aria-label="Administrator">A</span>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-[18px] pb-[30px] pt-[14px] max-sm:px-[9px]">
          <div className="mb-[7px] text-[11px] text-slate-500">
            Dashboard <span className="mx-[7px]">›</span> Holidays <span className="mx-[7px]">›</span> <b className="text-slate-700">Calendar</b>
          </div>

          <header className="mb-[13px] flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h1 className="mb-1 text-3xl font-bold text-slate-800">Holiday Calendar</h1>
              <p className="m-0 text-sm text-slate-600">Manage holidays and view them across the semester.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="sr-only" htmlFor="calendar-month">Month</label>
              <select
                id="calendar-month"
                value={monthIndex}
                onChange={(event) => {
                  const value = `${year}-${String(Number(event.target.value) + 1).padStart(2, "0")}`;
                  setMonth(value);
                  setSelectedDate(`${value}-01`);
                }}
                className="h-10 min-w-[120px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                {months.map((monthName, index) => (
                  <option key={monthName} value={index}>{monthName}</option>
                ))}
              </select>

              <label className="sr-only" htmlFor="calendar-year">Year</label>
              <select
                id="calendar-year"
                value={year}
                onChange={(event) => {
                  const value = `${event.target.value}-${String(monthIndex + 1).padStart(2, "0")}`;
                  setMonth(value);
                  setSelectedDate(`${value}-01`);
                }}
                className="h-10 min-w-[90px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                {years.sort((first, second) => first - second).map((yearOption) => (
                  <option key={yearOption} value={yearOption}>{yearOption}</option>
                ))}
              </select>

              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => { setShowUpload(true); setShowForm(false); }}
              >
                <FileUp size={16} />Import
              </button>
              <button
                type="button"
                disabled={holidays.length === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={resetHolidays}
              >
                <RotateCcw size={16} />Reset
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700"
                onClick={() => { setShowForm(true); setShowUpload(false); }}
              >
                <Plus size={16} />Add holiday
              </button>
            </div>
          </header>

          {holidayError && <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{holidayError}</p>}

          <section className="grid min-h-[390px] grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white xl:grid-cols-[minmax(0,1fr)_340px]" aria-label="Holiday calendar">
            <div className="min-w-0 p-[13px_10px_10px]">
              <div className="relative mb-1.5 flex min-h-10 flex-wrap items-center justify-center gap-2.5 max-sm:justify-start">
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Previous month"
                  onClick={() => changeMonth(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <h2 className="m-0 min-w-[125px] text-center text-lg font-semibold max-sm:min-w-0">{monthTitle}</h2>
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  aria-label="Next month"
                  onClick={() => changeMonth(1)}
                >
                  <ChevronRight size={16} />
                </button>

                <div className="ml-auto flex overflow-hidden rounded-md border border-slate-200 max-sm:ml-0 max-sm:w-full max-sm:justify-center" role="group" aria-label="Calendar view">
                  {(["month", "list", "year"] as const).map((viewOption) => (
                    <button
                      key={viewOption}
                      type="button"
                      aria-pressed={view === viewOption}
                      onClick={() => setView(viewOption)}
                      className={`h-8 border-r border-slate-200 bg-white px-3 text-sm text-slate-700 last:border-0 ${view === viewOption ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-400" : ""}`}
                    >
                      {viewOption[0].toUpperCase() + viewOption.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {view === "month" && (
                <div className="grid grid-cols-7 border-l border-t border-slate-200">
                  {weekdays.map((day) => (
                    <div className="flex h-10 items-center justify-center border-b border-r border-slate-200 text-sm font-semibold text-slate-700" key={day}>
                      {day}
                    </div>
                  ))}
                  {days.map((day, index) => {
                    const value = day ? `${shownMonth}-${String(day).padStart(2, "0")}` : "";
                    const dayHolidays = monthHolidays.filter((holiday) => holiday.displayDate === value && holiday.status === "active");
                    const today = value === dateKey(new Date());

                    return (
                      <div key={index} className={`relative min-h-[96px] border-b border-r border-slate-200 bg-white p-2 max-sm:min-h-[84px] max-sm:p-1.5 ${selectedDate === value ? "bg-emerald-50" : ""}`}>
                        {day && (
                          <>
                            <button
                              type="button"
                              className={`mb-1 block border-0 bg-transparent p-0 text-sm font-medium text-slate-700 ${today ? "font-bold text-emerald-800" : ""}`}
                              aria-label={`Select ${value}`}
                              aria-pressed={selectedDate === value}
                              onClick={() => setSelectedDate(value)}
                            >
                              {day}
                            </button>
                            <div className="flex flex-col gap-1">
                              {dayHolidays.slice(0, 2).map((holiday) => (
                                <span
                                  key={holiday.id}
                                  className={`block max-w-full truncate rounded px-1.5 py-0.5 text-sm font-medium ${holidayTypeColors[holiday.type]}`}
                                  title={holiday.name}
                                >
                                  {holiday.name}
                                </span>
                              ))}
                              {dayHolidays.length > 2 && <span className="text-sm text-slate-500">+{dayHolidays.length - 2} more</span>}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {view === "list" && (
                <div className="h-[616px] overflow-y-auto overscroll-contain p-3 max-sm:h-[544px]" aria-label={`Daily schedule for ${monthTitle}`}>
                  <div className="mb-2 flex items-center justify-between border-b border-slate-200 px-2 py-3">
                    <h3 className="m-0 text-base font-semibold text-slate-800">Daily schedule · {monthTitle}</h3>
                    <span className="text-sm text-slate-500">{daysCount} days</span>
                  </div>
                  <div className="grid grid-cols-[72px_90px_minmax(0,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-2 py-2 text-sm font-medium text-slate-600 max-sm:grid-cols-[64px_76px_minmax(0,1fr)]">
                    <span>Date</span><span>Day</span><span>Holiday / Event</span>
                  </div>
                  {listDays.map((listDay) => {
                    const dayHolidays = listDay.holidays;
                    return (
                      <div className="grid min-h-12 grid-cols-[72px_90px_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 px-2 py-2 text-sm max-sm:grid-cols-[64px_76px_minmax(0,1fr)]" key={listDay.date}>
                        <time dateTime={listDay.date} className="font-medium text-slate-800">
                          {formatDate(listDay.date, { day: "numeric", month: "short" })}
                        </time>
                        <span className="text-slate-600">{formatDate(listDay.date, { weekday: "short" })}</span>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {dayHolidays.map((holiday) => (
                            <span
                              key={holiday.id}
                              className={`max-w-full truncate rounded px-2 py-1 text-sm ${holidayTypeColors[holiday.type]}`}
                              title={`${holiday.name}${holiday.status === "inactive" ? " (inactive)" : ""}`}
                            >
                              {holiday.name}{holiday.status === "inactive" ? " · Inactive" : ""}
                            </span>
                          ))}
                          {dayHolidays.length === 0 && <span className="text-slate-400">-</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {view === "year" && (
                <div className="grid min-h-[330px] grid-cols-2 gap-3 p-[18px] sm:grid-cols-3 xl:grid-cols-4">
                  {months.map((monthName, index) => {
                    const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
                    const count = holidays.filter((holiday) => holiday.isHoliday && holiday.status === "active" && (holiday.repeatEveryYear ? holiday.date.slice(5, 7) === monthKey.slice(5, 7) : holiday.date.startsWith(monthKey))).length;
                    return (
                      <button
                        key={monthName}
                        type="button"
                        className="min-h-[100px] rounded-md border border-slate-200 bg-white p-3 text-left text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                        onClick={() => { setMonth(monthKey); setSelectedDate(`${monthKey}-01`); setView("month"); }}
                      >
                        <strong className="mb-2 block text-xs font-semibold text-slate-800">{monthName}</strong>
                        <span className="text-[10px] text-slate-500">{count} {count === 1 ? "entry" : "entries"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <aside className="border-t border-slate-200 bg-white px-[13px] pt-[13px] xl:border-l xl:border-t-0" aria-label={`Holidays in ${monthTitle}`}>
              <div className="mb-[15px] flex items-center justify-between gap-2">
                <h3 className="m-0 text-base font-semibold">Holidays & Events</h3>
                <span className="text-xs text-slate-500">{monthTitle} · {monthHolidays.length}</span>
              </div>
              <div className="grid grid-cols-[68px_minmax(0,1fr)_85px_28px] gap-[5px] border-b border-slate-100 pb-[7px] text-sm font-medium text-slate-600 xl:grid-cols-[76px_minmax(0,1fr)_100px_28px]">
                <span>Date</span><span>Event</span><span>Type</span><span />
              </div>
              {monthHolidays.length ? monthHolidays.map((holiday) => (
                <div className="grid min-h-[68px] grid-cols-[68px_minmax(0,1fr)_85px_28px] items-center gap-[5px] border-b border-slate-100 text-sm xl:grid-cols-[76px_minmax(0,1fr)_100px_28px]" key={holiday.id}>
                  <div className="flex flex-col">
                    <b className="text-sm text-slate-700">{formatDate(holiday.displayDate, { day: "numeric", month: "short" })}</b>
                    <small className="mt-0.5 text-xs text-slate-500">{formatDate(holiday.displayDate, { weekday: "short" })}</small>
                  </div>
                  <span className="truncate" title={holiday.name}>{holiday.name}</span>
                  <span className={`w-fit truncate rounded px-1.5 py-1 text-xs ${holidayTypeColors[holiday.type]}`}>{holidayTypeLabels[holiday.type].replace(" holiday", "")}</span>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="grid size-6 place-items-center rounded border border-red-100 bg-red-50 text-red-500 hover:bg-red-100"
                      aria-label={`Remove ${holiday.name}`}
                      onClick={() => setHolidays((current) => current.filter((item) => item.id !== holiday.id))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )) : (
                <p className="px-1 py-6 text-center text-sm text-slate-500">No events or holidays in this month.</p>
              )}
            </aside>
          </section>

          <section className="mt-[13px] overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="holiday-records-title">
            <div className="flex items-center justify-between px-[13px] pb-2 pt-[13px]">
              <h2 id="holiday-records-title" className="m-0 text-lg font-semibold">Holiday & Event records</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Showing:</span>
                <button
                  type="button"
                  onClick={() => setRecordsScope("month")}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${recordsScope === "month" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {monthTitle}
                </button>
                <button
                  type="button"
                  onClick={() => setRecordsScope("all")}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${recordsScope === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  All Months ({holidays.filter((holiday) => holiday.isHoliday).length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 px-[13px] pb-[13px] pt-[7px] sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_155px_145px_auto]">
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 text-slate-400">
                <Search size={16} />
                <input
                  aria-label="Search holidays"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search holidays and events"
                  className="h-full w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>
              <select
                aria-label="Filter by type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "all" | HolidayType)}
                className="h-10 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700"
              >
                <option value="all">All types</option>
                <option value="national">National holiday</option>
                <option value="special">Academic event</option>
                <option value="festival">Festival / Holiday</option>
              </select>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | HolidayStatus)}
                className="h-10 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={exportHolidays}
              >
                <Download size={16} />Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                <div className="grid h-11 grid-cols-[repeat(7,minmax(0,1fr))] items-center gap-[7px] border-y border-slate-100 bg-slate-50 px-[13px] text-sm font-semibold text-slate-600">
                  <span>#</span><span>Date</span><span>Holiday / Event</span><span>Type</span><span>Description</span><span>Status</span><span>ACTIONS</span>
                </div>
                {filteredHolidays.length ? filteredHolidays.map((holiday, index) => (
                  <div className="grid min-h-11 grid-cols-[repeat(7,minmax(0,1fr))] items-center gap-[7px] border-b border-slate-100 px-[13px] text-sm text-slate-700" key={holiday.id}>
                    <span>{index + 1}</span>
                    <span className="whitespace-nowrap">{formatDate(holiday.displayDate, { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="truncate font-medium" title={holiday.name}>{holiday.name}</span>
                    <span className={`w-fit truncate rounded px-1.5 py-1 text-sm ${holidayTypeColors[holiday.type]}`}>{holidayTypeLabels[holiday.type]}</span>
                    <span className="truncate text-slate-500" title={holiday.description}>{holiday.description || "-"}</span>
                    <span className={`w-fit rounded px-2 py-1 text-sm ${holiday.status === "inactive" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                      {holiday.status}
                    </span>
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => editHoliday(holiday)} className="grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={`Edit ${holiday.name}`} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => deleteHoliday(holiday.id)} className="grid size-7 place-items-center rounded text-red-500 hover:bg-red-50" aria-label={`Delete ${holiday.name}`} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                )) : isLoadingHolidays ? (
                  <p role="status" className="px-[13px] py-[22px] text-center text-[11px] text-slate-500">Loading holidays...</p>
                ) : (
                  <p className="px-[13px] py-[22px] text-center text-[11px] text-slate-500">No records match these filters.</p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-5"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeHolidayForm(); }}
        >
          <section className="max-h-[90vh] w-full max-w-[450px] overflow-y-auto rounded-xl bg-white p-[22px] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="holiday-form-title">
            <div className="mb-5 flex justify-between gap-3">
              <div>
                <h2 id="holiday-form-title" className="m-0 text-lg font-semibold text-slate-800">{editingHolidayId ? "Edit holiday" : "New holiday"}</h2>
                <p className="mt-1 text-[11px] text-slate-500">{editingHolidayId ? "Update this holiday or event." : "Add a date-specific holiday to the calendar."}</p>
              </div>
              <button
                type="button"
                aria-label="Close holiday form"
                onClick={closeHolidayForm}
                className="grid size-[30px] place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <X size={17} />
              </button>
            </div>
            <form onSubmit={addHoliday}>
              <label className="mb-[13px] block text-[11px] font-semibold text-slate-700">
                Holiday name
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Founders' Day"
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal outline-none focus:border-emerald-500"
                />
              </label>

              <label className="mb-[13px] block text-[11px] font-semibold text-slate-700">
                Holiday date
                <input
                  required
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedDate(value);
                    if (value) setMonth(value.slice(0, 7));
                  }}
                  className="mt-1.5 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal outline-none focus:border-emerald-500"
                />
              </label>

              <label className="mb-[13px] block text-[11px] font-semibold text-slate-700">
                Holiday type
                <select
                  required
                  value={holidayType}
                  onChange={(event) => setHolidayType(event.target.value as HolidayType)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal outline-none focus:border-emerald-500"
                >
                  <option value="national">National holiday</option>
                  <option value="special">Academic event</option>
                  <option value="festival">Festival</option>
                </select>
              </label>

              <label className="mb-[13px] block text-[11px] font-semibold text-slate-700">
                Description
                <textarea
                  required
                  maxLength={500}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe this holiday"
                  className="mt-1.5 h-[75px] w-full resize-y rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal outline-none focus:border-emerald-500"
                />
              </label>

              <div className="mb-[13px] flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">Repeating every year</span>
                <button
                  type="button"
                  role="switch"
                  aria-label="Repeating every year"
                  aria-checked={repeatEveryYear}
                  className={`relative h-[22px] w-10 rounded-full border-0 ${repeatEveryYear ? "bg-emerald-700" : "bg-slate-300"}`}
                  onClick={() => setRepeatEveryYear((value) => !value)}
                >
                  <span className={`absolute top-[3px] size-4 rounded-full bg-white transition-transform ${repeatEveryYear ? "translate-x-[18px]" : "left-[3px]"}`} />
                </button>
              </div>

              <fieldset className="mb-3 border-0 p-0">
                <legend className="mb-2 text-[11px] font-semibold text-slate-700">Status</legend>
                <div className="flex gap-2">
                  <label className={`flex flex-1 items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] font-medium ${status === "active" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700"}`}>
                    <input
                      required
                      type="radio"
                      name="holiday-status"
                      value="active"
                      checked={status === "active"}
                      onChange={() => setStatus("active")}
                      className="size-4 accent-emerald-700"
                    />
                    Active
                  </label>
                  <label className={`flex flex-1 items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] font-medium ${status === "inactive" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700"}`}>
                    <input
                      required
                      type="radio"
                      name="holiday-status"
                      value="inactive"
                      checked={status === "inactive"}
                      onChange={() => setStatus("inactive")}
                      className="size-4 accent-emerald-700"
                    />
                    Inactive
                  </label>
                </div>
              </fieldset>

              <div className="mt-[18px] flex justify-end gap-2">
                <button
                  type="button"
                  className="h-8 rounded-md border border-slate-300 bg-white px-3.5 text-[11px] text-slate-700 hover:bg-slate-50"
                  onClick={closeHolidayForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-3.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                >
                  {editingHolidayId ? "Save changes" : <><Plus size={14} />Create holiday</>}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showUpload && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-5"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setShowUpload(false); }}
        >
          <section className="max-h-[90vh] w-full max-w-[450px] overflow-y-auto rounded-xl bg-white p-[22px] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="holiday-upload-title">
            <div className="mb-5 flex justify-between gap-3">
              <div>
                <h2 id="holiday-upload-title" className="m-0 text-lg font-semibold text-slate-800">Import holidays & events</h2>
                <p className="mt-1 text-[11px] text-slate-500">Read academic schedule and holidays across all months from PDF.</p>
              </div>
              <button
                type="button"
                aria-label="Close file import"
                onClick={() => setShowUpload(false)}
                className="grid size-[30px] place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <X size={17} />
              </button>
            </div>
            <label className="block rounded-md border border-dashed border-slate-400 bg-slate-50 p-4 text-center text-[11px] text-slate-600">
              <FileUp size={20} className="mx-auto mb-2 text-slate-500" />
              Choose academic calendar PDF
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                    setSelectedFile(null);
                    setUploadError("Only PDF files are supported.");
                    setUploadSuccess("");
                    event.target.value = "";
                    return;
                  }
                  setSelectedFile(file);
                  setUploadError("");
                  setUploadSuccess("");
                }}
                className="mt-2 w-full text-[11px]"
              />
            </label>
            <button
              type="button"
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-3.5 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isReadingFile || !selectedFile}
              onClick={readUpload}
            >
              <FileUp size={14} />{isReadingFile ? "Reading PDF..." : "Read PDF"}
            </button>
            {uploadError && <p role="alert" className="mt-2.5 text-[11px] text-red-700">{uploadError}</p>}
            {uploadProgress && <p role="status" className="mt-2.5 text-[11px] text-slate-600">{uploadProgress}</p>}
            {uploadSuccess && <p role="status" className="mt-2.5 text-[11px] text-emerald-700">{uploadSuccess}</p>}
          </section>
        </div>
      )}
    </div>
  );
}