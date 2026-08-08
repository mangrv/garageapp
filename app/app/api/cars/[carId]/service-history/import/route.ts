import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/** Parse CSV properly — handles quoted fields with embedded newlines and commas */
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Tokenize the entire CSV character by character to handle multiline quoted fields
  function tokenize(src: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cur = "";
    let inQuote = false;
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '"') {
        if (inQuote && src[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuote = !inQuote;
        i++; continue;
      }
      if (ch === "," && !inQuote) { row.push(cur); cur = ""; i++; continue; }
      if (ch === "\n" && !inQuote) {
        row.push(cur); cur = "";
        rows.push(row); row = [];
        i++; continue;
      }
      cur += ch; i++;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  const allRows = tokenize(normalized).filter((r) => r.some((c) => c.trim()));
  if (allRows.length < 2) return { headers: [], rows: [] };

  const headers = allRows[0].map((h) => h.trim());
  const rows = allRows.slice(1)
    .map((vals) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim(); });
      return obj;
    })
    // Skip rows where date, mileage, service type, AND details are all empty
    .filter((row) => {
      const dateKey = headers.find(h => /date/i.test(h));
      const typeKey = headers.find(h => /service.?type|^type$/i.test(h));
      const detailKey = headers.find(h => /detail|work.?perf/i.test(h));
      const miKey = headers.find(h => /odometer|mileage/i.test(h));
      const hasDate = dateKey && row[dateKey]?.trim();
      const hasType = typeKey && row[typeKey]?.trim();
      const hasDetail = detailKey && row[detailKey]?.trim();
      const hasMi = miKey && row[miKey]?.trim();
      return !!(hasDate || hasType || hasDetail || hasMi);
    });

  return { headers, rows };
}

/** Map CSV header string → canonical field name */
function normalizeHeader(h: string): string {
  const s = h.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (s === "dateofservice" || s === "date") return "serviceDate";
  if (s === "odometermi" || s === "odometer" || s === "mileage") return "mileage";
  if (s === "servicetype" || s === "type") return "serviceType";
  if (s.startsWith("detail") || s === "workperformed" || s === "description") return "details";
  if (s.startsWith("partsused") || s === "parts") return "partsUsed";
  if (s === "costdollar" || s === "cost" || s === "price") return "cost";
  if (s.startsWith("nextservice")) return "nextServiceDue";
  if (s.startsWith("timetocomplete") || s === "duration" || s === "timehours") return "duration";
  if (s.startsWith("whereparts") || s === "partssource" || s === "vendor") return "partsSource";
  if (s === "notes" || s === "note") return "notes";
  return h;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;
  const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    return new Date(year, parseInt(m[1]) - 1, parseInt(m[2]));
  }
  return null;
}

function mapRows(rows: Record<string, string>[]) {
  return rows.map((raw) => {
    const norm: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      norm[normalizeHeader(k)] = v;
    }
    const dateVal = parseDate(norm.serviceDate ?? "");
    const mileageRaw = (norm.mileage ?? "").replace(/[^0-9]/g, "");
    const costRaw = (norm.cost ?? "").replace(/[^0-9.]/g, "");
    return {
      title: norm.serviceType || norm.details?.slice(0, 80) || "Service",
      serviceType: norm.serviceType || null,
      details: norm.details || null,
      notes: norm.notes || null,
      partsUsed: norm.partsUsed || null,
      cost: costRaw ? parseFloat(costRaw) : null,
      nextServiceDue: norm.nextServiceDue || null,
      duration: norm.duration || null,
      partsSource: norm.partsSource || null,
      mileage: mileageRaw ? parseInt(mileageRaw) : null,
      serviceDate: dateVal ?? new Date(),
    };
  }).filter((r) => r.title);
}

// POST: import rows (JSON body) or preview
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  let session; try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { carId } = await params;
  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const body = await req.json() as { rows: Record<string, string>[]; preview?: boolean };
  const { rows, preview } = body;
  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const mapped = mapRows(rows);

  if (preview) {
    return NextResponse.json({ count: mapped.length, preview: mapped.slice(0, 5) });
  }

  const created = await prisma.$transaction(
    mapped.map((r) =>
      prisma.serviceRecord.create({
        data: {
          carId,
          title: r.title,
          serviceType: r.serviceType,
          details: r.details,
          notes: r.notes,
          partsUsed: r.partsUsed,
          cost: r.cost,
          nextServiceDue: r.nextServiceDue,
          duration: r.duration,
          partsSource: r.partsSource,
          mileage: r.mileage,
          serviceDate: r.serviceDate,
        },
      })
    )
  );

  return NextResponse.json({ imported: created.length });
}

// PUT: parse raw CSV text → return headers + rows for client-side preview
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ carId: string }> }
) {
  let session; try { session = await requireSession(); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { carId } = await params;
  const car = await prisma.car.findFirst({ where: { id: carId, userId: session.userId } });
  if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

  const text = await req.text();
  const { headers, rows } = parseCSV(text);
  return NextResponse.json({ headers, rows, count: rows.length });
}
