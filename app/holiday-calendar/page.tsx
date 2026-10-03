"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bell, ChevronLeft, ChevronRight, Download, FileUp, Plus, Search, Trash2, X } from "lucide-react";
import LeaveSidebar from "../components/LeaveSidebar";

type HolidayType = "national" | "special" | "festival";
type HolidayStatus = "active" | "inactive";
type Holiday = {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  description: string;
  repeatEveryYear: boolean;
  status: HolidayStatus;
};
type ParsedHoliday = Pick<Holiday, "name" | "date">;
const storageKey = "leave-management-holidays";
const holidayTypeLabels: Record<HolidayType, string> = {
  national: "National holiday",
  special: "Special holiday",
  festival: "Festival",
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
const datePattern = /\b(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}[-/.](?:19|20)\d{2}\b|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:[,]?\s+(?:19|20)\d{2})?\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?(?:[,]?\s+(?:19|20)\d{2})?\b/gi;
const monthNumbers: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function parseDate(value: string, fallbackYear = new Date().getFullYear()): string | null {
  let year: number;
  let month: number;
  let day: number;
  let match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else if ((match = value.match(/^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})$/))) {
    const first = Number(match[1]);
    const second = Number(match[3]);
    year = Number(match[4]);
    const dayFirst = first > 12 || (second <= 12 && match[2] !== "/");
    month = dayFirst ? second : first;
    day = dayFirst ? first : second;
  } else {
    match = value.match(/^(?:(\w+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,]?\s+((?:19|20)\d{2}))?|(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\.?(?:[,]?\s+((?:19|20)\d{2}))?)$/i);
    if (!match) return null;
    month = monthNumbers[(match[1] ?? match[5]).toLowerCase()];
    day = Number(match[2] ?? match[4]);
    year = Number(match[3] ?? match[6] ?? fallbackYear);
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return dateKey(date);
}

function cleanHolidayName(value: string) {
  return value
    .replace(/^(?:holiday|holidays|occasion|event|festival)(?:\s+name)?\s*[:|–—-]\s*/i, "")
    .replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b\.?/gi, " ")
    .replace(/^[\s,;|:–—-]+|[\s,;|:–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isHolidayName(value: string) {
  return Boolean(value) &&
    !/^(?:date|day|holiday|holidays|name|occasion|event|festival|weekday|from\b.*|to\b.*)$/i.test(value);
}

function containsHolidayDate(value: string) {
  return new RegExp(datePattern.source, datePattern.flags).test(value);
}

function parseHolidayText(text: string, fallbackYear = new Date().getFullYear()) {
  const found: ParsedHoliday[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const match of line.matchAll(datePattern)) {
      const date = parseDate(match[0], fallbackYear);
      let name = cleanHolidayName(line.replace(match[0], " "));
      if (!isHolidayName(name)) {
        const neighboringLines = [lineIndex + 1, lineIndex + 2, lineIndex - 1];
        for (const neighborIndex of neighboringLines) {
          const neighbor = lines[neighborIndex];
          if (neighbor && !containsHolidayDate(neighbor)) {
            const candidateName = cleanHolidayName(neighbor);
            if (isHolidayName(candidateName)) {
              name = candidateName;
              break;
            }
          }
        }
      }
      if (date && isHolidayName(name)) found.push({ date, name });
    }
  }
  return found;
}

async function extractPdfText(file: File, onProgress: (message: string) => void, fallbackYear: number) {
  if (file.size > 15 * 1024 * 1024) throw new Error("PDF files must be smaller than 15 MB.");
  const pdfjs = await import("pdfjs-dist");
  const pdfWorker = new Worker(new URL("/pdf.worker.min.mjs", window.location.origin), { type: "module" });
  pdfjs.GlobalWorkerOptions.workerPort = pdfWorker;
  let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
  let ocrWorker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | undefined;
  const pages: string[] = [];
  try {
    loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    const document = await loadingTask.promise;
    if (document.numPages > 25) throw new Error("PDFs are limited to 25 pages for browser-based OCR.");

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress(`Reading page ${pageNumber} of ${document.numPages}...`);
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines = new Map<number, string[]>();
      for (const item of textContent.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        lines.set(y, [...(lines.get(y) ?? []), item.str.trim()]);
      }
      const pageText = [...lines.entries()]
        .sort(([firstY], [secondY]) => secondY - firstY)
        .map(([, words]) => words.join(" "))
        .join("\n");

      if (pageText.trim() && parseHolidayText(pageText, fallbackYear).length > 0) {
        pages.push(pageText);
        continue;
      }

      onProgress(`Preparing OCR for page ${pageNumber} of ${document.numPages}...`);
      if (!ocrWorker) {
        const { createWorker, OEM } = await import("tesseract.js");
        ocrWorker = await createWorker("eng", OEM.LSTM_ONLY, {
          logger: ({ status, progress }) => onProgress(`${status}${progress ? ` (${Math.round(progress * 100)}%)` : ""}`),
        });
      }
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to render a PDF page for OCR.");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const result = await ocrWorker.recognize(canvas);
      pages.push(result.data.text);
    }
  } finally {
    await ocrWorker?.terminate();
    await loadingTask?.destroy();
    pdfWorker.terminate();
    if (pdfjs.GlobalWorkerOptions.workerPort === pdfWorker) {
      pdfjs.GlobalWorkerOptions.workerPort = null;
    }
  }

  return pages.join("\n");
}

