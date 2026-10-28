import type { Metadata } from "next";
import React from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import PrintButton from "./PrintButton";
import { callGarageAIText } from "@/lib/ai-provider";
import Glyph from "@/app/components/Glyph";

// Force dark theme CSS vars regardless of user's app theme preference
const DARK: React.CSSProperties = {
  ["--color-gray-950" as string]: "#030712",
  ["--color-gray-900" as string]: "#111827",
  ["--color-gray-800" as string]: "#1f2937",
  ["--color-gray-700" as string]: "#374151",
  ["--color-gray-600" as string]: "#4b5563",
  ["--color-gray-500" as string]: "#6b7280",
  ["--color-gray-400" as string]: "#9ca3af",
  ["--color-gray-300" as string]: "#d1d5db",
  ["--color-white" as string]: "#ffffff",
  ["--color-amber-400" as string]: "#ffffff",
  ["--color-amber-500" as string]: "#9ca3af",
  ["--foreground" as string]: "#f3f4f6",
  background: "#0a0a0a",
  color: "#f3f4f6",
};

// ── Generate + persist vehicle blurb if not already stored ───────────────────
async function ensureVehicleBlurb(
  carId: string,
  year: number, make: string, model: string, trim: string | null,
  enrichment: any,
): Promise<string | null> {
  // Already stored — return as-is
  if (enrichment?.blurb) return enrichment.blurb;

  try {
    const specLines: string[] = [];
    if (enrichment?.engine)      specLines.push(`Engine: ${enrichment.engine}`);
    if (enrichment?.displacement) specLines.push(`Displacement: ${enrichment.displacement}`);
    if (enrichment?.drivetrain)   specLines.push(`Drivetrain: ${enrichment.drivetrain}`);
    if (enrichment?.bodyStyle)    specLines.push(`Body style: ${enrichment.bodyStyle}`);
    if (enrichment?.fuelType)     specLines.push(`Fuel type: ${enrichment.fuelType}`);
    if (enrichment?.series)       specLines.push(`Series/trim: ${enrichment.series}`);

    const vehicleLabel = [year, make, model, trim].filter(Boolean).join(" ");
    const specContext = specLines.length
      ? `\n\nKnown specs:\n${specLines.map(l => `- ${l}`).join("\n")}`
      : "";

    const prompt = `You are an automotive historian and expert. Write a rich, factual vehicle history blurb for a ${vehicleLabel}.${specContext}

The blurb should cover (use markdown with ## section headers):

## Overview
2–3 sentences: what this vehicle is and what generation/platform it represents.

## Heritage & Legacy
The model's history, lineage, market segment, and what it's remembered for.

## This Generation (${year})
Specific to the model year: changes, production context, press and buyer reception.

## Powertrain & Performance
Engine options, HP/torque, transmission choices, 0-60 if notable. Emphasize the specific engine if specs provided.

## Known Strengths
3–4 bullet points on what owners and mechanics praise.

## Common Issues
3–4 bullet points on frequently reported mechanical or reliability issues for this model year.

## Collector & Enthusiast Notes
Special trims, limited editions, aftermarket support, community, resale trends.

Tone: knowledgeable but approachable. No fluff. No ownership commentary. Focus on the vehicle's place in history. ~400–550 words.`;

    const blurb = await callGarageAIText({ prompt, temperature: 0.2, maxTokens: 1536 });
    const now = new Date();

    await (prisma as any).vinEnrichment.upsert({
      where: { carId },
      update: { blurb, blurbGeneratedAt: now },
      create: { carId, blurb, blurbGeneratedAt: now },
    });

    return blurb;
  } catch {
    return null;
  }
}

