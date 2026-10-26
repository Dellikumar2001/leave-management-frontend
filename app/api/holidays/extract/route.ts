import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import * as xlsx from "xlsx";

export const maxDuration = 120;
export const runtime = "nodejs";

const PROMPT = `
You are an expert holiday calendar parser specialized in academic handbooks, official government gazettes, and holiday schedules.
Analyze this calendar (provided as a PDF, an image, spreadsheet, or webpage content) across all visible dates.

Your Goal:
Extract all official declared holidays (National holidays, religious/cultural festivals, public/government holidays, and recognized non-working holidays).

Rules:
1. Output each holiday with its exact Gregorian date strictly formatted as 'YYYY-MM-DD'.
2. Classify 'type':
   - 'national' for Republic Day, Independence Day, Gandhi Jayanthi, etc.
   - 'festival' for Pongal, Deepavali/Diwali, Christmas, Eid/Milad/Muharram, Ayutha Pooja, Vijaya Dasami, Krishna Jayanthi, etc.
   - 'special' for New Year, May Day, Good Friday, Ambedkar Jayanthi, or declared college/government holidays.
3. Clean the holiday name by removing weekday abbreviations (e.g. MON, SAT), day order numbers (1 to 6), and trailing labels like '- Holiday'.
4. Do NOT output regular working days, mid-term tests, exam commencement dates, or retreat sessions unless they are explicitly declared holidays.
`;

export type ExtractedHoliday = {
  name: string;
  date: string;
  type: "national" | "festival" | "special";
  description: string;
};

const MONTH_NAMES: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

const KNOWN_HOLIDAYS_MAP: Record<string, { name: string; month: string; day: number; type: "national" | "festival" | "special" }> = {
  "muharram": { name: "Muharram", month: "06", day: 26, type: "festival" },
  "independence": { name: "Independence Day", month: "08", day: 15, type: "national" },
  "milad": { name: "Milad-un-Nabi", month: "08", day: 26, type: "festival" },
  "krishna": { name: "Krishna Jayanthi", month: "09", day: 4, type: "festival" },
  "gokulashtami": { name: "Krishna Jayanthi", month: "09", day: 4, type: "festival" },
  "vinayakar": { name: "Vinayakar Chathurthi", month: "09", day: 14, type: "festival" },
  "chathurthi": { name: "Vinayakar Chathurthi", month: "09", day: 14, type: "festival" },
  "gandhi": { name: "Gandhi Jayanthi", month: "10", day: 2, type: "national" },
  "ayutha": { name: "Ayutha Pooja", month: "10", day: 19, type: "festival" },
  "ayudha": { name: "Ayutha Pooja", month: "10", day: 19, type: "festival" },
  "vijaya": { name: "Vijaya Dasami", month: "10", day: 20, type: "festival" },
  "dasami": { name: "Vijaya Dasami", month: "10", day: 20, type: "festival" },
  "deepavali": { name: "Deepavali", month: "11", day: 8, type: "festival" },
  "diwali": { name: "Deepavali", month: "11", day: 8, type: "festival" },
  "pongal": { name: "Pongal", month: "01", day: 14, type: "festival" },
  "thiruvalluvar": { name: "Thiruvalluvar Day", month: "01", day: 15, type: "festival" },
  "uzhavar": { name: "Uzhavar Thirunal", month: "01", day: 16, type: "festival" },
  "republic": { name: "Republic Day", month: "01", day: 26, type: "national" },
  "good friday": { name: "Good Friday", month: "04", day: 3, type: "festival" },
  "tamil new year": { name: "Tamil New Year", month: "04", day: 14, type: "festival" },
  "ambedkar": { name: "Dr. B.R. Ambedkar Jayanthi", month: "04", day: 14, type: "special" },
  "may day": { name: "May Day", month: "05", day: 1, type: "special", },
  "bakrid": { name: "Bakrid / Eid al-Adha", month: "06", day: 17, type: "festival" },
  "christmas": { name: "Christmas", month: "12", day: 25, type: "festival" },
  "new year": { name: "New Year's Day", month: "01", day: 1, type: "special" },
};

