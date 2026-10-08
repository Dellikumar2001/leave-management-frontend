import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export const maxDuration = 120;
export const runtime = "nodejs";

const apiKey = process.env.GEMINI_API_KEY;

const PROMPT = `
You are an expert holiday calendar parser specialized in academic handbooks, official government gazettes, and Tamil Nadu holiday schedules.
Analyze this calendar (provided as a PDF, an image, or webpage content) across all visible dates.

Your Goal:
Extract all official declared holidays (National holidays, religious/cultural festivals, public/government holidays, and recognized non-working holidays).

Rules:
1. Output each holiday with its exact Gregorian date strictly formatted as 'YYYY-MM-DD'.
2. Classify 'type':
   - 'national' for Republic Day, Independence Day, Gandhi Jayanthi, etc.
   - 'festival' for Pongal, Deepavali/Diwali, Christmas, Eid/Milad/Muharram, Ayutha Pooja, Vijaya Dasami, etc.
   - 'special' for New Year, May Day, Good Friday, Ambedkar Jayanthi, or declared college/government holidays.
3. Clean the holiday name by removing weekday abbreviations (e.g. MON, SAT), day order numbers (1 to 6), and trailing labels like '- Holiday'.
4. Do NOT output regular working days, mid-term tests, exam commencement dates, or retreat sessions unless they are explicitly declared holidays.
`;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
    let tempFilePath: string | null = null;
    let uploadedFileRef: any = null;

    try {
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not defined in your environment variables." },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({
            apiKey,
            httpOptions: { timeout: 180000 },
        });

        const contentType = req.headers.get("content-type") || "";
        let parts: any[] = [];
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

            const linkResponse = await fetch(targetUrl);
            if (!linkResponse.ok) {
                throw new Error(`Failed to fetch link: ${linkResponse.statusText}`);
            }

            const mimeType = linkResponse.headers.get("content-type") || "";

            if (mimeType.includes("pdf") || mimeType.includes("image")) {
                const arrayBuf = await linkResponse.arrayBuffer();
                tempFilePath = path.join(
                    os.tmpdir(),
                    `link-doc-${Date.now()}.${mimeType.includes("pdf") ? "pdf" : "jpg"}`
                );
                await fs.writeFile(tempFilePath, Buffer.from(arrayBuf));

                uploadedFileRef = await ai.files.upload({
                    file: tempFilePath,
                    mimeType: mimeType.split(";")[0],
                });

                parts = [
                    {
                        fileData: {
                            fileUri: uploadedFileRef.uri,
                            mimeType: uploadedFileRef.mimeType,
                        },
                    },
                    { text: `${PROMPT}\nNote: Year fallback is ${fallbackYear}.` },
                ];
            } else {
                const htmlText = await linkResponse.text();
                const cleanedText = htmlText
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .slice(0, 100000);

                parts = [
                    { text: `Webpage Content from ${targetUrl}:\n\n${cleanedText}` },
                    { text: `${PROMPT}\nNote: Year fallback is ${fallbackYear}.` },
                ];
            }
        }
        // ------------------------------------------------------------------
        // CASE 2: FILE UPLOAD (IMAGE OR PDF via FormData)
        // ------------------------------------------------------------------
        else {
            const formData = await req.formData();
            const file = formData.get("file") as File | null;
            fallbackYear = Number(formData.get("year") ?? fallbackYear);

            if (!file) {
                return NextResponse.json({ error: "No file provided." }, { status: 400 });
            }

            const isImage = file.type.startsWith("image/");
            const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");

            if (!isImage && !isPdf) {
                return NextResponse.json(
                    { error: "Only image files (PNG, JPG, WEBP) or PDFs are supported." },
                    { status: 400 }
                );
            }

            const bytes = await file.arrayBuffer();
            const ext = isPdf ? "pdf" : "jpg";
            tempFilePath = path.join(os.tmpdir(), `upload-${Date.now()}.${ext}`);
            await fs.writeFile(tempFilePath, Buffer.from(bytes));

            uploadedFileRef = await ai.files.upload({
                file: tempFilePath,
                mimeType: isPdf ? "application/pdf" : file.type || "image/jpeg",
            });

            parts = [
                {
                    fileData: {
                        fileUri: uploadedFileRef.uri,
                        mimeType: uploadedFileRef.mimeType,
                    },
                },
                { text: `${PROMPT}\nNote: Year fallback is ${fallbackYear}.` },
            ];
        }

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
                            type: {
                                type: Type.STRING,
                                enum: ["national", "festival", "special"],
                            },
                            description: { type: Type.STRING, description: "Brief description of the holiday" },
                        },
                        required: ["name", "date", "type", "description"],
                    },
                },
            },
        };

        // Retry on temporary traffic surges (503)
        const modelsToTry = ["gemini-2.5-flash"];
        let response: any = null;
        let lastError: any = null;

        for (const modelName of modelsToTry) {
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    response = await ai.models.generateContent({
                        model: modelName,
                        ...payload,
                    });
                    if (response?.text) break;
                } catch (err: any) {
                    lastError = err;
                    const status = err?.status || err?.code || (err?.message?.includes("503") ? 503 : null);
                    if (status === 503 || err?.message?.includes("high demand") || err?.message?.includes("UNAVAILABLE")) {
                        await wait(2000 * attempt);
                        continue;
                    }
                    throw err;
                }
            }
            if (response?.text) break;
        }

        if (!response?.text) {
            throw lastError || new Error("AI service is currently busy. Please try again shortly.");
        }

        const parsedData = JSON.parse(response.text ?? "[]");
        return NextResponse.json(parsedData);
    } catch (error: any) {
        console.error("Extraction error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to extract holidays." },
            { status: 500 }
        );
    } finally {
        if (tempFilePath) {
            await fs.unlink(tempFilePath).catch(() => { });
        }
        if (uploadedFileRef?.name && apiKey) {
            const ai = new GoogleGenAI({ apiKey });
            await ai.files.delete({ name: uploadedFileRef.name }).catch(() => { });
        }
    }
}