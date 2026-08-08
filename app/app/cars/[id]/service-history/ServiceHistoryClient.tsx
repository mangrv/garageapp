"use client";

import { useState, useTransition, useRef } from "react";
import { createServiceRecord, updateServiceRecord, deleteServiceRecord } from "./actions";
import { useApp } from "@/app/providers/AppProviders";
import { t } from "@/lib/i18n";
import ReceiptScanFlow from "@/app/components/ReceiptScanFlow";

type ServiceRecord = {
  id: string;
  carId: string;
  jobId: string | null;
  title: string;
  serviceType: string | null;
  notes: string | null;
  details: string | null;
  partsUsed: string | null;
  cost: number | null;
  nextServiceDue: string | null;
  duration: string | null;
  partsSource: string | null;
  mileage: number | null;
  serviceDate: string;
  createdAt: string;
  receipts?: {
    id: string;
    filename: string | null;
    vendor: string | null;
    totalAmount: number | null;
    lineItems?: { id: string; name: string; quantity: number; amount: number | null; notes: string | null; warrantyProvider?: string | null; warrantyStart?: string | null; warrantyEnd?: string | null; warrantyNotes?: string | null }[];
  }[];
};

type CSVRow = Record<string, string>;

function toInputDate(iso: string) { return iso.slice(0, 10); }
function formatDate(iso: string) {
  // Parse date-only portion to avoid timezone shifts (2025-12-13T00:00:00Z showing as Dec 12 in UTC-5)
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600";
const labelCls = "block text-xs text-gray-400 mb-1";

// ── CSV Import Modal ────────────────────────────────────────────────────────

function CSVImportModal({ carId, onClose, onImported }: {
  carId: string;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [parsedRows, setParsedRows] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<CSVRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  const handleFile = async (file: File) => {
    setError("");
    try {
      const text = await file.text();
      // Send raw CSV to server for parsing
      const res = await fetch(`/api/cars/${carId}/service-history/import`, {
        method: "PUT",
        body: text,
        headers: { "Content-Type": "text/plain" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");
      setHeaders(data.headers);
      setParsedRows(data.rows);
      setPreviewRows(data.rows.slice(0, 5));
      setStep("preview");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to read file");
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError("");
    try {
      const res = await fetch(`/api/cars/${carId}/service-history/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportedCount(data.imported);
      setStep("done");
      onImported(data.imported);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-t-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-white">📥 Import Service History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Upload a CSV exported from your spreadsheet</p>
          </div>
          <button onClick={onClose} className="text-gray-500 text-xl px-2">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {step === "upload" && (
            <>
              {/* Expected columns hint */}
              <div className="bg-gray-800/60 rounded-xl p-3 text-xs text-gray-400 space-y-1">
                <div className="font-semibold text-gray-300 mb-1.5">Expected CSV columns (auto-detected):</div>
                {[
                  ["Date of Service", "date of the service event"],
                  ["Odometer (mi)", "mileage at time of service"],
                  ["Service Type", "oil change, tire rotation, etc."],
                  ["Details / Work Performed", "description of work done"],
                  ["Parts Used (with Part #s)", "parts list with part numbers"],
                  ["Cost ($)", "total cost"],
                  ["Next Service Due (mi or date)", "reminder for next service"],
                  ["Time to complete the job", "duration / hours"],
                  ["Where parts were purchased", "vendor / store"],
                  ["Notes", "any additional notes"],
                ].map(([col, desc]) => (
                  <div key={col} className="flex gap-2">
                    <span className="text-amber-400 font-mono min-w-fit">{col}</span>
                    <span className="text-gray-600">— {desc}</span>
                  </div>
                ))}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-700 hover:border-amber-500 rounded-2xl py-8 text-center transition-colors"
              >
                <div className="text-3xl mb-2">📄</div>
                <div className="text-sm text-gray-300 font-medium">Tap to select your CSV file</div>
                <div className="text-xs text-gray-600 mt-1">Exported from Google Sheets, Excel, or Numbers</div>
              </button>

              {error && <div className="text-red-400 text-xs bg-red-900/20 border border-red-700/40 rounded-xl p-3">{error}</div>}
            </>
          )}

          {step === "preview" && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-3 py-2 text-sm text-emerald-300">
                  ✅ Found <strong>{parsedRows.length}</strong> records · {headers.length} columns detected
                </div>
                <button onClick={() => setStep("upload")} className="text-xs text-gray-500 px-2">← back</button>
              </div>

              {/* Column mapping display */}
              <div className="bg-gray-800/50 rounded-xl p-3">
                <div className="text-xs text-gray-400 font-semibold mb-2">Detected columns:</div>
                <div className="flex flex-wrap gap-1.5">
                  {headers.map((h) => (
                    <span key={h} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{h}</span>
                  ))}
                </div>
              </div>

              {/* Preview rows */}
              <div>
                <div className="text-xs text-gray-400 font-semibold mb-2">Preview (first {previewRows.length} rows):</div>
                <div className="space-y-2">
                  {previewRows.map((row, i) => {
                    // Find the date/mileage/type columns (original headers)
                    const dateKey = headers.find(h => /date/i.test(h));
                    const miKey = headers.find(h => /odometer|mileage/i.test(h));
                    const typeKey = headers.find(h => /service type|type/i.test(h));
                    const detailKey = headers.find(h => /detail|work|description/i.test(h));
                    const costKey = headers.find(h => /cost|\$/i.test(h));
                    return (
                      <div key={i} className="bg-gray-800 rounded-xl p-3 text-xs space-y-1">
                        <div className="font-semibold text-white">
                          {(typeKey && row[typeKey]) || (detailKey && row[detailKey]?.slice(0, 60)) || `Row ${i + 1}`}
                        </div>
                        <div className="flex flex-wrap gap-3 text-gray-400">
                          {dateKey && row[dateKey] && <span>📅 {row[dateKey]}</span>}
                          {miKey && row[miKey] && <span>📍 {row[miKey]} mi</span>}
                          {costKey && row[costKey] && <span>💰 {row[costKey]}</span>}
                        </div>
                        {detailKey && row[detailKey] && (
                          <div className="text-gray-500 truncate">{row[detailKey]}</div>
                        )}
                      </div>
                    );
                  })}
                  {parsedRows.length > 5 && (
                    <div className="text-xs text-gray-600 text-center py-1">
                      …and {parsedRows.length - 5} more records
                    </div>
                  )}
                </div>
              </div>

              {error && <div className="text-red-400 text-xs bg-red-900/20 border border-red-700/40 rounded-xl p-3">{error}</div>}

              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full bg-amber-500 text-gray-950 font-bold py-3 rounded-2xl text-sm disabled:opacity-40 active:scale-95 transition-transform"
              >
                {importing ? "Importing…" : `📥 Import ${parsedRows.length} Records`}
              </button>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">✅</div>
              <div>
                <div className="text-lg font-bold text-white">{importedCount} records imported!</div>
                <div className="text-sm text-gray-400 mt-1">Your service history is now up to date.</div>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-amber-500 text-gray-950 font-bold py-3 rounded-2xl text-sm"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Service Record Row ──────────────────────────────────────────────────────

function ReceiptRelinkRow({ receipt, currentServiceRecordId, carId }: {
  receipt: NonNullable<ServiceRecord["receipts"]>[number];
  currentServiceRecordId: string;
  carId: string;
}) {
  const [serviceRecords, setServiceRecords] = useState<{ id: string; title: string; serviceDate: string }[]>([]);
  const [moving, setMoving] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const load = async () => {
    if (serviceRecords.length > 0) { setMoving(true); return; }
    const res = await fetch(`/api/cars/${carId}/service-records`);
    const data = await res.json();
    setServiceRecords(data.serviceRecords ?? []);
    setMoving(true);
  };

  const handleMove = async () => {
    if (!targetId) return;
    setSaving(true);
    await fetch(`/api/receipts/${receipt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceRecordId: targetId }),
    });
    setSaving(false);
    setMoving(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="text-xs text-green-400 bg-green-900/20 border border-green-700/30 rounded-xl px-3 py-2">
        ✓ Receipt moved — refresh to see updated view
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🧾</span>
          <div className="min-w-0">
            <p className="text-xs text-white truncate">{receipt.vendor ?? "Receipt"}</p>
            {receipt.totalAmount != null && (
              <p className="text-xs text-amber-400">${receipt.totalAmount.toFixed(2)}</p>
            )}
          </div>
        </div>
        <button
          onClick={moving ? () => setMoving(false) : load}
          className="text-xs text-gray-400 border border-gray-600 rounded-lg px-2 py-1 active:bg-gray-700 transition flex-shrink-0"
        >
          {moving ? "Cancel" : "Move →"}
        </button>
      </div>

      {moving && (
        <div className="space-y-2">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-2 py-2 text-xs text-white"
          >
            <option value="">— pick a service record —</option>
            {serviceRecords
              .filter((sr) => sr.id !== currentServiceRecordId)
              .map((sr) => (
                <option key={sr.id} value={sr.id}>
                  {sr.title} · {new Date(sr.serviceDate.slice(0,10)+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                </option>
              ))}
          </select>
          <button
            onClick={handleMove}
            disabled={!targetId || saving}
            className="w-full bg-amber-500 text-gray-950 font-bold text-sm py-2.5 rounded-xl disabled:opacity-40 active:bg-amber-400 transition"
          >
            {saving ? "Moving…" : "✓ Move Receipt"}
          </button>
        </div>
      )}
    </div>
  );
}

function ServiceRecordRow({ record }: { record: ServiceRecord }) {
  const { lang } = useApp();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(record.title);
  const [notes, setNotes] = useState(record.notes ?? "");
  const [mileage, setMileage] = useState(record.mileage ? String(record.mileage) : "");
  const [serviceDate, setServiceDate] = useState(toInputDate(record.serviceDate));
  const [showDelete, setShowDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateServiceRecord(record.id, record.carId, title, notes, mileage, serviceDate);
      setEditing(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteServiceRecord(record.id, record.carId);
    });
  };

  const editLineItems = (record.receipts ?? []).flatMap((r) =>
    (r.lineItems ?? []).map((li) => ({ ...li, vendor: r.vendor }))
  );

  if (editing) {
    return (
      <div className="bg-gray-900 border border-amber-600 rounded-2xl p-4 space-y-3">
        <div>
          <label className={labelCls}>Service title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>🔧 Service date</label>
            <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mileage</label>
            <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="e.g. 87500" className={inputCls} />
          </div>
        </div>

        {/* Linked receipts — with re-link option */}
        {(record.receipts?.length ?? 0) > 0 && (
          <div>
            <label className={labelCls}>🧾 Linked Receipts</label>
            <div className="space-y-2">
              {record.receipts!.map((rc) => (
                <ReceiptRelinkRow key={rc.id} receipt={rc} currentServiceRecordId={record.id} carId={record.carId} />
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>Memo / Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observations, extra notes…" className={inputCls} />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={pending} className="flex-1 bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-40">
            {pending ? t("saving", lang) : t("save", lang)}
          </button>
          <button onClick={() => setEditing(false)} className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm">{t("cancel", lang)}</button>
        </div>
        <div className="border-t border-gray-800 pt-2">
          {showDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 text-center">{t("confirmDelete", lang)}</p>
              <div className="flex gap-2">
                <button onClick={handleDelete} disabled={pending} className="flex-1 bg-red-700 text-white font-semibold py-2 rounded-xl text-sm disabled:opacity-40">Yes, remove</button>
                <button onClick={() => setShowDelete(false)} className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-sm">{t("cancel", lang)}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDelete(true)} className="w-full text-xs text-red-500 py-2">🗑 {t("deleteRecord", lang)}</button>
          )}
        </div>
      </div>
    );
  }

  // All line items from linked receipts
  const allLineItems = (record.receipts ?? []).flatMap((r) =>
    (r.lineItems ?? []).map((li) => ({ ...li, vendor: r.vendor, receiptId: r.id }))
  );
  const hasLineItems = allLineItems.length > 0;
  const hasExtra = record.details || record.partsUsed || record.cost != null ||
    record.nextServiceDue || record.duration || record.partsSource || hasLineItems;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <a href={`/cars/${record.carId}/service-history/${record.id}`} className="flex-1 min-w-0 block">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-white">{record.title}</span>
            {record.serviceType && record.serviceType !== record.title && (
              <span className="text-xs bg-gray-800 text-amber-400 border border-amber-700/30 px-2 py-0.5 rounded-full">{record.serviceType}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
            <span>📅 {formatDate(record.serviceDate)}</span>
            {record.mileage != null && <span>📍 {record.mileage.toLocaleString()} mi</span>}
            {(() => {
              // Prefer sum of linked receipt totals over the imported cost field
              const receiptSum = (record.receipts ?? []).reduce((s, r) => s + (r.totalAmount ?? 0), 0);
              const displayCost = receiptSum > 0 ? receiptSum : record.cost;
              return displayCost != null && displayCost > 0
                ? <span className={(record.receipts?.length ?? 0) > 0 ? "💰 text-amber-400" : "💰"}>💰 ${displayCost.toFixed(2)}</span>
                : null;
            })()}
            {record.duration && <span>⏱ {record.duration}</span>}
            {record.jobId && (
              <a href={`/job/${record.jobId}`} className="text-amber-400 underline">🔧 View job →</a>
            )}
          </div>
          {record.notes && (
            <p className="mt-2 text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{record.notes}</p>
          )}
        </a>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasExtra && (
            <button
              onClick={() => setExpanded((x) => !x)}
              className="text-xs text-gray-600 active:text-gray-400 px-1"
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
          <button onClick={() => setEditing(true)} className="text-gray-600 text-sm active:text-amber-400 px-1">✏️</button>
        </div>
      </div>

      {/* Expanded detail section */}
      {expanded && hasExtra && (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">

          {/* Receipt line items — structured list (source of truth) */}
          {hasLineItems && (
            <div>
              <div className="text-xs text-gray-500 font-semibold mb-1.5">🔩 Parts & Items</div>
              <div className="space-y-1">
                {allLineItems.map((li) => (
                  <div key={li.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-amber-500/60 text-[10px]">🧾</span>
                        <span className="text-gray-200 truncate">{li.name}</span>
                        {li.quantity > 1 && <span className="text-gray-500">×{li.quantity}</span>}
                      </div>
                      {li.amount != null && (
                        <span className="text-gray-400 flex-shrink-0">${(li.amount * li.quantity).toFixed(2)}</span>
                      )}
                    </div>
                    {(li.warrantyProvider || li.warrantyEnd || li.warrantyStart) && (
                      <div className="ml-5 mt-0.5 text-sky-300">
                        🛡️ {li.warrantyProvider ?? "Warranty"}
                        {li.warrantyEnd ? ` · expires ${new Date(li.warrantyEnd).toLocaleDateString()}` : ""}
                      </div>
                    )}
                  </div>
                ))}
                {/* Total */}
                {allLineItems.some((li) => li.amount != null) && (
                  <div className="flex justify-between text-xs pt-1 border-t border-gray-800 mt-1">
                    <span className="text-gray-500">Total</span>
                    <span className="text-amber-400 font-semibold">
                      ${allLineItems.reduce((s, li) => s + (li.amount ?? 0) * li.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plain-text details — always shown when present (imported data) */}
          {record.details && (
            <div>
              <div className="text-xs text-gray-500 font-semibold">📝 Notes / Work Performed</div>
              <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed mt-0.5">{record.details}</div>
            </div>
          )}
          {record.partsUsed && (
            <div>
              <div className="text-xs text-gray-500 font-semibold">🔩 Parts Used</div>
              <div className="text-xs text-gray-300 whitespace-pre-wrap mt-0.5">{record.partsUsed}</div>
            </div>
          )}

          {record.partsSource && (
            <div className="text-xs text-gray-400">🛒 From: <span className="text-gray-300">{record.partsSource}</span></div>
          )}
          {record.nextServiceDue && (
            <div className="text-xs text-sky-400 bg-sky-900/20 border border-sky-700/30 rounded-lg px-2 py-1">
              🔔 Next service due: {record.nextServiceDue}
            </div>
          )}

          {/* Warranty summary + edit link */}
          {(() => {
            const warrantyItems = allLineItems.filter((li) => li.warrantyProvider || li.warrantyStart || li.warrantyEnd);
            return (
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {warrantyItems.length > 0 ? (
                    warrantyItems.map((li) => {
                      const now = new Date();
                      const end = li.warrantyEnd ? new Date(li.warrantyEnd) : null;
                      const soon = end && end > now && (end.getTime() - now.getTime()) < 30 * 24 * 60 * 60 * 1000;
                      const expired = end && end < now;
                      return (
                        <span
                          key={li.id}
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            expired ? "bg-red-900/40 text-red-300" :
                            soon ? "bg-amber-900/40 text-amber-300" :
                            "bg-sky-900/40 text-sky-300"
                          }`}
                        >
                          🛡️ {li.name}{li.warrantyEnd ? ` · ${new Date(li.warrantyEnd).toLocaleDateString()}` : ""}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-gray-600">No warranty info</span>
                  )}
                </div>
                <a
                  href={`/cars/${record.carId}/service-history/${record.id}#warranty`}
                  // record.carId is defined on the ServiceRecord type
                  className="text-xs bg-sky-800/40 text-sky-300 border border-sky-700/40 px-3 py-1.5 rounded-xl font-semibold flex-shrink-0 active:opacity-70"
                >
                  🛡️ {warrantyItems.length > 0 ? "Edit" : "Add"} Warranty
                </a>
              </div>
            );
          })()}
        </div>
      )}

      {/* Receipts row */}
      {(record.receipts?.length ?? 0) > 0 && (
        <ReceiptStrip receipts={record.receipts!} />
      )}
    </div>
  );
}

function ReceiptStrip({ receipts }: { receipts: { id: string; filename: string | null; vendor: string | null; totalAmount: number | null }[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      <div className="mt-3 pt-3 border-t border-gray-800">
        <div className="text-xs text-gray-500 font-semibold mb-2">🧾 Receipts</div>
        <div className="flex gap-2 flex-wrap">
          {receipts.map((r) => {
            const isImage = r.filename && /\.(jpg|jpeg|png|gif|webp)$/i.test(r.filename);
            return (
              <button
                key={r.id}
                onClick={() => isImage ? setLightbox(`/uploads/${r.filename}`) : window.open(`/uploads/${r.filename}`, "_blank")}
                className="relative group flex-shrink-0"
                title={r.vendor ?? "Receipt"}
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-800 border border-gray-700 active:border-amber-500 transition">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/uploads/${r.filename}`} alt="receipt" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">📄</div>
                  )}
                </div>
                {r.totalAmount != null && (
                  <span className="absolute -bottom-1 left-0 right-0 text-center text-[10px] text-amber-400 font-semibold">
                    ${r.totalAmount.toFixed(0)}
                  </span>
                )}
              </button>
            );
          })}
          <a
            href={`/receipts`}
            className="w-16 h-16 rounded-xl border border-dashed border-gray-700 flex items-center justify-center text-gray-600 text-xs text-center leading-tight active:bg-gray-800 transition flex-shrink-0"
          >
            All<br/>receipts
          </a>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="receipt" className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl" />
          <button
            className="absolute top-4 right-4 text-white text-2xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >✕</button>
        </div>
      )}
    </>
  );
}

// ── Add Record Form ─────────────────────────────────────────────────────────

function AddRecordForm({ carId, onClose }: { carId: string; onClose: () => void }) {
  const { lang } = useApp();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [mileage, setMileage] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();

  const handleCreate = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await createServiceRecord({ carId, title, notes, mileage: parseInt(mileage) || null, serviceDate });
      onClose();
    });
  };

  return (
    <div className="bg-gray-900 border border-amber-600 rounded-2xl p-4 space-y-3">
      <div className="text-sm font-bold text-white">{lang === "es" ? "+ Entrada manual" : "+ Manual Entry"}</div>
      <div>
        <label className={labelCls}>{lang === "es" ? "Título del servicio *" : "Service title *"}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lang === "es" ? "ej. Cambio de aceite, rotación de llantas…" : "e.g. Oil change, Tire rotation…"} className={inputCls} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{lang === "es" ? "Fecha *" : "Date *"}</label>
          <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{lang === "es" ? "Millaje" : "Mileage"}</label>
          <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="e.g. 87500" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>{lang === "es" ? "Notas" : "Notes"}</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={lang === "es" ? "Piezas usadas, taller, observaciones…" : "Parts used, shop name, observations…"} className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={pending || !title.trim()}
          className="flex-1 bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-40">
          {pending ? t("saving", lang) : t("addServiceRecord", lang)}
        </button>
        <button onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm">{t("cancel", lang)}</button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ServiceHistoryClient({
  carId, carName, records: initialRecords,
}: {
  carId: string;
  carName: string;
  records: ServiceRecord[];
}) {
  const { lang } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [importFlash, setImportFlash] = useState("");
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<string>("all");

  const QUICK_FILTERS = [
    { key: "all", label: lang === "es" ? "Todo" : "All" },
    { key: "oil", label: lang === "es" ? "Aceite" : "Oil" },
    { key: "brake", label: lang === "es" ? "Frenos" : "Brakes" },
    { key: "tire", label: lang === "es" ? "Llantas" : "Tires" },
    { key: "paint", label: lang === "es" ? "Carrocería/Pintura" : "Body/Paint" },
  ] as const;

  const q = search.trim().toLowerCase();
  const filteredRecords = initialRecords.filter((r) => {
    const receiptText = (r.receipts ?? [])
      .flatMap((rc) => [rc.vendor ?? "", ...(rc.lineItems ?? []).map((li) => li.name)])
      .join(" ")
      .toLowerCase();

    const haystack = [
      r.title,
      r.serviceType ?? "",
      r.notes ?? "",
      r.details ?? "",
      r.partsUsed ?? "",
      r.partsSource ?? "",
      r.nextServiceDue ?? "",
      String(r.mileage ?? ""),
      formatDate(r.serviceDate),
      receiptText,
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = q.length === 0 || haystack.includes(q);
    const matchesQuick = quickFilter === "all" || haystack.includes(quickFilter);
    return matchesSearch && matchesQuick;
  });

  const handleImported = (count: number) => {
    setImportFlash(lang === "es" ? `✅ ${count} registros importados — refresca para verlos` : `✅ ${count} records imported — refresh to see them`);
    setShowImport(false);
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-950 pb-24 w-full max-w-full overflow-x-hidden">
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 pt-3 pb-3">
        {/* Row 1: Back · Title · Add */}
        <div className="flex items-center gap-2">
          <a
            href={`/cars/${carId}`}
            className="flex-shrink-0 text-xl font-light text-gray-400 active:text-white w-8 h-8 flex items-center justify-center rounded-xl active:bg-gray-800 transition-colors"
          >‹</a>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base text-white leading-tight">{t("serviceHistory", lang)}</h1>
            <div className="text-xs text-gray-400 mt-0.5 truncate">{carName}</div>
          </div>
          <button
            onClick={() => setShowAdd((o) => !o)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${showAdd ? "bg-amber-500 text-gray-950" : "bg-amber-500 text-gray-950"}`}
          >
            {showAdd ? (lang === "es" ? "✕ Cancelar" : "✕ Cancel") : (lang === "es" ? "+ Agregar" : "+ Add")}
          </button>
        </div>

        {/* Row 2: Secondary actions */}
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => setShowScan(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 active:bg-amber-500/20 transition-colors"
          >
            🤖 {lang === "es" ? "Escaneo IA" : "AI Scan"}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-gray-800 text-gray-300 border border-gray-700 active:bg-gray-700 transition-colors"
          >
            📥 {lang === "es" ? "Importar CSV" : "Import CSV"}
          </button>
        </div>
      </header>

      {importFlash && (
        <div className="mx-4 mt-4 bg-emerald-900/40 border border-emerald-700/50 rounded-xl px-4 py-3 text-sm text-emerald-300">
          {importFlash}
        </div>
      )}

      <div className="px-4 pt-4 space-y-3">
        {showAdd && <AddRecordForm carId={carId} onClose={() => setShowAdd(false)} />}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-3 py-2.5 space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "es" ? "Buscar por servicio, notas, piezas, proveedor, millaje…" : "Search by service, notes, parts, vendor, mileage…"}
            className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_FILTERS.map((f) => {
              const active = quickFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setQuickFilter(f.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${active
                    ? "bg-amber-500 text-gray-950 border-amber-500 font-semibold"
                    : "bg-gray-800 text-gray-300 border-gray-700 active:bg-gray-700"
                    }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {(q.length > 0 || quickFilter !== "all") && (
            <div className="text-[11px] text-gray-500">
              {lang === "es" ? `${filteredRecords.length} coincidencia${filteredRecords.length === 1 ? "" : "s"}` : `${filteredRecords.length} match${filteredRecords.length === 1 ? "" : "es"}`}
            </div>
          )}
        </div>

        {initialRecords.length === 0 && !showAdd ? (
          <div className="text-center py-12 text-gray-600 space-y-3">
            <div className="text-4xl">🛠</div>
            <p className="text-sm">{t("noServiceHistory", lang)}</p>
            <p className="text-xs">{lang === "es" ? "Importa tu CSV o agrega una entrada manual." : "Import your CSV or add a manual entry."}</p>
            <button
              onClick={() => setShowImport(true)}
              className="mt-2 text-sm bg-amber-500/20 text-amber-400 border border-amber-600/40 px-4 py-2 rounded-xl"
            >
              📥 {lang === "es" ? "Importar desde CSV" : "Import from CSV"}
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            {lang === "es" ? `No hay registros de servicio que coincidan con "${search.trim()}".` : `No service records match "${search.trim()}".`}
          </div>
        ) : (
          filteredRecords.map((r) => <ServiceRecordRow key={r.id} record={r} />)
        )}
      </div>

      {showImport && (
        <CSVImportModal
          carId={carId}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}
      {showScan && (
        <ReceiptScanFlow
          carId={carId}
          cars={[{ id: carId, year: 0, make: carName, model: "", trim: null }]}
          onDone={() => { setShowScan(false); window.location.reload(); }}
          onClose={() => setShowScan(false)}
        />
      )}
    </div>
  );
}