async function extractImageText(file: File, onProgress: (message: string) => void) {
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    logger: ({ status, progress }) => onProgress(`${status}${progress ? ` (${Math.round(progress * 100)}%)` : ""}`),
  });
  try {
    return (await worker.recognize(file)).data.text;
  } finally {
    await worker.terminate();
  }
}

async function readHolidayFile(file: File, onProgress: (message: string) => void, fallbackYear: number): Promise<ParsedHoliday[]> {
  if (file.size > 15 * 1024 * 1024) throw new Error("Files must be smaller than 15 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return parseHolidayText(await extractPdfText(file, onProgress, fallbackYear), fallbackYear);
  if (file.type.startsWith("image/")) return parseHolidayText(await extractImageText(file, onProgress), fallbackYear);
  if (extension === "json") {
    const data: unknown = JSON.parse(await file.text());
    const items = Array.isArray(data)
      ? data
      : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).holidays)
        ? (data as { holidays: unknown[] }).holidays
        : [data];
    return items.flatMap((item): ParsedHoliday[] => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const rawDate = record.date ?? record.holidayDate ?? record.holiday_date;
      const rawName = record.name ?? record.holiday ?? record.title;
      if (typeof rawDate !== "string" || typeof rawName !== "string") return [];
      const date = parseDate(rawDate.slice(0, 10), fallbackYear);
      const name = cleanHolidayName(rawName);
      return date && isHolidayName(name) ? [{ date, name }] : [];
    });
  }
  const text = await file.text();
  const rows = parseHolidayText(text, fallbackYear);
  if (rows.length) return rows;
  throw new Error("No dated holiday rows found. Use a text-based PDF, CSV, TXT, Markdown, or JSON file.");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", options).format(new Date(`${value}T12:00:00`));
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
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const today = new Date();
    setMonth(dateKey(today).slice(0, 7));
    setSelectedDate(dateKey(today));
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) {
        const validHolidays = saved.filter((item): item is Record<string, unknown> =>
          typeof item?.id === "string" && typeof item?.name === "string" &&
          typeof item?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        );
        setHolidays(validHolidays.map((item) => ({
          id: item.id as string,
          name: item.name as string,
          date: item.date as string,
          type: item.type === "national" || item.type === "festival" ? item.type : "special",
          description: typeof item.description === "string" ? item.description : "",
          repeatEveryYear: item.repeatEveryYear === true,
          status: item.status === "inactive" ? "inactive" : "active",
        })));
      }
    } catch {
      setHolidays([]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(holidays));
  }, [holidays, ready]);

  const shownMonth = month || dateKey(new Date()).slice(0, 7);
  const monthDate = new Date(`${shownMonth}-01T12:00:00`);
  const year = monthDate.getFullYear();
  const monthIndex = monthDate.getMonth();
  const monthTitle = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(monthDate);
  const years = Array.from({ length: 21 }, (_, index) => new Date().getFullYear() - 10 + index);
  if (!years.includes(year)) years.push(year);
  const monthHolidays = holidays.flatMap((holiday) => {
    const holidayMonth = holiday.date.slice(5, 7);
    if (holiday.repeatEveryYear ? holidayMonth !== shownMonth.slice(5, 7) : !holiday.date.startsWith(shownMonth)) return [];
    const displayDate = holiday.repeatEveryYear ? `${shownMonth}-${holiday.date.slice(8, 10)}` : holiday.date;
    const displayDateValue = new Date(`${displayDate}T12:00:00`);
    if (dateKey(displayDateValue) !== displayDate) return [];
    return [{ ...holiday, displayDate }];
  }).sort((a, b) => a.displayDate.localeCompare(b.displayDate));
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
  const filteredHolidays = monthHolidays.filter((holiday) => {
    const query = search.trim().toLowerCase();
    return (!query || holiday.name.toLowerCase().includes(query) || holiday.description.toLowerCase().includes(query)) &&
      (typeFilter === "all" || holiday.type === typeFilter) &&
      (statusFilter === "all" || holiday.status === statusFilter);
  });

  function addHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const holidayName = name.trim();
    if (!holidayName || !selectedDate) return;
    setHolidays((current) => [...current, {
      id: `${Date.now()}-${Math.random()}`,
      name: holidayName,
      date: selectedDate,
      type: holidayType,
      description: description.trim(),
      repeatEveryYear,
      status,
    }]);
    setName("");
    setHolidayType("national");
    setDescription("");
    setRepeatEveryYear(false);
    setStatus("active");
    setShowForm(false);
  }

  function closeHolidayForm() {
    setShowForm(false);
    setName("");
    setHolidayType("national");
    setDescription("");
    setRepeatEveryYear(false);
    setStatus("active");
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
    link.download = `holidays-${shownMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function readUpload() {
    if (!selectedFile) {
      setUploadError("Choose a file first.");
      return;
    }
    setIsReadingFile(true);
    setUploadError("");
    setUploadProgress("Reading file...");
    try {
      const rows = await readHolidayFile(selectedFile, setUploadProgress, year);
      const known = new Set(holidays.map((holiday) => `${holiday.date}\0${holiday.name.toLowerCase()}`));
      const candidates = rows.filter((row) => {
        const key = `${row.date}\0${row.name.toLowerCase()}`;
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });
      if (candidates.length === 0) throw new Error("No new holiday dates were found in this file.");
      const imported: Holiday[] = candidates.map((holiday) => ({
        ...holiday,
        id: `${Date.now()}-${Math.random()}`,
        type: "special",
        description: "Imported from holiday file",
        repeatEveryYear: false,
        status: "active",
      }));
      setHolidays((current) => [...current, ...imported]);
      setMonth(imported[0].date.slice(0, 7));
      setSelectedDate(imported[0].date);
      setSelectedFile(null);
      setUploadSuccess(`Added ${imported.length} holiday${imported.length === 1 ? "" : "s"} from the file.`);
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
            <span className="relative grid place-items-center" aria-label="Notifications"><Bell size={17} /><i className="absolute right-0 top-0 size-1.5 rounded-full bg-red-500" /></span>
            <span className="grid size-7 place-items-center rounded-full bg-[#173c6b] text-xs text-white" aria-label="Administrator">A</span>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-[18px] pb-[30px] pt-[14px] max-sm:px-[9px]">
          <div className="mb-[7px] text-[11px] text-slate-500">Dashboard <span className="mx-[7px]">›</span> Holidays <span className="mx-[7px]">›</span> <b className="text-slate-700">Calendar</b></div>
          <header className="mb-[13px] flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h1 className="mb-1 text-3xl font-bold text-slate-800">Holiday Calendar</h1>
              <p className="m-0 text-sm text-slate-600">Manage holidays and view them across the year.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="sr-only" htmlFor="calendar-month">Month</label>
              <select id="calendar-month" value={monthIndex} onChange={(event) => {
                const value = `${year}-${String(Number(event.target.value) + 1).padStart(2, "0")}`;
                setMonth(value);
                setSelectedDate(`${value}-01`);
              }} className="h-10 min-w-[120px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none">
                {months.map((monthName, index) => <option key={monthName} value={index}>{monthName}</option>)}
              </select>
              <label className="sr-only" htmlFor="calendar-year">Year</label>
              <select id="calendar-year" value={year} onChange={(event) => {
                const value = `${event.target.value}-${String(monthIndex + 1).padStart(2, "0")}`;
                setMonth(value);
                setSelectedDate(`${value}-01`);
              }} className="h-10 min-w-[90px] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none">
                {years.sort((first, second) => first - second).map((yearOption) => <option key={yearOption} value={yearOption}>{yearOption}</option>)}
              </select>
              <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setShowUpload(true); setShowForm(false); }}><FileUp size={16} />Import</button>
              <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700" onClick={() => { setShowForm(true); setShowUpload(false); }}><Plus size={16} />Add holiday</button>
            </div>
          </header>

          <section className="grid min-h-[390px] grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white xl:grid-cols-[minmax(0,1fr)_340px]" aria-label="Holiday calendar">
            <div className="min-w-0 p-[13px_10px_10px]">
              <div className="relative mb-1.5 flex min-h-10 flex-wrap items-center justify-center gap-2.5 max-sm:justify-start">
                <button type="button" className="grid size-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
                <h2 className="m-0 min-w-[125px] text-center text-lg font-semibold max-sm:min-w-0">{monthTitle}</h2>
                <button type="button" className="grid size-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
                <div className="ml-auto flex overflow-hidden rounded-md border border-slate-200 max-sm:ml-0 max-sm:w-full max-sm:justify-center" role="group" aria-label="Calendar view">
                  {(["month", "list", "year"] as const).map((viewOption) => <button key={viewOption} type="button" aria-pressed={view === viewOption} onClick={() => setView(viewOption)} className={`h-8 border-r border-slate-200 bg-white px-3 text-sm text-slate-700 last:border-0 ${view === viewOption ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-400" : ""}`}>{viewOption[0].toUpperCase() + viewOption.slice(1)}</button>)}
                </div>
              </div>

              {view === "month" && <div className="grid grid-cols-7 border-l border-t border-slate-200">
                {weekdays.map((day) => <div className="flex h-10 items-center justify-center border-b border-r border-slate-200 text-sm font-semibold text-slate-700" key={day}>{day}</div>)}
                {days.map((day, index) => {
                  const value = day ? `${shownMonth}-${String(day).padStart(2, "0")}` : "";
                  const dayHolidays = monthHolidays.filter((holiday) => holiday.displayDate === value && holiday.status === "active");
                  const today = value === dateKey(new Date());
                  return <div key={index} className={`relative min-h-[96px] border-b border-r border-slate-200 bg-white p-2 max-sm:min-h-[84px] max-sm:p-1.5 ${selectedDate === value ? "bg-emerald-50" : ""}`}>
                    {day && <>
                      <button type="button" className={`mb-1 block border-0 bg-transparent p-0 text-sm font-medium text-slate-700 ${today ? "font-bold text-emerald-800" : ""}`} aria-label={`Select ${value}`} aria-pressed={selectedDate === value} onClick={() => setSelectedDate(value)}>{day}</button>
                      <div className="flex flex-col gap-1">
                        {dayHolidays.slice(0, 2).map((holiday) => <span key={holiday.id} className={`block max-w-full truncate rounded px-1.5 py-0.5 text-sm font-medium ${holidayTypeColors[holiday.type]}`} title={holiday.name}>{holiday.name}</span>)}
                        {dayHolidays.length > 2 && <span className="text-sm text-slate-500">+{dayHolidays.length - 2} more</span>}
                      </div>
                    </>}
                  </div>;
                })}
              </div>}

              {view === "list" && <div className="h-[616px] overflow-y-auto overscroll-contain p-3 max-sm:h-[544px]" aria-label={`Daily schedule for ${monthTitle}`}>
                <div className="mb-2 flex items-center justify-between border-b border-slate-200 px-2 py-3">
                  <h3 className="m-0 text-base font-semibold text-slate-800">Daily schedule · {monthTitle}</h3>
                  <span className="text-sm text-slate-500">{daysCount} days</span>
                </div>
                <div className="grid grid-cols-[72px_90px_minmax(0,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-2 py-2 text-sm font-medium text-slate-600 max-sm:grid-cols-[64px_76px_minmax(0,1fr)]">
                  <span>Date</span><span>Day</span><span>Holiday</span>
                </div>
                {listDays.map((listDay) => {
                  const dayHolidays = listDay.holidays;
                  return (
                    <div className="grid min-h-12 grid-cols-[72px_90px_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 px-2 py-2 text-sm max-sm:grid-cols-[64px_76px_minmax(0,1fr)]" key={listDay.date}>
                      <time dateTime={listDay.date} className="font-medium text-slate-800">{formatDate(listDay.date, { day: "numeric", month: "short" })}</time>
                      <span className="text-slate-600">{formatDate(listDay.date, { weekday: "short" })}</span>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {dayHolidays.map((holiday) => (
                          <span key={holiday.id} className={`max-w-full truncate rounded px-2 py-1 text-sm ${holidayTypeColors[holiday.type]}`} title={`${holiday.name}${holiday.status === "inactive" ? " (inactive)" : ""}`}>
                            {holiday.name}{holiday.status === "inactive" ? " · Inactive" : ""}
                          </span>
                        ))}
                        {dayHolidays.length === 0 && <span className="text-slate-400">-</span>}
                      </div>
                    </div>
                  );
                })}
              </div>}

              {view === "year" && <div className="grid min-h-[330px] grid-cols-2 gap-3 p-[18px] sm:grid-cols-3 xl:grid-cols-4">
                {months.map((monthName, index) => {
                  const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
                  const count = holidays.filter((holiday) => holiday.status === "active" && (holiday.repeatEveryYear ? holiday.date.slice(5, 7) === monthKey.slice(5, 7) : holiday.date.startsWith(monthKey))).length;
                  return <button key={monthName} type="button" className="min-h-[100px] rounded-md border border-slate-200 bg-white p-3 text-left text-slate-700 hover:border-emerald-300 hover:bg-emerald-50" onClick={() => { setMonth(monthKey); setSelectedDate(`${monthKey}-01`); setView("month"); }}>
                    <strong className="mb-2 block text-xs font-semibold text-slate-800">{monthName}</strong><span className="text-[10px] text-slate-500">{count} {count === 1 ? "holiday" : "holidays"}</span>
                  </button>;
                })}
              </div>}
            </div>

            <aside className="border-t border-slate-200 bg-white px-[13px] pt-[13px] xl:border-l xl:border-t-0" aria-label={`Holidays in ${monthTitle}`}>
              <div className="mb-[15px] flex items-center justify-between gap-2"><h3 className="m-0 text-base font-semibold">Holidays</h3><span className="text-xs text-slate-500">{monthTitle} · {monthHolidays.length}</span></div>
              <div className="grid grid-cols-[68px_minmax(0,1fr)_85px_28px] gap-[5px] border-b border-slate-100 pb-[7px] text-sm font-medium text-slate-600 xl:grid-cols-[76px_minmax(0,1fr)_100px_28px]"><span>Date</span><span>Holiday</span><span>Type</span><span /></div>
              {monthHolidays.length ? monthHolidays.map((holiday) => <div className="grid min-h-[68px] grid-cols-[68px_minmax(0,1fr)_85px_28px] items-center gap-[5px] border-b border-slate-100 text-sm xl:grid-cols-[76px_minmax(0,1fr)_100px_28px]" key={holiday.id}>
                <div className="flex flex-col"><b className="text-sm text-slate-700">{formatDate(holiday.displayDate, { day: "numeric", month: "short" })}</b><small className="mt-0.5 text-xs text-slate-500">{formatDate(holiday.displayDate, { weekday: "short" })}</small></div>
                <span className="truncate" title={holiday.name}>{holiday.name}</span>
                <span className={`w-fit truncate rounded px-1.5 py-1 text-xs ${holidayTypeColors[holiday.type]}`}>{holidayTypeLabels[holiday.type].replace(" holiday", "")}</span>
                <div className="flex justify-end"><button type="button" className="grid size-6 place-items-center rounded border border-red-100 bg-red-50 text-red-500 hover:bg-red-100" aria-label={`Remove ${holiday.name}`} onClick={() => setHolidays((current) => current.filter((item) => item.id !== holiday.id))}><Trash2 size={13} /></button></div>
              </div>) : <p className="px-1 py-6 text-center text-sm text-slate-500">No holidays this month.</p>}
            </aside>
          </section>

          <section className="mt-[13px] overflow-hidden rounded-lg border border-slate-200 bg-white" aria-labelledby="holiday-records-title">
            <div className="px-[13px] pb-2 pt-[13px]"><h2 id="holiday-records-title" className="m-0 text-lg font-semibold">Holiday records</h2></div>
            <div className="grid grid-cols-1 gap-2.5 px-[13px] pb-[13px] pt-[7px] sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_155px_145px_auto]">
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 text-slate-400"><Search size={16} /><input aria-label="Search holidays" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search holidays" className="h-full w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" /></label>
              <select aria-label="Filter by holiday type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | HolidayType)} className="h-10 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700">
                <option value="all">All types</option><option value="national">National holiday</option><option value="special">Special holiday</option><option value="festival">Festival</option>
              </select>
              <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | HolidayStatus)} className="h-10 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700">
                <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
              <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={exportHolidays}><Download size={16} />Export</button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                <div className="grid h-11 grid-cols-[32px_140px_1.1fr_145px_1.4fr_75px_80px] items-center gap-[7px] border-y border-slate-100 bg-slate-50 px-[13px] text-sm font-semibold text-slate-600"><span>#</span><span>Date</span><span>Holiday</span><span>Type</span><span>Description</span><span>Repeats</span><span>Status</span></div>
                {filteredHolidays.length ? filteredHolidays.map((holiday, index) => <div className="grid min-h-11 grid-cols-[32px_140px_1.1fr_145px_1.4fr_75px_80px] items-center gap-[7px] border-b border-slate-100 px-[13px] text-sm text-slate-700" key={holiday.id}>
                  <span>{index + 1}</span>
                  <span className="whitespace-nowrap">{formatDate(holiday.displayDate, { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span className="truncate" title={holiday.name}>{holiday.name}</span>
                  <span className={`w-fit truncate rounded px-1.5 py-1 text-sm ${holidayTypeColors[holiday.type]}`}>{holidayTypeLabels[holiday.type]}</span>
                  <span className="truncate" title={holiday.description}>{holiday.description || "-"}</span>
                  <span>{holiday.repeatEveryYear ? "Yes" : "No"}</span>
                  <span className={`w-fit rounded px-2 py-1 text-sm ${holiday.status === "inactive" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{holiday.status}</span>
                </div>) : <p className="px-[13px] py-[22px] text-center text-[11px] text-slate-500">No holidays match these filters.</p>}
              </div>
            </div>
          </section>
        </main>
      </div>

      {showForm && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeHolidayForm(); }}>
        <section className="max-h-[90vh] w-full max-w-[450px] overflow-y-auto rounded-xl bg-white p-[22px] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="holiday-form-title">
          <div className="mb-5 flex justify-between gap-3">
            <div><h2 id="holiday-form-title" className="m-0 text-lg font-semibold text-slate-800">New holiday</h2><p className="mt-1 text-[11px] text-slate-500">Add a date-specific holiday to the calendar.</p></div>
            <button type="button" aria-label="Close holiday form" onClick={closeHolidayForm} className="grid size-[30px] place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={17} /></button>
          </div>
          <form onSubmit={addHoliday}>
            <label className="mb-[13px] block text-[11px] font-semibold text-slate-700">Holiday name<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Founders' Day" className="mt-1.5 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal outline-none focus:border-emerald-500" /></label>
            <label className="mb-[13px] block text-[11px] font-semibold text-slate-700">Holiday date<input required type="date" value={selectedDate} onChange={(event) => { const value = event.target.value; setSelectedDate(value); if (value) setMonth(value.slice(0, 7)); }} className="mt-1.5 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal outline-none focus:border-emerald-500" /></label>
            <label className="mb-[13px] block text-[11px] font-semibold text-slate-700">Holiday type<select required value={holidayType} onChange={(event) => setHolidayType(event.target.value as HolidayType)} className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal outline-none focus:border-emerald-500">
              <option value="national">National holiday</option><option value="special">Special holiday</option><option value="festival">Festival</option>
            </select></label>
            <label className="mb-[13px] block text-[11px] font-semibold text-slate-700">Description<textarea required maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe this holiday" className="mt-1.5 h-[75px] w-full resize-y rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal outline-none focus:border-emerald-500" /></label>
            <div className="mb-[13px] flex items-center justify-between"><span className="text-[11px] font-semibold text-slate-700">Repeating every year</span><button type="button" role="switch" aria-label="Repeating every year" aria-checked={repeatEveryYear} className={`relative h-[22px] w-10 rounded-full border-0 ${repeatEveryYear ? "bg-emerald-700" : "bg-slate-300"}`} onClick={() => setRepeatEveryYear((value) => !value)}><span className={`absolute top-[3px] size-4 rounded-full bg-white transition-transform ${repeatEveryYear ? "translate-x-[18px]" : "left-[3px]"}`} /></button></div>
            <fieldset className="mb-3 border-0 p-0"><legend className="mb-2 text-[11px] font-semibold text-slate-700">Status</legend><div className="flex gap-2">
              <label className={`flex flex-1 items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] font-medium ${status === "active" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700"}`}><input required type="radio" name="holiday-status" value="active" checked={status === "active"} onChange={() => setStatus("active")} className="size-4 accent-emerald-700" />Active</label>
              <label className={`flex flex-1 items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] font-medium ${status === "inactive" ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-300 text-slate-700"}`}><input required type="radio" name="holiday-status" value="inactive" checked={status === "inactive"} onChange={() => setStatus("inactive")} className="size-4 accent-emerald-700" />Inactive</label>
            </div></fieldset>
            <div className="mt-[18px] flex justify-end gap-2"><button type="button" className="h-8 rounded-md border border-slate-300 bg-white px-3.5 text-[11px] text-slate-700 hover:bg-slate-50" onClick={closeHolidayForm}>Cancel</button><button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-3.5 text-[11px] font-semibold text-white hover:bg-slate-700"><Plus size={14} />Create holiday</button></div>
          </form>
        </section>
      </div>}

      {showUpload && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowUpload(false); }}>
        <section className="max-h-[90vh] w-full max-w-[450px] overflow-y-auto rounded-xl bg-white p-[22px] shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="holiday-upload-title">
          <div className="mb-5 flex justify-between gap-3"><div><h2 id="holiday-upload-title" className="m-0 text-lg font-semibold text-slate-800">Import holidays</h2><p className="mt-1 text-[11px] text-slate-500">Read holiday dates and names from a supported file.</p></div><button type="button" aria-label="Close file import" onClick={() => setShowUpload(false)} className="grid size-[30px] place-items-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"><X size={17} /></button></div>
          <label className="block rounded-md border border-dashed border-slate-400 bg-slate-50 p-4 text-center text-[11px] text-slate-600"><FileUp size={20} className="mx-auto mb-2 text-slate-500" />PDF, image, CSV, TXT, Markdown, or JSON<input ref={fileInputRef} type="file" accept=".pdf,.csv,.txt,.md,.json,text/*,image/*,application/pdf,application/json" onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setUploadError(""); setUploadSuccess(""); }} className="mt-2 w-full text-[11px]" /></label>
          <button type="button" className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-3.5 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={isReadingFile || !selectedFile} onClick={readUpload}><FileUp size={14} />{isReadingFile ? "Reading file..." : "Read file"}</button>
          {uploadError && <p role="alert" className="mt-2.5 text-[11px] text-red-700">{uploadError}</p>}
          {uploadProgress && <p role="status" className="mt-2.5 text-[11px] text-slate-600">{uploadProgress}</p>}
          {uploadSuccess && <p role="status" className="mt-2.5 text-[11px] text-emerald-700">{uploadSuccess}</p>}
        </section>
      </div>}
    </div>
  );
}