"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/app/lib/compressImage";
import Glyph from "@/app/components/Glyph";

interface ReceiptUploadButtonProps {
  jobId?: string;
  serviceRecordId?: string;
  carId?: string;
  onCreated?: (receipt: { id: string; vendor?: string | null; totalAmount?: number | null; receiptDate?: string | null; status: string; filename?: string | null; lineItems?: { id: string }[] }) => void;
  label?: string;
}

type ScanState = "idle" | "reading" | "ready";

interface ExtractedLineItem {
  name: string;
  quantity: number;
  amount: number;
}

interface FileEntry {
  localId: string;
  file: File;
  preview: string | null;
  scanState: ScanState;
  scanError: string | null;
  receiptId: string | null;
  vendor: string;
  totalAmount: string;
  receiptDate: string;
  notes: string;
  lineItems: ExtractedLineItem[];
}

async function readJsonOrThrow(res: Response): Promise<any> {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    const snippet = raw.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(`Server returned non-JSON (${res.status}). ${snippet || "Empty response"}`);
  }
}

export default function ReceiptUploadButton({
  jobId,
  serviceRecordId,
  carId,
  onCreated,
  label = "+ Add Receipt",
}: ReceiptUploadButtonProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const reset = () => {
    setEntries([]);
    setSaving(false);
    setOpen(false);
  };

  const updateEntry = (localId: string, updates: Partial<FileEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, ...updates } : e))
    );
  };

  const processEntry = async (entry: FileEntry) => {
    updateEntry(entry.localId, { scanState: "reading" });
    try {
      const compressed = await compressImage(entry.file);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("type", "receipt");
      const uploadRes = await fetch("/api/receipts", { method: "POST", body: fd });
      const uploadData = await readJsonOrThrow(uploadRes);
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      const newReceiptId = uploadData.receipt.id;

      const processRes = await fetch(`/api/receipts/${newReceiptId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId: carId ?? null }),
      });
      const processData = await readJsonOrThrow(processRes);

      const updates: Partial<FileEntry> = { receiptId: newReceiptId, scanState: "ready" };
      if (processRes.ok && processData.extracted) {
        const x = processData.extracted;
        if (x.vendor) updates.vendor = x.vendor;
        if (x.totalAmount) updates.totalAmount = String(x.totalAmount);
        if (x.receiptDate) updates.receiptDate = x.receiptDate;
        if (x.notes) updates.notes = x.notes;
        if (Array.isArray(x.lineItems) && x.lineItems.length > 0) updates.lineItems = x.lineItems;
      }

      updateEntry(entry.localId, updates);
    } catch (e) {
      updateEntry(entry.localId, {
        scanState: "ready",
        scanError: (e as Error).message,
      });
    }
  };

  const handleFiles = async (fileList: FileList) => {
    const today = new Date().toISOString().slice(0, 10);
    const newEntries: FileEntry[] = Array.from(fileList).map((file, i) => ({
      localId: `${Date.now()}-${i}`,
      file,
      preview: null,
      scanState: "idle" as ScanState,
      scanError: null,
      receiptId: null,
      vendor: "",
      totalAmount: "",
      receiptDate: today,
      notes: "",
      lineItems: [],
    }));

    // Pre-generate image previews before setting state
    for (const entry of newEntries) {
      if (entry.file.type.startsWith("image/")) {
        entry.preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(entry.file);
        });
      }
    }

    setEntries((prev) => [...prev, ...newEntries]);

    // Process all in parallel
    await Promise.all(newEntries.map((e) => processEntry(e)));
  };

  const saveAll = async (link: boolean) => {
    setSaving(true);
    try {
      for (const entry of entries) {
        const body: Record<string, unknown> = {
          vendor: entry.vendor || null,
          totalAmount: entry.totalAmount ? parseFloat(entry.totalAmount) : null,
          receiptDate: entry.receiptDate || null,
          notes: entry.notes || null,
        };
        if (link && jobId) body.jobId = jobId;
        if (link && serviceRecordId) body.serviceRecordId = serviceRecordId;

        if (entry.receiptId) {
          const res = await fetch(`/api/receipts/${entry.receiptId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await readJsonOrThrow(res);
          if (!res.ok) throw new Error(data.error);

          // Save extracted line items
          if (entry.lineItems.length > 0) {
            // Clear existing then bulk-create
            await fetch(`/api/receipts/${entry.receiptId}/line-items/bulk`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lineItems: entry.lineItems }),
            });
          }

          if (onCreated) onCreated(data.receipt);
        } else {
          const fd = new FormData();
          fd.append("file", entry.file);
          if (entry.vendor) fd.append("vendor", entry.vendor);
          if (entry.totalAmount) fd.append("totalAmount", entry.totalAmount);
          if (entry.receiptDate) fd.append("receiptDate", entry.receiptDate);
          if (entry.notes) fd.append("notes", entry.notes);
          if (link && jobId) fd.append("jobId", jobId);
          if (link && serviceRecordId) fd.append("serviceRecordId", serviceRecordId);
          const res = await fetch("/api/receipts", { method: "POST", body: fd });
          const data = await readJsonOrThrow(res);
          if (!res.ok) throw new Error(data.error);
          if (onCreated) onCreated(data.receipt);
        }
      }

      if (!onCreated) router.refresh();
      reset();
    } catch (e) {
      alert("Error: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const canLink = !!(jobId || serviceRecordId);
  const allReady = entries.length > 0 && entries.every((e) => e.scanState === "ready");
  const anyProcessing = entries.some((e) => e.scanState === "reading");
  const inputCls =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 text-sm";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 active:bg-amber-500/20 transition"
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70">
          <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                {entries.length > 1 ? `Add Receipts (${entries.length})` : "Add Receipt"}
              </h2>
              {anyProcessing && (
                <span className="text-xs text-amber-400 animate-pulse"><Glyph e="🤖" /> Reading…</span>
              )}
              {allReady && entries.length > 0 && (
                <span className="text-xs text-emerald-400">
                  <Glyph e="✓" /> {entries.length === 1 ? "AI filled in details" : `${entries.length} receipts ready`}
                </span>
              )}
            </div>

            {/* Initial file picker — shown only before any files are added */}
            {entries.length === 0 && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-2xl py-6 text-gray-400 active:border-amber-500 active:bg-amber-500/5 transition"
                >
                  <span className="text-4xl"><Glyph e="📷" /></span>
                  <span className="text-xs font-medium">Take photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-2xl py-6 text-gray-400 active:border-amber-500 active:bg-amber-500/5 transition"
                >
                  <span className="text-4xl"><Glyph e="🗂" /></span>
                  <span className="text-xs font-medium">Choose files</span>
                </button>
              </div>
            )}

            {/* File queue */}
            {entries.length > 0 && (
              <div className="space-y-4">
                {entries.map((entry) => (
                  <div key={entry.localId} className="border border-gray-700 rounded-2xl p-4 space-y-3">
                    {/* Row: filename + status + remove */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 truncate flex-1 min-w-0">
                        {entry.file.name}
                      </span>
                      {entry.scanState === "reading" && (
                        <span className="flex items-center gap-1 text-xs text-amber-400 shrink-0">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Reading…
                        </span>
                      )}
                      {entry.scanState === "ready" && !entry.scanError && (
                        <span className="text-xs text-emerald-400 shrink-0"><Glyph e="✓" /> Ready</span>
                      )}
                      {entry.scanError && (
                        <span className="text-xs text-amber-500 shrink-0"><Glyph e="⚠" /> Manual</span>
                      )}
                      <button
                        onClick={() =>
                          setEntries((prev) => prev.filter((e) => e.localId !== entry.localId))
                        }
                        className="text-gray-600 hover:text-gray-400 text-sm shrink-0 ml-1"
                      >
                        <Glyph e="✕" />
                      </button>
                    </div>

                    {/* Preview */}
                    {entry.preview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.preview}
                        alt="receipt"
                        className="w-full max-h-32 rounded-xl object-contain bg-gray-800"
                      />
                    )}
                    {!entry.preview && entry.scanState !== "idle" && (
                      <div className="w-full h-14 flex items-center justify-center bg-gray-800 rounded-xl text-gray-500 text-xs gap-2">
                        <span><Glyph e="📄" /></span>
                        <span className="truncate max-w-[200px]">{entry.file.name}</span>
                      </div>
                    )}

                    {entry.scanError && (
                      <p className="text-xs text-amber-500 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                        <Glyph e="⚠" /> Couldn&apos;t read automatically — fill in details below.
                      </p>
                    )}

                    {/* Editable fields — shown once AI is done */}
                    {entry.scanState === "ready" && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Vendor / shop name"
                          value={entry.vendor}
                          onChange={(e) => updateEntry(entry.localId, { vendor: e.target.value })}
                          className={inputCls}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder="Total ($)"
                            value={entry.totalAmount}
                            onChange={(e) => updateEntry(entry.localId, { totalAmount: e.target.value })}
                            className={inputCls}
                          />
                          <input
                            type="date"
                            value={entry.receiptDate}
                            onChange={(e) => updateEntry(entry.localId, { receiptDate: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <textarea
                          placeholder="Notes (optional)"
                          value={entry.notes}
                          onChange={(e) => updateEntry(entry.localId, { notes: e.target.value })}
                          rows={2}
                          className={`${inputCls} resize-none`}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Add more */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full py-2.5 border border-dashed border-gray-700 rounded-xl text-xs text-gray-500 hover:text-gray-400 hover:border-gray-600 transition"
                >
                  + Add more files
                </button>
              </div>
            )}

            {/* Hidden inputs */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm active:bg-gray-800 transition"
              >
                Cancel
              </button>
              {allReady && (
                <>
                  <button
                    onClick={() => saveAll(false)}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gray-700 text-white text-sm active:bg-gray-600 transition disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save to Inbox"}
                  </button>
                  {canLink && (
                    <button
                      onClick={() => saveAll(true)}
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 text-on-accent font-semibold text-sm active:bg-amber-400 transition disabled:opacity-50"
                    >
                      {saving
                        ? "Saving…"
                        : entries.length === 1
                        ? "Save & Link"
                        : `Link All (${entries.length})`}
                    </button>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}