function classifyHolidayType(name: string): "national" | "festival" | "special" {
  const lower = name.toLowerCase();
  if (lower.includes("republic") || lower.includes("independence") || lower.includes("gandhi")) {
    return "national";
  }
  if (
    lower.includes("pongal") ||
    lower.includes("deepavali") ||
    lower.includes("diwali") ||
    lower.includes("christmas") ||
    lower.includes("eid") ||
    lower.includes("bakrid") ||
    lower.includes("muharram") ||
    lower.includes("milad") ||
    lower.includes("ayutha") ||
    lower.includes("vijaya") ||
    lower.includes("krishna") ||
    lower.includes("vinayakar") ||
    lower.includes("festival")
  ) {
    return "festival";
  }
  return "special";
}

function cleanHolidayName(name: string): string {
  const knownHolidays = [
    "Independence Day",
    "Republic Day",
    "Gandhi Jayanthi",
    "Deepavali",
    "Diwali",
    "Pongal",
    "Thiruvalluvar Day",
    "Uzhavar Thirunal",
    "Bakrid / Eid al-Adha",
    "Muharram",
    "Milad-un-Nabi",
    "Krishna Jayanthi",
    "Vinayakar Chathurthi",
    "Ayutha Pooja",
    "Vijaya Dasami",
    "Good Friday",
    "Christmas",
    "New Year's Day",
    "Tamil New Year",
    "Dr. B.R. Ambedkar Jayanthi",
    "May Day",
  ];

  const lower = name.toLowerCase();
  for (const k of knownHolidays) {
    if (lower.includes(k.toLowerCase()) || (k.includes("/") && k.toLowerCase().split("/").some(part => lower.includes(part.trim())))) {
      return k;
    }
  }

  return name
    .replace(/-(?:\s*)holiday/gi, "")
    .replace(/\bholiday\b/gi, "")
    .replace(/\b(?:mon|tue|wed|thu|fri|sat|sun)\b/gi, "")
    .replace(/^(?:College reopens|Classes begin|End of Semester|Examinations begin|Senatus Meeting|ICA Retake Test|ICA Test[^\w]*|Moon Shadow|Atarah|[•\d\s\-_.:])+/gi, "")
    .replace(/[\s\-_.:]+\d+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Standardize any arbitrary date string / number into YYYY-MM-DD
 */
function normalizeDate(raw: unknown, fallbackYear: number): string | null {
  if (!raw) return null;

  if (typeof raw === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const dateObj = new Date(excelEpoch.getTime() + raw * 86400000);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split("T")[0];
    }
  }

  const str = String(raw).trim();

  // ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Month name and Day
  const words = str.toLowerCase().replace(/,/g, "").split(/\s+/);
  let detectedMonth: string | null = null;
  let detectedDay: string | null = null;
  let detectedYear = String(fallbackYear);

  for (const word of words) {
    if (MONTH_NAMES[word]) {
      detectedMonth = MONTH_NAMES[word];
    } else if (/^\d{4}$/.test(word)) {
      detectedYear = word;
    } else if (/^\d{1,2}(?:st|nd|rd|th)?$/.test(word)) {
      const num = parseInt(word, 10);
      if (num >= 1 && num <= 31 && !detectedDay) {
        detectedDay = String(num).padStart(2, "0");
      }
    }
  }

  if (detectedMonth && detectedDay) {
    return `${detectedYear}-${detectedMonth}-${detectedDay}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear() || fallbackYear;
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Smart local extractor for Spreadsheets (Excel / CSV)
 */
function parseSpreadsheetHolidays(buffer: Buffer, fallbackYear: number): ExtractedHoliday[] {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const holidays: ExtractedHoliday[] = [];
  const seenDates = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    for (const row of rows) {
      let dateVal: unknown = null;
      let nameVal = "";
      let typeVal = "";
      let descVal = "";

      for (const [key, val] of Object.entries(row)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes("date") || lowerKey.includes("day") || lowerKey === "on" || lowerKey === "when") {
          if (!dateVal) dateVal = val;
        } else if (
          lowerKey.includes("holiday") ||
          lowerKey.includes("name") ||
          lowerKey.includes("title") ||
          lowerKey.includes("occasion") ||
          lowerKey.includes("event")
        ) {
          if (!nameVal) nameVal = String(val).trim();
        } else if (lowerKey.includes("type") || lowerKey.includes("category")) {
          typeVal = String(val).trim();
        } else if (lowerKey.includes("desc") || lowerKey.includes("remark") || lowerKey.includes("detail")) {
          descVal = String(val).trim();
        }
      }

      if (!dateVal || !nameVal) {
        const values = Object.values(row);
        for (const val of values) {
          if (!dateVal && normalizeDate(val, fallbackYear)) {
            dateVal = val;
          } else if (!nameVal && typeof val === "string" && val.trim().length > 2 && isNaN(Number(val))) {
            nameVal = val.trim();
          }
        }
      }

      const formattedDate = normalizeDate(dateVal, fallbackYear);
      const cleanedName = cleanHolidayName(nameVal);

      if (formattedDate && cleanedName && cleanedName.length > 1) {
        if (!seenDates.has(formattedDate)) {
          seenDates.add(formattedDate);
          holidays.push({
            name: cleanedName,
            date: formattedDate,
            type:
              typeVal.toLowerCase() === "national" || typeVal.toLowerCase() === "festival"
                ? (typeVal.toLowerCase() as "national" | "festival")
                : classifyHolidayType(cleanedName),
            description: descVal || cleanedName,
          });
        }
      }
    }
  }

  return holidays;
}

/**
 * Smart local extractor for Text / PDF content
 */
function parseTextHolidays(rawText: string, fallbackYear: number): ExtractedHoliday[] {
  const holidays: ExtractedHoliday[] = [];
  const seenDates = new Set<string>();
  const seenNames = new Set<string>();

  const lowerContent = rawText.toLowerCase();

  // 1. Match known cultural & gazetted holidays
  for (const [keyword, info] of Object.entries(KNOWN_HOLIDAYS_MAP)) {
    if (lowerContent.includes(keyword)) {
      let day = info.day;

      const regex = new RegExp(`(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s*(?:[A-Za-z]+\\s*)?${keyword}|${keyword}[^\\n\\d]*(\\d{1,2})`, "i");
      const match = rawText.match(regex);
      if (match) {
        const num = parseInt(match[1] || match[2], 10);
        if (num >= 1 && num <= 31) {
          day = num;
        }
      }

      const dateStr = `${fallbackYear}-${info.month}-${String(day).padStart(2, "0")}`;
      const nameKey = info.name.toLowerCase();
      if (!seenDates.has(dateStr) && !seenNames.has(nameKey)) {
        seenDates.add(dateStr);
        seenNames.add(nameKey);
        holidays.push({
          name: info.name,
          date: dateStr,
          type: info.type,
          description: `Official ${info.name}`,
        });
      }
    }
  }

  // 2. Parse explicit holiday lines like "26 FRI ... Muharram - Holiday"
  const holidayLineMatches = [...rawText.matchAll(/([A-Za-z\s'’\-]+?)\s*-\s*Holiday/gi)];
  for (const match of holidayLineMatches) {
    const rawHolidayName = match[1];
    const cleaned = cleanHolidayName(rawHolidayName);

    if (cleaned.length >= 3) {
      const matchIdx = match.index ?? 0;
      const snippet = rawText.slice(Math.max(0, matchIdx - 120), Math.min(rawText.length, matchIdx + 120));
      const detectedDate = normalizeDate(snippet, fallbackYear);
      const nameKey = cleaned.toLowerCase();

      if (detectedDate && !seenDates.has(detectedDate) && !seenNames.has(nameKey)) {
        seenDates.add(detectedDate);
        seenNames.add(nameKey);
        holidays.push({
          name: cleaned,
          date: detectedDate,
          type: classifyHolidayType(cleaned),
          description: cleaned,
        });
      }
    }
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Extract text from PDF buffer using standalone node extractor
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `pdf-extract-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    await fs.writeFile(tempPath, buffer);
    const { execFileSync } = await import("child_process");
    const scriptPath = [process.cwd(), "lib", "extract-pdf-text.mjs"].join(path.sep);
    const output = execFileSync(/*turbopackIgnore: true*/ process.execPath || "node", [scriptPath, tempPath], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
    return output;
  } catch (err) {
    console.warn("PDF extraction notice:", err);
    return "";
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  let tempFilePath: string | null = null;
  let uploadedFileRef: { uri?: string; mimeType?: string; name?: string } | null = null;

  try {
    const apiKey =
      req.headers.get("x-gemini-api-key")?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      "";

    const contentType = req.headers.get("content-type") || "";
    let fallbackYear = new Date().getFullYear();

    // ------------------------------------------------------------------
    // CASE 1: WEB LINK / URL (JSON payload)
    // ------------------------------------------------------------------
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const targetUrl = body.url?.trim();
      fallbackYear = Number(body.year ?? fallbackYear);

      if (!targetUrl) {
        return NextResponse.json({ error: "URL is required." }, { status: 400 });
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          return NextResponse.json(
            { error: "Invalid URL protocol. Only HTTP and HTTPS links are supported." },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format. Please provide a valid calendar URL." },
          { status: 400 }
        );
      }

      let linkResponse: Response;
      try {
        linkResponse = await fetch(parsedUrl.toString(), {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : "Network error";
        return NextResponse.json(
          { error: `Unable to connect to the provided URL (${msg}). Please verify the link.` },
          { status: 400 }
        );
      }

      if (!linkResponse.ok) {
        return NextResponse.json(
          {
            error: `Failed to fetch URL: Server responded with status ${linkResponse.status} (${linkResponse.statusText || "Not Found"}).`,
          },
          { status: 400 }
        );
      }

      const mimeType = linkResponse.headers.get("content-type") || "";
      const arrayBuf = await linkResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // If user provided a Gemini API Key, try AI first
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 120000 } });
          let parts: Array<Record<string, unknown>> = [];

          if (mimeType.includes("pdf") || mimeType.includes("image")) {
            tempFilePath = path.join(os.tmpdir(), `link-doc-${Date.now()}.${mimeType.includes("pdf") ? "pdf" : "jpg"}`);
            await fs.writeFile(tempFilePath, buffer);
            uploadedFileRef = await ai.files.upload({
              file: tempFilePath,
              config: { mimeType: mimeType.split(";")[0] },
            });
            parts = [
              { fileData: { fileUri: uploadedFileRef?.uri, mimeType: uploadedFileRef?.mimeType } },
              { text: `${PROMPT}\nNote: Year fallback is ${fallbackYear}.` },
            ];
          } else {
            const htmlText = buffer
              .toString("utf-8")
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .slice(0, 100000);

            parts = [
              { text: `Webpage Content from ${targetUrl}:\n\n${htmlText}` },
              { text: `${PROMPT}\nNote: Year fallback is ${fallbackYear}.` },
            ];
          }

          const aiResult = await runGeminiGeneration(ai, parts);
          if (aiResult.length > 0) return NextResponse.json(aiResult);
        } catch (geminiErr) {
          console.warn("Gemini AI link parsing failed, falling back to local extractor:", geminiErr);
        }
      }

      // Local Fallback for Link
      if (mimeType.includes("pdf")) {
        const text = await extractTextFromPdf(buffer);
        const localResults = parseTextHolidays(text, fallbackYear);
        return NextResponse.json(localResults);
      } else if (mimeType.includes("excel") || mimeType.includes("spreadsheet") || mimeType.includes("csv")) {
        const localResults = parseSpreadsheetHolidays(buffer, fallbackYear);
        return NextResponse.json(localResults);
      } else {
        const htmlText = buffer.toString("utf-8");
        const localResults = parseTextHolidays(htmlText, fallbackYear);
        return NextResponse.json(localResults);
      }
    }

    // ------------------------------------------------------------------
    // CASE 2: FILE UPLOAD (PDF, Excel, CSV, Image via FormData)
    // ------------------------------------------------------------------
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    fallbackYear = Number(formData.get("year") ?? fallbackYear);

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const fileName = (file.name || "").toLowerCase();
    const fileType = (file.type || "").toLowerCase();
    const isSpreadsheet =
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      fileName.endsWith(".csv") ||
      fileType.includes("sheet") ||
      fileType.includes("csv") ||
      fileType.includes("excel");
    const isPdf = fileName.endsWith(".pdf") || fileType.includes("pdf");
    const isImage = fileType.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(fileName);

    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // If it is a spreadsheet (Excel or CSV), local extraction with xlsx is instant and 100% accurate
    if (isSpreadsheet) {
      const spreadsheetResults = parseSpreadsheetHolidays(buffer, fallbackYear);
      if (spreadsheetResults.length > 0) {
        return NextResponse.json(spreadsheetResults);
      }
    }

    // If a Gemini API Key is configured, try Google Gemini AI
    if (apiKey && (isPdf || isImage)) {
      try {
        const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 120000 } });
        const ext = isPdf ? "pdf" : "jpg";
        tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}.${ext}`);
        await fs.writeFile(tempFilePath, buffer);

        uploadedFileRef = await ai.files.upload({
          file: tempFilePath,
          config: { mimeType: isPdf ? "application/pdf" : file.type || "image/jpeg" },
        });

        const parts = [
          { fileData: { fileUri: uploadedFileRef?.uri, mimeType: uploadedFileRef?.mimeType } },
          { text: `${PROMPT}\nNote: Year fallback is ${fallbackYear}.` },
        ];

        const aiResult = await runGeminiGeneration(ai, parts);
        if (aiResult.length > 0) return NextResponse.json(aiResult);
      } catch (geminiErr) {
        console.warn("Gemini AI file parsing failed, falling back to local extractor:", geminiErr);
      }
    }

    // Local Fallback for PDF
    if (isPdf) {
      const pdfText = await extractTextFromPdf(buffer);
      const pdfHolidays = parseTextHolidays(pdfText, fallbackYear);
      if (pdfHolidays.length > 0) {
        return NextResponse.json(pdfHolidays);
      }
      return NextResponse.json(
        {
          error:
            "No recognized holiday entries found in this PDF. Ensure the PDF contains holiday dates, or upload an Excel/CSV calendar.",
        },
        { status: 422 }
      );
    }

    // Local Fallback for Images
    if (isImage) {
      try {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const ret = await worker.recognize(buffer);
        await worker.terminate();

        const imageHolidays = parseTextHolidays(ret.data.text || "", fallbackYear);
        if (imageHolidays.length > 0) {
          return NextResponse.json(imageHolidays);
        }
      } catch (ocrErr) {
        console.warn("Tesseract OCR fallback error:", ocrErr);
      }

      return NextResponse.json(
        {
          error:
            "Could not detect clear text from this image. Please upload a PDF / Excel calendar, or provide a Gemini API Key in the Import dialog for advanced AI vision parsing.",
        },
        { status: 422 }
      );
    }

    // Default text fallback
    const rawText = buffer.toString("utf-8");
    const holidays = parseTextHolidays(rawText, fallbackYear);
    return NextResponse.json(holidays);
  } catch (error: unknown) {
    console.error("Extraction error:", error);
    const errObj = error as { message?: string } | undefined;
    return NextResponse.json(
      { error: errObj?.message || "Failed to extract holidays." },
      { status: 500 }
    );
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => {});
    }
  }
}

async function runGeminiGeneration(ai: GoogleGenAI, parts: Array<Record<string, unknown>>) {
  const payload = {
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name of the holiday" },
            date: { type: Type.STRING, description: "YYYY-MM-DD format" },
            type: { type: Type.STRING, enum: ["national", "festival", "special"] },
            description: { type: Type.STRING, description: "Brief description of the holiday" },
          },
          required: ["name", "date", "type", "description"],
        },
      },
    },
  };

  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-flash-latest",
  ];

  for (const model of modelsToTry) {
    try {
      const resp = await ai.models.generateContent({ model, ...payload });
      if (resp?.text) {
        return JSON.parse(resp.text);
      }
    } catch {
      continue;
    }
  }
  return [];
}