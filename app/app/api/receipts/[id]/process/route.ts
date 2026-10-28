import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import { readMedia } from "@/lib/media-storage";
import { callGarageAIVisionJsonObject } from "@/lib/ai-provider";
import { execFile } from "child_process";
import { promisify } from "util";
import { trackServerMatomoEvent } from "@/lib/matomo-server";

const execFileAsync = promisify(execFile);

interface ExtractedReceipt {
  vendor: string | null;
  receiptDate: string | null;
  totalAmount: number | null;
  serviceType: string;
  serviceTitle: string;
  notes: string | null;
  lineItems: { name: string; quantity: number; amount: number }[];
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let mm = Number(m[1]);
  let dd = Number(m[2]);
  let yy = Number(m[3]);
  if (yy < 100) yy += 2000;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function sanitizeLineItems(items: { name: string; quantity: number; amount: number }[], totalAmount: number | null) {
  const bad = /(subtotal|grand total|total before tax|\btotal\b|estimated tax|\btax\b|shipping|handling|payment|card|mastercard|visa|amex|discover|address|transaction|order #|sold by|ship to|bill to)/i;
  const seen = new Set<string>();
  return items
    .map((li) => ({
      name: li.name.replace(/\s+/g, " ").trim(),
      quantity: Number.isFinite(li.quantity) && li.quantity > 0 ? li.quantity : 1,
      amount: Number.isFinite(li.amount) ? Math.round(li.amount * 100) / 100 : 0,
    }))
    .filter((li) => li.name.length >= 2 && li.amount > 0)
    .filter((li) => !bad.test(li.name))
    .filter((li) => {
      const key = `${li.name.toLowerCase()}|${li.amount.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((li) => {
      if (!totalAmount) return true;
      // Drop obvious non-item lines that mirror receipt-level totals
      if (Math.abs(li.amount - totalAmount) < 0.001) return false;
      return true;
    });
}

function parseFromOcrText(text: string): ExtractedReceipt {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const upper = lines.map(l => l.toUpperCase());

  const vendor = lines.find((l, i) => i < 5 && l.length > 2 && l.length < 60 && /[A-Za-z]/.test(l)) ?? null;

  let totalAmount: number | null = null;
  for (let i = 0; i < upper.length; i++) {
    if (/(TOTAL|AMOUNT DUE|BALANCE DUE)/.test(upper[i])) {
      const m = lines[i].match(/(\d+[\.,]\d{2})/g);
      if (m?.length) totalAmount = Number(m[m.length - 1].replace(",", ""));
    }
  }
  if (!totalAmount) {
    const allNums = lines.join(" ").match(/\b\d+[\.,]\d{2}\b/g);
    if (allNums?.length) totalAmount = Number(allNums[allNums.length - 1].replace(",", ""));
  }

  const dateLine = lines.find(l => /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/.test(l)) ?? null;
  const receiptDate = normalizeDate(dateLine);

  const lineItems: { name: string; quantity: number; amount: number }[] = [];
  for (const l of lines) {
    if (/^(TOTAL|SUBTOTAL|TAX|CHANGE|CASH|CARD)/i.test(l)) continue;
    const m = l.match(/^(.*?)(\d+[\.,]\d{2})$/);
    if (!m) continue;
    const name = m[1].trim().replace(/\s{2,}/g, " ");
    const amount = Number(m[2].replace(",", ""));
    if (!name || !Number.isFinite(amount)) continue;
    if (name.length < 2) continue;
    lineItems.push({ name, quantity: 1, amount });
    if (lineItems.length >= 20) break;
  }

  const cleaned = sanitizeLineItems(lineItems, totalAmount);

  return {
    vendor,
    receiptDate,
    totalAmount,
    serviceType: "parts",
    serviceTitle: vendor ? `${vendor} parts purchase` : "Parts purchase",
    notes: null,
    lineItems: cleaned,
  };
}

async function runTesseract(fileBuffer: Buffer, ext: string): Promise<string> {
  const inPath = `/tmp/ocr-${randomUUID()}.${ext || "jpg"}`;
  await writeFile(inPath, fileBuffer);
  try {
    const { stdout } = await execFileAsync("tesseract", [inPath, "stdout", "-l", "eng", "--psm", "6"], { maxBuffer: 16 * 1024 * 1024 });
    return stdout || "";
  } finally {
    await unlink(inPath).catch(() => {});
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const receipt = await prisma.receipt.findFirst({
    where: { id, userId: session.userId },
  });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const carId: string | undefined = body.carId;

  if (!receipt.filename) {
    return NextResponse.json({ error: "No file attached to this receipt" }, { status: 400 });
  }

  console.log(`[receipt-process] start id=${id} file=${receipt.filename}`);

  // Read the file
  const filePath = path.join(process.cwd(), "public", "uploads", receipt.filename);
  const fileBuffer = await readMedia({ relPath: receipt.filename, absPath: filePath });
  const base64Data = fileBuffer.toString("base64");

  // Determine media type
  const ext = receipt.filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const mediaTypeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
  };
  const mediaType = mediaTypeMap[ext] ?? "image/jpeg";

  const prompt = `You are a receipt parser. Extract the data from this receipt image and return ONLY valid JSON with no extra text.

Return this exact JSON structure:
{
  "vendor": "Shop name or merchant or null",
  "receiptDate": "YYYY-MM-DD or null",
  "totalAmount": 123.45,
  "serviceType": "oil_change | tire_rotation | brakes | tires | alignment | detailing | inspection | parts | other",
  "serviceTitle": "Short human-readable title e.g. 'Oil Change & Filter'",
  "notes": "Any relevant notes from the receipt or null",
  "lineItems": [
    { "name": "Item name", "quantity": 1, "amount": 12.99 }
  ]
}

Rules:
- totalAmount should be the total amount paid (number, not string)
- receiptDate should be in YYYY-MM-DD format, or null if not found
- serviceType must be exactly one of: oil_change, tire_rotation, brakes, tires, alignment, detailing, inspection, parts, other
- lineItems should include labor and parts line items
- Return ONLY the JSON, no markdown, no explanation`;

  let extracted: ExtractedReceipt;
  let extractionMethod: "ocr_ai_review" | "ocr_fallback" = "ocr_ai_review";

  // OCR is the cheap first pass. The local vision model then reviews the actual image
  // plus OCR context and becomes the final structured extraction.
  if (mediaType !== "application/pdf") {
    let ocrText = "";
    let ocrParsed: ExtractedReceipt | null = null;
    let ocrGoodEnough = false;

    try {
      ocrText = await runTesseract(fileBuffer, ext);
      ocrParsed = parseFromOcrText(ocrText);
      ocrGoodEnough = !!(ocrParsed.totalAmount || ocrParsed.vendor || ocrParsed.lineItems.length >= 2);
    } catch (ocrErr) {
      console.error("OCR parse failed; continuing with local GarageMeet AI image review", ocrErr);
    }

    const reviewPrompt = `${prompt}

OCR first-pass text from this same receipt image:
${ocrText.trim() || "(OCR did not find readable text)"}

OCR draft extraction for comparison:
${JSON.stringify(ocrParsed, null, 2)}

Review the actual receipt image yourself. Use the OCR only as a hint. Correct OCR mistakes, ignore hallucinated OCR lines, and return the final JSON extraction only.`;

    try {
      extracted = await callGarageAIVisionJsonObject<ExtractedReceipt>(reviewPrompt, mediaType, base64Data, { temperature: 0, maxTokens: 1536 });
      extractionMethod = "ocr_ai_review";
    } catch (aiErr) {
      console.error("GarageMeet AI receipt image review failed", aiErr);
      if (ocrGoodEnough && ocrParsed) {
        extracted = ocrParsed;
        extractionMethod = "ocr_fallback";
      } else {
        return NextResponse.json({ error: "Receipt scan failed on local GarageMeet AI and OCR was inconclusive" }, { status: 502 });
      }
    }
  } else {
    return NextResponse.json({ error: "PDF receipt parsing is not available with local Ollama yet. Upload an image receipt instead." }, { status: 415 });
  }

  extracted.lineItems = sanitizeLineItems(extracted.lineItems ?? [], extracted.totalAmount ?? null);

  console.log(`[receipt-process] id=${id} method=${extractionMethod} vendor=${extracted.vendor ?? "-"} total=${extracted.totalAmount ?? "-"} items=${extracted.lineItems?.length ?? 0}`);

  // Update the receipt record with extracted data
  await prisma.receipt.update({
    where: { id },
    data: {
      vendor: extracted.vendor ?? receipt.vendor,
      totalAmount: extracted.totalAmount ?? receipt.totalAmount,
      receiptDate: extracted.receiptDate ? new Date(extracted.receiptDate) : receipt.receiptDate,
      notes: extracted.notes ?? receipt.notes,
    },
  });

  // Search for matching service record if carId provided
  let matchedServiceRecord = null;
  if (carId && extracted.receiptDate) {
    const receiptDateObj = new Date(extracted.receiptDate);
    const threeDaysBefore = new Date(receiptDateObj);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
    const threeDaysAfter = new Date(receiptDateObj);
    threeDaysAfter.setDate(threeDaysAfter.getDate() + 3);

    matchedServiceRecord = await prisma.serviceRecord.findFirst({
      where: {
        carId,
        serviceDate: {
          gte: threeDaysBefore,
          lte: threeDaysAfter,
        },
      },
      select: { id: true, title: true, serviceDate: true, serviceType: true },
      orderBy: { serviceDate: "desc" },
    });
  }

  void trackServerMatomoEvent({ category: "Garage", action: "receipt_scanned", name: String(extractionMethod), userId: session.userId, path: "/receipts/:id" });
  return NextResponse.json({
    extracted,
    method: extractionMethod,
    matchedServiceRecord: matchedServiceRecord
      ? {
          ...matchedServiceRecord,
          serviceDate: matchedServiceRecord.serviceDate.toISOString(),
        }
      : null,
    receiptId: id,
  });
}