// ── Simple server-side markdown renderer ─────────────────────────────────────
function renderBlurb(text: string) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listBuf.length) return;
    out.push(
      <ul key={key++} style={{ listStyle: "disc", paddingLeft: "1.2rem", margin: "6px 0", color: "#d1d5db" }}>
        {listBuf.map((item, i) => (
          <li key={i} style={{ fontSize: "0.875rem", lineHeight: "1.6", marginBottom: "2px" }}
            dangerouslySetInnerHTML={{ __html: item.replace(/\*\*([^*]+)\*\*/g, "<strong style='color:#fff'>$1</strong>") }} />
        ))}
      </ul>
    );
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flushList();
      out.push(
        <p key={key++} style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginTop: "1rem", marginBottom: "4px" }}>
          {line.slice(3)}
        </p>
      );
    } else if (line.startsWith("### ")) {
      flushList();
      out.push(
        <p key={key++} style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", marginTop: "0.75rem", marginBottom: "2px" }}>
          {line.slice(4)}
        </p>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(line.slice(2));
    } else if (line === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p key={key++} style={{ fontSize: "0.875rem", lineHeight: "1.65", color: "#d1d5db", margin: "4px 0" }}
          dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, "<strong style='color:#fff'>$1</strong>") }} />
      );
    }
  }
  flushList();
  return out;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtMiles(n: number) {
  return n.toLocaleString() + " mi";
}
function fmtDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString("en-US", opts ?? { month: "long", year: "numeric" });
}
function ownershipDuration(from: Date): string {
  const months = Math.floor((Date.now() - new Date(from).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 1) return "< 1 month";
  if (months < 12) return `${months}mo`;
  const yrs = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${yrs}y ${rem}mo` : `${yrs} yr${yrs !== 1 ? "s" : ""}`;
}

/** Clean up raw NHTSA engine strings like "4.6L V8 V-Shaped" → "4.6L V8" */
function cleanEngineString(engine: string): string {
  return engine
    .replace(/\bV-Shaped\b/gi, "")
    .replace(/\bV-Type\b/gi, "")
    .replace(/\bIn-Line\b/gi, "")
    .replace(/\bStraight\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Strip trailing "(Xcc)" or "(X.XL)" if it already appears in the string */
function dedupeDisplacement(rawEngine: string, displacement: string | null): string {
  const engine = cleanEngineString(rawEngine);
  if (!displacement) return engine;
  const d = displacement.trim();
  if (engine.includes(d)) return engine;
  return `${engine} (${d})`;
}

const SVC_EMOJI: Record<string, string> = {
  oil_change: "🛢️", tire_rotation: "🔄", brakes: "🛑", tires: "🔧",
  alignment: "⚖️", detailing: "✨", inspection: "🔍", parts: "🔩", other: "🔧",
};

// ── Page ─────────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ username: string; carId: string }> }): Promise<Metadata> {
  const { username, carId } = await params;
  const user = await (prisma.user as any).findFirst({
    where: { username: username.toLowerCase(), isPublic: true },
    select: { id: true, name: true, username: true },
  }).catch(() => null);
  const car = user ? await (prisma.car as any).findFirst({
    where: { id: carId, userId: user.id, isPublic: true },
    select: { year: true, make: true, model: true, trim: true, publicNotes: true },
  }).catch(() => null) : null;
  if (!user || !car) return { title: "Vehicle not found", robots: { index: false } };
  const who = user.name || `@${user.username}`;
  const name = [car.year, car.make, car.model, car.trim].filter(Boolean).join(" ");
  const title = `${name} — ${who}'s garage`;
  const description = car.publicNotes
    ? String(car.publicNotes).slice(0, 155)
    : `${name} on GarageMeet: specs, service history and completed projects shared by ${who}.`;
  const path = `/u/${user.username}/car/${carId}`;
  return { title, description, alternates: { canonical: path }, openGraph: { title: `${title} · GarageMeet`, description, url: path } };
}

export default async function CarShowCardPage({
  params,
}: {
  params: Promise<{ username: string; carId: string }>;
}) {
  const { username, carId } = await params;

  const user = await (prisma.user as any).findFirst({
    where: { username: username.toLowerCase(), isPublic: true },
    select: { id: true, name: true, username: true, publicBio: true },
  }) as any;
  if (!user) notFound();

  const car = await (prisma.car as any).findFirst({
    where: { id: carId, userId: user.id, isPublic: true },
    include: {
      photos: {
        where: { isPrivate: false },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "asc" }],
      },
      serviceRecords: {
        orderBy: { serviceDate: "desc" },
        take: 12,
        select: { id: true, title: true, serviceDate: true, mileage: true, serviceType: true, cost: true },
      },
      jobs: {
        where: { status: "done" },
        orderBy: { completedAt: "desc" },
        take: 10,
        select: { id: true, title: true, completedAt: true, notes: true },
      },
      mileageLogs: {
        orderBy: { recordedAt: "asc" },
        select: { mileage: true, recordedAt: true },
      },
      vinEnrichment: true,
    },
  });
  if (!car) notFound();

  const specs = await (prisma as any).vehicleSpecs?.findFirst?.({ where: { carId } }) ?? null;
  const enrichment = car.vinEnrichment;

  // Engine display — avoid "(4.6L)" duplication
  const engineDisplay = enrichment?.engine
    ? dedupeDisplacement(enrichment.engine, enrichment.displacement)
    : null;

  const txDisplay = car.transmission
    ? car.transmission.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : null;

  // Mileage stats
  const firstLog = car.mileageLogs[0];
  const acquiredMileage = firstLog?.mileage ?? null;
  const milesAdded = (car.mileage && acquiredMileage && car.mileage > acquiredMileage)
    ? car.mileage - acquiredMileage : null;

  const totalCost = car.serviceRecords.reduce((s: number, r: any) => s + (r.cost ?? 0), 0);

  const primaryPhoto = car.photos.find((p: any) => p.isFeatured) ?? car.photos[0] ?? null;
  const galleryPhotos = car.photos.filter((p: any) => p.id !== primaryPhoto?.id).slice(0, 9);

  const cardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ""}/u/${username}/car/${carId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(cardUrl)}&bgcolor=111827&color=e5e7eb&margin=10`;

  const vehicleBlurb = await ensureVehicleBlurb(carId, car.year, car.make, car.model, car.trim, enrichment);
  const ownedFor = car.acquiredDate ? ownershipDuration(car.acquiredDate) : null;

  // Vitals to display in the strip
  const vitals = [
    car.mileage ? { label: "Mileage", value: fmtMiles(car.mileage) } : null,
    txDisplay ? { label: "Trans", value: txDisplay } : null,
    engineDisplay ? { label: "Engine", value: engineDisplay } : null,
    ownedFor ? { label: "Owned", value: ownedFor, accent: true } : null,
    enrichment?.drivetrain ? { label: "Drive", value: enrichment.drivetrain } : null,
    specs?.horsepower ? { label: "Power", value: `${specs.horsepower} hp` } : null,
  ].filter(Boolean) as { label: string; value: string; accent?: boolean }[];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { page-break-after: always; }
        }
      `}</style>

      {/* Outer wrapper forces dark theme CSS vars, overriding any app light-mode */}
      <div style={DARK} className="min-h-screen">

        {/* ── Nav ── */}
        <div className="no-print max-w-xl mx-auto px-4 pt-4 pb-2 flex items-center gap-2 text-xs" style={{ color: "#6b7280" }}>
          <Link href={`/u/${username}`} style={{ color: "#6b7280" }} className="hover:text-white transition truncate max-w-[100px]">
            ← {user.name ?? username}
          </Link>
          <span>/</span>
          <span style={{ color: "#d1d5db" }} className="truncate">{car.year} {car.make} {car.model}</span>
          <div className="ml-auto"><PrintButton /></div>
        </div>

        <div className="max-w-xl mx-auto px-4 pb-8 space-y-4">

          {/* ── HERO ── */}
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9", background: "#111827" }}>
            {primaryPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/uploads/${primaryPhoto.filename}`}
                alt={`${car.year} ${car.make} ${car.model}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1f2937, #0a0a0a)" }}>
                <span className="text-7xl opacity-20"><Glyph e="🚗" /></span>
              </div>
            )}
            {/* Strong bottom gradient — readable over any photo */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.10) 100%)" }} />

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: "#ffffff", opacity: 0.85 }}>
                {car.year} · {car.make}
              </p>
              <h1 className="font-black tracking-tight leading-tight" style={{ fontSize: "1.5rem", color: "#ffffff", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
                {car.model}
              </h1>
              {car.trim && (
                <p className="font-semibold mt-0.5" style={{ fontSize: "1rem", color: "rgba(255,255,255,0.75)", textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}>
                  {car.trim}
                </p>
              )}
              {car.color && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{car.color}</p>
              )}
            </div>
          </div>

          {/* ── VITALS STRIP ── */}
          {vitals.length > 0 && (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(vitals.length, 3)}, 1fr)` }}>
              {vitals.map((v) => (
                <div key={v.label} className="rounded-xl px-3 py-3 text-center" style={{ background: "#111827", border: "1px solid #2a3142" }}>
                  <p style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#6b7280", marginBottom: "3px" }}>{v.label}</p>
                  <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "#f3f4f6", lineHeight: 1.2 }}>{v.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── VEHICLE HISTORY BLURB ── */}
          {vehicleBlurb && (
            <div className="rounded-2xl p-5" style={{ background: "#111827", border: "1px solid #2a3142" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#f59e0b" }}>Vehicle History</span>
                <div style={{ flex: 1, height: "1px", background: "#1f2937" }} />
              </div>
              <div>{renderBlurb(vehicleBlurb)}</div>
              <p style={{ fontSize: "0.7rem", color: "#374151", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #1f2937" }}>
                <Glyph e="✦" /> AI-generated overview about the {car.year} {car.make} {car.model} model
              </p>
            </div>
          )}

          {/* ── THE STORY ── */}
          {car.acquiredDate && (
            <div className="rounded-2xl p-5" style={{ background: "#111827", border: "1px solid #2a3142" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#f59e0b" }}>The Story</span>
                <div style={{ flex: 1, height: "1px", background: "#1f2937" }} />
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-base w-7 text-center flex-shrink-0"><Glyph e="🔑" /></span>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f3f4f6" }}>Acquired</p>
                    <p style={{ fontSize: "0.75rem", marginTop: "2px", color: "#9ca3af" }}>
                      {fmtDate(car.acquiredDate, { month: "long", day: "numeric", year: "numeric" })}
                      {acquiredMileage ? ` · ${fmtMiles(acquiredMileage)} at pickup` : ""}
                    </p>
                  </div>
                </div>

                {milesAdded !== null && milesAdded > 0 && (
                  <div className="flex items-start gap-3">
                    <span className="text-base w-7 text-center flex-shrink-0"><Glyph e="📍" /></span>
                    <div>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f3f4f6" }}>{fmtMiles(milesAdded)} added under this ownership</p>
                      <p style={{ fontSize: "0.75rem", marginTop: "2px", color: "#9ca3af" }}>{fmtMiles(acquiredMileage!)} → {fmtMiles(car.mileage)}</p>
                    </div>
                  </div>
                )}

                {car.serviceRecords.length > 0 && (
                  <div className="flex items-start gap-3">
                    <span className="text-base w-7 text-center flex-shrink-0"><Glyph e="🔧" /></span>
                    <div>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f3f4f6" }}>
                        {car.serviceRecords.length} service record{car.serviceRecords.length !== 1 ? "s" : ""} logged
                      </p>
                      {totalCost > 0 && (
                        <p style={{ fontSize: "0.75rem", marginTop: "2px", color: "#9ca3af" }}>${totalCost.toLocaleString()} in maintenance</p>
                      )}
                    </div>
                  </div>
                )}

                {car.jobs.length > 0 && (
                  <div className="flex items-start gap-3">
                    <span className="text-base w-7 text-center flex-shrink-0"><Glyph e="🏗" /></span>
                    <div>
                      <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f3f4f6" }}>
                        {car.jobs.length} project{car.jobs.length !== 1 ? "s" : ""} completed
                      </p>
                      <p style={{ fontSize: "0.75rem", marginTop: "2px", color: "#9ca3af" }}>Latest: {car.jobs[0].title}</p>
                    </div>
                  </div>
                )}
              </div>

              {((car as any).publicNotes || car.notes) && (
                <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #1f2937" }}>
                  <p style={{ fontSize: "0.875rem", lineHeight: 1.6, fontStyle: "italic", color: "#d1d5db" }}>
                    &ldquo;{(car as any).publicNotes ?? car.notes}&rdquo;
                  </p>
                  <p style={{ fontSize: "0.75rem", marginTop: "4px", color: "#4b5563" }}>— {user.name ?? username}</p>
                </div>
              )}
            </div>
          )}

          {/* ── SPECS ── */}
          {(enrichment || specs) && (
            <div className="rounded-2xl p-5" style={{ background: "#111827", border: "1px solid #2a3142" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#f59e0b" }}>Under the Hood</span>
                <div style={{ flex: 1, height: "1px", background: "#1f2937" }} />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {(([
                  engineDisplay ? ["Engine", engineDisplay] : null,
                  enrichment?.fuelType ? ["Fuel", enrichment.fuelType] : null,
                  txDisplay ? ["Transmission", txDisplay] : null,
                  enrichment?.drivetrain ? ["Drivetrain", enrichment.drivetrain] : null,
                  enrichment?.bodyStyle ? ["Body", enrichment.bodyStyle] : null,
                  specs?.horsepower ? ["Power", `${specs.horsepower} hp`] : null,
                  specs?.torque ? ["Torque", specs.torque] : null,
                  specs?.tireSize ? ["Tires", specs.tireSize] : null,
                  specs?.wheelSize ? ["Wheels", specs.wheelSize] : null,
                  specs?.timingBeltOrChain ? ["Timing", specs.timingBeltOrChain] : null,
                  car.color ? ["Color", car.color] : null,
                ].filter(Boolean) as [string, string][]).map(([label, value]) => (
                  <React.Fragment key={label}>
                    <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>{label}</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#f3f4f6" }}>{value}</span>
                  </React.Fragment>
                )))}
              </div>
            </div>
          )}

          {/* ── COMPLETED PROJECTS ── */}
          {car.jobs.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "#111827", border: "1px solid #2a3142" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}><span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#f59e0b" }}>Completed Projects</span><div style={{ flex: 1, height: "1px", background: "#1f2937" }} /></div>
              <div className="space-y-2.5">
                {car.jobs.map((j: any) => (
                  <div key={j.id} className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs" style={{ color: "#22c55e" }}><Glyph e="✓" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "#f3f4f6" }}>{j.title}</p>
                      {j.notes && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#4b5563" }}>{j.notes}</p>}
                    </div>
                    {j.completedAt && (
                      <span className="text-xs flex-shrink-0" style={{ color: "#4b5563" }}>
                        {new Date(j.completedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SERVICE HISTORY ── */}
          {car.serviceRecords.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "#111827", border: "1px solid #2a3142" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}><span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#f59e0b" }}>Service History</span><div style={{ flex: 1, height: "1px", background: "#1f2937" }} /></div>
              <div className="space-y-2.5">
                {car.serviceRecords.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2.5 text-sm">
                    <span className="w-5 text-center flex-shrink-0">{SVC_EMOJI[r.serviceType] ?? <Glyph e="🔧" />}</span>
                    <span className="flex-1 min-w-0 truncate" style={{ color: "#e5e7eb" }}>{r.title}</span>
                    <div className="flex items-center gap-2 text-xs flex-shrink-0" style={{ color: "#4b5563" }}>
                      {r.mileage && <span>{r.mileage.toLocaleString()} mi</span>}
                      {r.cost > 0 && <span style={{ color: "#166534" }}>${r.cost.toLocaleString()}</span>}
                      <span>{new Date(r.serviceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── GALLERY ── */}
          {galleryPhotos.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#9ca3af" }}>Gallery</p>
              <div className="grid grid-cols-3 gap-1.5">
                {galleryPhotos.map((p: any) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={`/uploads/${p.filename}`}
                    alt={p.caption ?? ""}
                    className="w-full rounded-xl object-cover"
                    style={{ aspectRatio: "1/1", border: "1px solid #1f2937" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── QR + SHARE ── */}
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "#111827", border: "1px solid #1f2937" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR code" width={80} height={80} className="rounded-xl flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs mb-1" style={{ color: "#4b5563" }}>Scan to view this car profile</p>
              <p className="text-xs font-mono break-all" style={{ color: "#9ca3af", lineHeight: "1.5" }}>
                {cardUrl.replace("https://", "")}
              </p>
              <p className="text-xs mt-2" style={{ color: "#374151" }}>
                Owner: <span style={{ color: "#6b7280" }}>{user.name ?? username}</span>
              </p>
            </div>
          </div>

          <p className="text-center text-xs pb-2" style={{ color: "#1f2937" }}>
            Built with <span style={{ color: "#4b5563" }}>My Garage</span> · garagemeet.com
          </p>

        </div>
      </div>
    </>
  );
}
