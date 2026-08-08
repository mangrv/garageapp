"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { compressImage } from "@/app/lib/compressImage";
import { useApp } from "@/app/providers/AppProviders";
import { useT } from "@/app/hooks/useT";

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  amount: number | null;
  notes: string | null;
  warrantyProvider?: string | null;
  warrantyStart?: string | Date | null;
  warrantyEnd?: string | Date | null;
  warrantyNotes?: string | null;
}

interface Receipt {
  id: string;
  filename: string | null;
  vendor: string | null;
  totalAmount: number | null;
  receiptDate: string | null;
  notes: string | null;
  status: string;
  lineItems: LineItem[];
  fileType?: string; // undefined = AI-scanned receipt; set = plain file attachment
}

interface ServiceRecord {
  id: string;
  title: string;
  serviceType: string | null;
  serviceDate: string;
  mileage: number | null;
  cost: number | null;
  notes: string | null;
  details: string | null;
  partsUsed: string | null;
  partsSource: string | null;
  duration: string | null;
  nextServiceDue: string | null;
  receipts: Receipt[];
}

function isImage(filename: string | null) {
  return !!filename && /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(filename);
}

function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function ReceiptSection({ receipt, onMoved }: { receipt: Receipt; onMoved: (id: string) => void }) {
  const [lightbox, setLightbox] = useState(false);
  const imgUrl = receipt.filename ? `/uploads/${receipt.filename}` : null;
  const lineTotal = receipt.lineItems.reduce((s, li) => s + (li.amount ?? 0) * li.quantity, 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Image */}
      {isImage(receipt.filename) && imgUrl && (
        <button
          onClick={() => setLightbox(true)}
          className="w-full h-48 bg-gray-800 overflow-hidden block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
        </button>
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-white">{receipt.vendor ?? "Receipt"}</p>
            {receipt.receiptDate && (
              <p className="text-xs text-gray-500 mt-0.5">
                📅 {formatDate(receipt.receiptDate)}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            {receipt.totalAmount != null && (
              <p className="text-amber-400 font-bold text-lg">${receipt.totalAmount.toFixed(2)}</p>
            )}
            <Link
              href={`/receipts/${receipt.id}`}
              className="text-xs text-gray-500 underline"
            >
              Edit →
            </Link>
          </div>
        </div>

        {/* Line items */}
        {receipt.lineItems.length > 0 && (
          <div className="space-y-1.5">
            {receipt.lineItems.map((li) => (
              <div key={li.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-amber-500/50 text-xs">🔩</span>
                    <span className="text-gray-200 truncate">{li.name}</span>
                    {li.quantity > 1 && <span className="text-gray-500 text-xs">×{li.quantity}</span>}
                  </div>
                  {li.amount != null && (
                    <span className="text-gray-400 flex-shrink-0 ml-2 text-xs">
                      ${(li.amount * li.quantity).toFixed(2)}
                    </span>
                  )}
                </div>
                {(li.warrantyProvider || li.warrantyEnd || li.warrantyStart) && (
                  <div className="ml-5 mt-0.5 text-xs text-sky-300">
                    🛡️ {li.warrantyProvider || "Warranty"}
                    {li.warrantyStart ? ` · ${new Date(li.warrantyStart).toLocaleDateString()}` : ""}
                    {li.warrantyEnd ? ` → ${new Date(li.warrantyEnd).toLocaleDateString()}` : ""}
                    {li.warrantyNotes ? ` · ${li.warrantyNotes}` : ""}
                  </div>
                )}
              </div>
            ))}
            {lineTotal > 0 && (
              <div className="flex justify-between text-xs pt-1.5 border-t border-gray-800">
                <span className="text-gray-500">Line items total</span>
                <span className="text-amber-400 font-semibold">${lineTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {receipt.notes && (
          <p className="text-xs text-gray-500 italic">{receipt.notes}</p>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && imgUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imgUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white text-3xl" onClick={() => setLightbox(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── Attachment upload (estimates, quotes, photos — NOT receipts) ──

const ATT_TYPES = [
  { value: "estimate", label: "📋 Estimate / Quote" },
  { value: "invoice",  label: "📄 Invoice" },
  { value: "photo",    label: "📷 Photo" },
  { value: "other",    label: "📎 Other" },
];

function AttachmentUpload({ serviceRecordId, onAdded, onCancel }: {
  serviceRecordId: string;
  onAdded: (a: { id: string; filename: string; type: string; vendor: string | null; amount: number | null; caption: string | null; createdAt: string }) => void;
  onCancel: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState("estimate");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.multiple = true;
    input.onchange = () => {
      if (!input.files) return;
      const added = Array.from(input.files);
      setFiles((prev) => {
        // iOS camera/gallery often reuses names like image.jpg; don't dedupe by name only.
        // Use a stronger fingerprint and still allow truly distinct files with same filename.
        const seen = new Set(prev.map((f) => `${f.name}|${f.size}|${f.lastModified}`));
        const unique = added.filter((f) => !seen.has(`${f.name}|${f.size}|${f.lastModified}`));
        return [...prev, ...unique];
      });
    };
    input.click();
  };

  const handleSave = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      let last: any = null;
      for (let i = 0; i < files.length; i++) {
        setProgress(files.length > 1 ? `Uploading ${i + 1}/${files.length}…` : "Uploading…");
        const { compressImage } = await import("@/app/lib/compressImage");
        const file = await compressImage(files[i]);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", type);
        fd.append("caption", label || type);
        const res = await fetch(`/api/service-records/${serviceRecordId}/attachments`, { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload failed");
        const { attachment } = await res.json();
        last = attachment;
        if (i < files.length - 1) onAdded(attachment); // intermediate
      }
      if (last) onAdded(last);
    } catch (e: any) {
      alert(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
      {uploading ? (
        <p className="text-sm text-amber-400 text-center animate-pulse">⏳ {progress}</p>
      ) : (
        <>
          {files.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800 border border-gray-700 active:bg-gray-700 transition">
                <span className="text-2xl">📷</span><span className="text-xs text-gray-400">Take Photo</span>
              </button>
              <button onClick={openPicker}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800 border border-gray-700 active:bg-gray-700 transition">
                <span className="text-2xl">🗂️</span><span className="text-xs text-gray-400">Choose Files</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2 text-xs">
                  <span>{/\.(jpg|jpeg|png|webp|heic|gif)/i.test(f.name) ? "🖼️" : "📄"}</span>
                  <span className="flex-1 truncate text-gray-300">{f.name}</span>
                  <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-gray-500 active:text-red-400">✕</button>
                </div>
              ))}
              <button onClick={openPicker} className="w-full text-xs text-amber-500 border border-dashed border-amber-700/40 rounded-xl py-2">
                + Add more
              </button>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white">
              {ATT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Label / Notes</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Maaco estimate, Joya quote…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600" />
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={files.length === 0}
              className="flex-1 py-2.5 bg-amber-500 text-black font-bold rounded-xl text-sm disabled:opacity-40 active:bg-amber-400 transition">
              Save{files.length > 1 ? ` ${files.length} files` : ""}
            </button>
            <button onClick={onCancel} className="px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-sm">Cancel</button>
          </div>
        </>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) setFiles((p) => [...p, e.target.files![0]]); }} />
    </div>
  );
}

function AttachmentGrid({ attachments, onDelete, onBulkUpdate, serviceRecordId }: {
  attachments: { id: string; filename: string; type: string; vendor: string | null; amount: number | null; caption: string | null; createdAt: string }[];
  onDelete: (id: string) => void;
  onBulkUpdate: (ids: string[], patch: Partial<{ caption: string | null; type: string }>) => void;
  serviceRecordId: string;
}) {
  const [lightbox, setLightbox] = useState<{ items: typeof attachments; idx: number } | null>(null);
  const [groupEditor, setGroupEditor] = useState<{ key: string; items: typeof attachments } | null>(null);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  // Group by caption
  const groups: { key: string; items: typeof attachments }[] = [];
  const seen = new Map<string, number>();
  for (const a of attachments) {
    const key = a.caption || a.type;
    if (seen.has(key)) groups[seen.get(key)!].items.push(a);
    else { seen.set(key, groups.length); groups.push({ key, items: [a] }); }
  }

  const handleDelete = async (a: typeof attachments[0]) => {
    if (!confirm("Remove this file?")) return;
    await fetch(`/api/service-records/${serviceRecordId}/attachments/${a.id}`, { method: "DELETE" });
    onDelete(a.id);
  };

  const openGroupEditor = (g: { key: string; items: typeof attachments }) => {
    setGroupEditor(g);
    setNewGroupLabel(g.key);
  };

  const handleRenameGroup = async () => {
    if (!groupEditor) return;
    setRenaming(true);
    try {
      const label = newGroupLabel.trim() || groupEditor.items[0]?.type || "other";
      for (const item of groupEditor.items) {
        const res = await fetch(`/api/service-records/${serviceRecordId}/attachments/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption: label }),
        });
        if (!res.ok) throw new Error("Rename failed");
      }
      onBulkUpdate(groupEditor.items.map((i) => i.id), { caption: label });
      setGroupEditor(null);
      setNewGroupLabel("");
    } catch (e: any) {
      alert(e.message ?? "Rename failed");
    } finally {
      setRenaming(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {groups.map((g) => {
          const primary = g.items[0];
          const img = isImage(primary.filename);
          const multi = g.items.length > 1;
          return (
            <div key={g.key} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <button onClick={() => setLightbox({ items: g.items, idx: 0 })}
                className="relative w-full aspect-video bg-gray-800 flex items-center justify-center overflow-hidden">
                {img
                  ? <img src={`/uploads/${primary.filename}`} alt="" className="w-full h-full object-cover" />
                  : <span className="text-4xl">📄</span>}
                {multi && (
                  <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full">
                    1/{g.items.length}
                  </span>
                )}
              </button>
              <div className="p-3 space-y-1.5">
                <p className="text-sm text-white font-semibold leading-snug line-clamp-2 break-words">{g.key}</p>
                <p className="text-xs text-gray-400 capitalize">{primary.type}{multi ? ` · ${g.items.length} pages` : ""}</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => openGroupEditor(g)}
                    className="text-xs bg-amber-500/15 text-amber-300 border border-amber-700/40 rounded-lg py-1.5 active:bg-amber-500/25"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => handleDelete(primary)}
                    className="text-xs bg-gray-800 text-gray-400 border border-gray-700 rounded-lg py-1.5 active:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setLightbox(null)}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-white text-sm">{lightbox.items[lightbox.idx].caption || "File"}
              {lightbox.items.length > 1 && <span className="text-gray-400 ml-2">{lightbox.idx + 1}/{lightbox.items.length}</span>}
            </span>
            <button className="text-white text-2xl px-2" onClick={() => setLightbox(null)}>✕</button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {isImage(lightbox.items[lightbox.idx].filename)
              ? <img src={`/uploads/${lightbox.items[lightbox.idx].filename}`} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
              : <div className="text-6xl">📄</div>}
          </div>
          {lightbox.items.length > 1 && (
            <div className="flex gap-3 px-4 pb-8" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setLightbox((l) => l && { ...l, idx: Math.max(0, l.idx - 1) })}
                disabled={lightbox.idx === 0} className="flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm disabled:opacity-30">← Prev</button>
              <button onClick={() => setLightbox((l) => l && { ...l, idx: Math.min(l.items.length - 1, l.idx + 1) })}
                disabled={lightbox.idx === lightbox.items.length - 1} className="flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm disabled:opacity-30">Next →</button>
            </div>
          )}
        </div>
      )}

      {groupEditor && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center" onClick={() => setGroupEditor(null)}>
          <div className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-t-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Manage group</h3>
              <button className="text-gray-400 text-xl" onClick={() => setGroupEditor(null)}>✕</button>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Group label</label>
              <input
                value={newGroupLabel}
                onChange={(e) => setNewGroupLabel(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white"
                placeholder="Estimate - 2026-03-23"
              />
            </div>
            <p className="text-xs text-gray-500">{groupEditor.items.length} file{groupEditor.items.length === 1 ? "" : "s"} in this group.</p>
            <div className="max-h-40 overflow-auto space-y-1">
              {groupEditor.items.map((item) => (
                <div key={item.id} className="text-xs text-gray-300 bg-gray-800 rounded-lg px-2 py-1 truncate">{item.filename}</div>
              ))}
            </div>
            <button
              onClick={handleRenameGroup}
              disabled={renaming}
              className="w-full py-2.5 bg-amber-500 text-black font-bold rounded-xl text-sm disabled:opacity-40"
            >
              {renaming ? "Saving…" : "Save group label"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Legacy (kept for reference, not used) ──

function FileGroupCard({ group }: { group: { key: string; label: string; fileType: string; items: Receipt[] } }) {
  const [page, setPage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const current = group.items[page];
  const imgUrl = current.filename ? `/uploads/${current.filename}` : null;
  const multi = group.items.length > 1;

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
        <button
          onClick={() => setLightbox(true)}
          className="relative w-full aspect-video bg-gray-800 flex items-center justify-center overflow-hidden"
        >
          {isImage(current.filename) && imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-4xl">📄</span>
          )}
          {multi && (
            <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-full">
              {page + 1}/{group.items.length}
            </span>
          )}
        </button>
        <div className="p-3 flex-1">
          <p className="text-xs text-white font-medium truncate">{group.label}</p>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">
            {group.fileType}{multi ? ` · ${group.items.length} pages` : ""}
          </p>
        </div>
        {multi && (
          <div className="flex border-t border-gray-800">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="flex-1 text-xs text-gray-500 py-2 disabled:opacity-30 active:bg-gray-800">← Prev</button>
            <button onClick={() => setPage((p) => Math.min(group.items.length - 1, p + 1))} disabled={page === group.items.length - 1}
              className="flex-1 text-xs text-gray-500 py-2 border-l border-gray-800 disabled:opacity-30 active:bg-gray-800">Next →</button>
          </div>
        )}
      </div>

      {lightbox && imgUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setLightbox(false)}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2" onClick={(e) => e.stopPropagation()}>
            <span className="text-white text-sm font-medium">
              {group.label}{multi && <span className="text-gray-400 ml-2">{page + 1}/{group.items.length}</span>}
            </span>
            <button className="text-white text-2xl px-2" onClick={() => setLightbox(false)}>✕</button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          </div>
          {multi && (
            <div className="flex gap-3 px-4 pb-8" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm disabled:opacity-30">← Prev</button>
              <button onClick={() => setPage((p) => Math.min(group.items.length - 1, p + 1))} disabled={page === group.items.length - 1}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm disabled:opacity-30">Next →</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

const FILE_TYPES = [
  { value: "estimate", label: "📋 Estimate / Quote" },
  { value: "invoice",  label: "📄 Invoice" },
  { value: "photo",    label: "📷 Photo" },
  { value: "other",    label: "📎 Other" },
];

function AddFileSection({ serviceRecordId, onAdded }: {
  serviceRecordId: string;
  onAdded: (receipt: Receipt) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileType, setFileType] = useState("estimate");
  const [label, setLabel] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    setSelectedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...Array.from(fl).filter((f) => !names.has(f.name))];
    });
  };

  // Always create a fresh input so iOS re-triggers the picker reliably
  const openFilePicker = (multiple = true) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.multiple = multiple;
    input.onchange = () => addFiles(input.files);
    input.click();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const raw = selectedFiles[i];
        setStatus(`Uploading ${selectedFiles.length > 1 ? `${i + 1}/${selectedFiles.length} — ` : ""}${raw.name}…`);
        const file = await compressImage(raw);
        const fd = new FormData();
        fd.append("file", file);
        // Link directly to service record on creation — no AI
        fd.append("serviceRecordId", serviceRecordId);
        fd.append("notes", label || fileType);
        const res = await fetch("/api/receipts", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
        const { receipt: final } = await res.json();
        onAdded({
          id: final.id,
          filename: final.filename ?? null,
          vendor: label || null,
          totalAmount: null,
          receiptDate: null,
          notes: label || fileType,
          status: final.status,
          lineItems: [],
          fileType,
        });
      }
      setSelectedFiles([]);
      setLabel("");
    } catch (e: any) {
      alert(e.message ?? "Upload failed.");
    } finally {
      setStatus(null);
    }
  };

  if (status) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-amber-400">
        <span className="animate-pulse">⏳</span> {status}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
      {selectedFiles.length === 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => cameraRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800 border border-gray-700 active:bg-gray-700 transition">
            <span className="text-2xl">📷</span>
            <span className="text-xs text-gray-400">Take Photo</span>
          </button>
          <button onClick={() => openFilePicker(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800 border border-gray-700 active:bg-gray-700 transition">
            <span className="text-2xl">🗂️</span>
            <span className="text-xs text-gray-400">Choose Files</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {selectedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-gray-800 rounded-xl px-3 py-2">
              <span>{/\.(jpg|jpeg|png|webp|gif|heic)/i.test(f.name) ? "🖼️" : "📄"}</span>
              <span className="flex-1 truncate text-gray-300">{f.name}</span>
              <button onClick={() => setSelectedFiles((p) => p.filter((_, j) => j !== i))}
                className="text-gray-500 active:text-red-400">✕</button>
            </div>
          ))}
          <button onClick={() => openFilePicker(true)}
            className="w-full text-xs text-amber-500 border border-dashed border-amber-700/40 rounded-xl py-2">
            + Add more
          </button>
        </div>
      )}

      <div>
        <label className="text-xs text-gray-500 block mb-1">Type</label>
        <select value={fileType} onChange={(e) => setFileType(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white">
          {FILE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Label (optional)</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Maaco quote, Joya estimate…"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600" />
      </div>

      <button onClick={handleUpload} disabled={selectedFiles.length === 0}
        className="w-full py-2.5 bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-40 active:bg-gray-600 transition">
        Save{selectedFiles.length > 1 ? ` ${selectedFiles.length} files` : ""}
      </button>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => addFiles(e.target.files)} />
    </div>
  );
}

function AddReceiptButton({ serviceRecordId, onAdded }: {
  serviceRecordId: string;
  onAdded: (receipt: Receipt) => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (rawFile: File): Promise<Receipt> => {
    const file = await compressImage(rawFile);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("serviceRecordId", serviceRecordId);
    const res = await fetch("/api/receipts", { method: "POST", body: fd });
    if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
    const { receipt: created } = await res.json();
    const receiptId = created.id;

    const processRes = await fetch(`/api/receipts/${receiptId}/process`, { method: "POST" });
    const processData = await processRes.json();
    if (!processRes.ok) throw new Error(processData.error || "Receipt processing failed");

    const applyRes = await fetch(`/api/receipts/${receiptId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceRecordId,
        serviceDate: null,
        extracted: processData.extracted ?? {},
      }),
    });
    const applyData = await applyRes.json();
    if (!applyRes.ok) throw new Error(applyData.error || "Could not link receipt");

    const r2 = await fetch(`/api/receipts/${receiptId}`);
    if (!r2.ok) throw new Error("Could not load receipt");
    const { receipt: final } = await r2.json();
    return {
      id: final.id,
      filename: final.filename ?? null,
      vendor: final.vendor ?? null,
      totalAmount: final.totalAmount ?? null,
      receiptDate: final.receiptDate ?? null,
      notes: final.notes ?? null,
      status: final.status,
      lineItems: (final.lineItems ?? []).map((li: any) => ({
        id: li.id, name: li.name, quantity: li.quantity,
        amount: li.amount ?? null, notes: li.notes ?? null,
      })),
    };
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    try {
      for (let i = 0; i < arr.length; i++) {
        setStatus(`Reading ${arr.length > 1 ? `${i + 1}/${arr.length} — ` : ""}${arr[i].name}…`);
        onAdded(await processFile(arr[i]));
      }
    } catch (e: any) {
      alert(e.message ?? "Upload failed.");
    } finally {
      setStatus(null);
    }
  };

  if (status) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-amber-400">
        <span className="animate-pulse">🤖</span> {status}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={() => cameraRef.current?.click()}
        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-900 border border-amber-700/40 active:bg-gray-800 transition">
        <span className="text-2xl">📷</span>
        <span className="text-xs text-amber-400">Scan Receipt</span>
      </button>
      <button onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gray-900 border border-amber-700/40 active:bg-gray-800 transition">
        <span className="text-2xl">🗂️</span>
        <span className="text-xs text-amber-400">Scan from File</span>
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handleFiles(e.target.files)} />
      <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden"
        onChange={(e) => handleFiles(e.target.files)} />
    </div>
  );
}

interface Attachment {
  id: string;
  filename: string;
  type: string;
  vendor: string | null;
  amount: number | null;
  caption: string | null;
  createdAt: string;
}

// ── Manual Receipt Form ──────────────────────────────────────────────────────

function ManualReceiptForm({ serviceRecordId, onAdded, lang }: {
  serviceRecordId: string;
  onAdded: (receipt: Receipt) => void;
  lang: string;
}) {
  const es = lang === "es";
  const [vendor, setVendor] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([{ name: "", amount: "", qty: "1", notes: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLine = () => setLines(prev => [...prev, { name: "", amount: "", qty: "1", notes: "" }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, val: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0) * (parseInt(l.qty) || 1), 0);

  const save = async () => {
    const validLines = lines.filter(l => l.name.trim());
    if (validLines.length === 0) { setError(es ? "Agrega al menos un artículo" : "Add at least one item"); return; }
    setSaving(true);
    setError(null);
    try {
      // Create a receipt with no file
      const res = await fetch(`/api/service-records/${serviceRecordId}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: vendor || null,
          receiptDate,
          totalAmount: total > 0 ? total : null,
          status: "manual",
          lineItems: validLines.map(l => ({
            name: l.name.trim(),
            amount: parseFloat(l.amount) || null,
            quantity: parseInt(l.qty) || 1,
            notes: l.notes.trim() || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onAdded(data.receipt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white w-full placeholder-gray-600";

  return (
    <div className="bg-gray-900 border border-amber-600/40 rounded-2xl p-4 space-y-4">
      <p className="text-xs font-semibold text-amber-400">{es ? "Entrada manual — sin recibo" : "Manual entry — no receipt required"}</p>

      {/* Vendor + date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">{es ? "Tienda / Taller" : "Vendor / Store"}</label>
          <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder={es ? "ej. AutoZone" : "e.g. AutoZone"} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">{es ? "Fecha" : "Date"}</label>
          <input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-1 text-[10px] text-gray-600 px-1">
          <span className="col-span-5">{es ? "Artículo" : "Item"}</span>
          <span className="col-span-2 text-center">{es ? "Cant." : "Qty"}</span>
          <span className="col-span-3">{es ? "Precio" : "Price"}</span>
          <span className="col-span-2"></span>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-1 items-center">
            <input value={l.name} onChange={e => updateLine(i, "name", e.target.value)}
              placeholder={es ? "ej. Filtro de aceite" : "e.g. Oil filter"} className={`col-span-5 ${inputCls}`} />
            <input type="number" value={l.qty} onChange={e => updateLine(i, "qty", e.target.value)}
              min="1" className={`col-span-2 ${inputCls} text-center`} />
            <input type="number" value={l.amount} onChange={e => updateLine(i, "amount", e.target.value)}
              placeholder="0.00" step="0.01" className={`col-span-3 ${inputCls}`} />
            <button onClick={() => removeLine(i)} disabled={lines.length === 1}
              className="col-span-2 text-gray-600 hover:text-red-400 text-lg disabled:opacity-20 text-center">✕</button>
          </div>
        ))}
        <button onClick={addLine} className="text-xs text-amber-500 hover:text-amber-400 pt-1">
          + {es ? "Agregar artículo" : "Add item"}
        </button>
      </div>

      {/* Total */}
      {total > 0 && (
        <div className="flex justify-between text-sm border-t border-gray-800 pt-2">
          <span className="text-gray-500">{es ? "Total" : "Total"}</span>
          <span className="text-white font-semibold">${total.toFixed(2)}</span>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button onClick={save} disabled={saving}
        className="w-full bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
        {saving ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar" : "Save")}
      </button>
    </div>
  );
}

export default function ServiceRecordDetailClient({
  carId,
  carName,
  record: initialRecord,
  initialAttachments,
}: {
  carId: string;
  carName: string;
  record: ServiceRecord;
  initialAttachments: Attachment[];
}) {
  const { lang } = useApp();
  const t = useT();
  const txt = {
    warranty: lang === "es" ? "Garantía" : "Warranty",
    addEditWarranty: lang === "es" ? "Agregar/Editar garantía" : "Add/Edit warranty",
    selectPart: lang === "es" ? "Seleccionar pieza existente" : "Select existing part",
    orTypePart: lang === "es" ? "o escribir nueva pieza" : "or type a new part",
    provider: lang === "es" ? "Proveedor de garantía" : "Warranty provider",
    start: lang === "es" ? "Inicio" : "Start",
    end: lang === "es" ? "Fin" : "End",
    notes: lang === "es" ? "Notas" : "Notes",
    save: lang === "es" ? "Guardar" : "Save",
    cancel: lang === "es" ? "Cancelar" : "Cancel",
    history: lang === "es" ? "Historial" : "History",
  };

  const [record, setRecord] = useState(initialRecord);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [showAddReceipt, setShowAddReceipt] = useState(false);
  const [showManualReceipt, setShowManualReceipt] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [editingRecord, setEditingRecord] = useState(false);
  const [editTitle, setEditTitle] = useState(initialRecord.title);
  const [editDate, setEditDate] = useState(initialRecord.serviceDate.slice(0, 10));
  const [editMileage, setEditMileage] = useState(initialRecord.mileage ? String(initialRecord.mileage) : "");
  const [editNotes, setEditNotes] = useState(initialRecord.notes ?? "");
  const [showWarranty, setShowWarranty] = useState(false);
  const [savingWarranty, setSavingWarranty] = useState(false);
  const [selectedLineItemId, setSelectedLineItemId] = useState("");
  const [newPartName, setNewPartName] = useState("");
  const [warrantyProvider, setWarrantyProvider] = useState("");
  const [warrantyStart, setWarrantyStart] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [warrantyNotes, setWarrantyNotes] = useState("");

  const allLineItems = record.receipts.flatMap((r) =>
    r.lineItems.map((li) => ({ ...li, vendor: r.vendor }))
  );
  const receiptTotal = record.receipts.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const displayCost = receiptTotal > 0 ? receiptTotal : record.cost;

  const handleReceiptAdded = (receipt: Receipt) => {
    setRecord((prev) => ({ ...prev, receipts: [...prev.receipts, receipt] }));
    setShowAddReceipt(false);
  };

  const handleReceiptMoved = (id: string) => {
    setRecord((prev) => ({ ...prev, receipts: prev.receipts.filter((r) => r.id !== id) }));
  };

  const saveRecordEdit = async () => {
    const res = await fetch(`/api/service-records/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        serviceDate: editDate,
        mileage: editMileage ? parseInt(editMileage, 10) : null,
        notes: editNotes || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to update record");
      return;
    }
    setRecord((prev) => ({
      ...prev,
      title: data.record.title,
      serviceDate: data.record.serviceDate,
      mileage: data.record.mileage,
      notes: data.record.notes,
    }));
    setEditingRecord(false);
  };

  const saveWarranty = async () => {
    try {
      setSavingWarranty(true);
      let targetId = selectedLineItemId;

      if (!targetId && newPartName.trim()) {
        const firstReceipt = record.receipts.find((r) => !r.fileType);
        if (!firstReceipt) throw new Error(lang === "es" ? "Primero agrega un recibo." : "Add a receipt first.");
        const created = await fetch(`/api/receipts/${firstReceipt.id}/line-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newPartName.trim(), quantity: 1 }),
        });
        const createdJson = await created.json();
        if (!created.ok) throw new Error(createdJson.error || "Failed creating part");
        targetId = createdJson.lineItem.id;
      }

      if (!targetId) throw new Error(lang === "es" ? "Selecciona o crea una pieza." : "Select or create a part.");

      const ownerReceipt = record.receipts.find((r) => r.lineItems.some((li) => li.id === targetId));
      if (!ownerReceipt) throw new Error("Receipt not found for line item");

      const res = await fetch(`/api/receipts/${ownerReceipt.id}/line-items/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warrantyProvider: warrantyProvider || null,
          warrantyStart: warrantyStart || null,
          warrantyEnd: warrantyEnd || null,
          warrantyNotes: warrantyNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setRecord((prev) => ({
        ...prev,
        receipts: prev.receipts.map((r) => ({
          ...r,
          lineItems: r.lineItems.map((li) => (li.id === targetId ? { ...li, ...data.lineItem } : li)),
        })),
      }));

      setShowWarranty(false);
      setSelectedLineItemId("");
      setNewPartName("");
      setWarrantyProvider("");
      setWarrantyStart("");
      setWarrantyEnd("");
      setWarrantyNotes("");
    } catch (e: any) {
      alert(e.message ?? "Failed to save warranty");
    } finally {
      setSavingWarranty(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 pb-28">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/cars/${carId}/service-history`} className="text-gray-500 text-xl leading-none">←</Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-white text-sm leading-snug truncate">{record.title}</h1>
            <p className="text-xs text-gray-400">{carName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingRecord((v) => !v)}
              className="text-xs text-amber-400 border border-amber-700/40 rounded-lg px-2 py-1"
            >
              {editingRecord ? (lang === "es" ? "Cerrar" : "Close") : (lang === "es" ? "Editar" : "Edit")}
            </button>
            <Link
              href={`/cars/${carId}/service-history`}
              className="text-xs text-gray-500 flex-shrink-0"
              title="Back to service history"
            >
              {txt.history}
            </Link>
          </div>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-6 max-w-2xl mx-auto">

        {editingRecord && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" placeholder={lang === "es" ? "Título" : "Title"} />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
              <input type="number" value={editMileage} onChange={(e) => setEditMileage(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" placeholder={lang === "es" ? "Millaje" : "Mileage"} />
            </div>
            <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" placeholder={lang === "es" ? "Notas" : "Notes"} />
            <div className="flex gap-2">
              <button onClick={saveRecordEdit} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm">{lang === "es" ? "Guardar" : "Save"}</button>
              <button onClick={() => setEditingRecord(false)} className="px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm">{lang === "es" ? "Cancelar" : "Cancel"}</button>
            </div>
          </div>
        )}

        {/* Summary card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
          {record.serviceType && record.serviceType !== record.title && (
            <span className="inline-block text-xs bg-gray-800 text-amber-400 border border-amber-700/30 px-2 py-0.5 rounded-full">
              {record.serviceType}
            </span>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-white font-medium">{formatDate(record.serviceDate)}</p>
            </div>
            {record.mileage != null && (
              <div>
                <p className="text-xs text-gray-500">Mileage</p>
                <p className="text-white font-medium">{record.mileage.toLocaleString()} mi</p>
              </div>
            )}
            {displayCost != null && displayCost > 0 && (
              <div>
                <p className="text-xs text-gray-500">Cost</p>
                <p className={`font-bold text-lg ${receiptTotal > 0 ? "text-amber-400" : "text-white"}`}>
                  ${displayCost.toFixed(2)}
                </p>
              </div>
            )}
            {record.duration && (
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-white">{record.duration}</p>
              </div>
            )}
          </div>

          {record.nextServiceDue && (
            <div className="text-xs text-sky-400 bg-sky-900/20 border border-sky-700/30 rounded-xl px-3 py-2">
              🔔 Next service due: {record.nextServiceDue}
            </div>
          )}
        </div>

        {/* Notes */}
        {(record.notes || record.details) && (
          <div className="space-y-2">
            <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Notes</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
              {record.notes && <p className="text-sm text-gray-300 whitespace-pre-wrap">{record.notes}</p>}
              {record.details && record.details !== record.notes && (
                <p className="text-sm text-gray-400 whitespace-pre-wrap">{record.details}</p>
              )}
            </div>
          </div>
        )}

        {/* Parts used (imported text) */}
        {record.partsUsed && (
          <div className="space-y-2">
            <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">🔩 Parts Used</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{record.partsUsed}</p>
              {record.partsSource && (
                <p className="text-xs text-gray-500 mt-2">🛒 From: {record.partsSource}</p>
              )}
            </div>
          </div>
        )}

        {/* Warranty manager */}
        <div id="warranty" className="space-y-3 scroll-mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">🛡️ {txt.warranty}</h2>
            <button
              onClick={() => { setShowWarranty((x) => !x); setShowAddReceipt(false); setShowAddFile(false); }}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold active:opacity-80 transition ${showWarranty ? "bg-gray-700 text-white" : "bg-sky-700/40 text-sky-200"}`}
            >
              {txt.addEditWarranty}
            </button>
          </div>

          {showWarranty && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <label className="text-xs text-gray-500">{txt.selectPart}</label>
              <select
                value={selectedLineItemId}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedLineItemId(v);
                  const found = allLineItems.find((li) => li.id === v);
                  setWarrantyProvider(found?.warrantyProvider ?? "");
                  setWarrantyStart(found?.warrantyStart ? new Date(found.warrantyStart).toISOString().slice(0, 10) : "");
                  setWarrantyEnd(found?.warrantyEnd ? new Date(found.warrantyEnd).toISOString().slice(0, 10) : "");
                  setWarrantyNotes(found?.warrantyNotes ?? "");
                }}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                <option value="">—</option>
                {allLineItems.map((li) => (
                  <option key={li.id} value={li.id}>{li.name}{li.vendor ? ` · ${li.vendor}` : ""}</option>
                ))}
              </select>

              <label className="text-xs text-gray-500">{txt.orTypePart}</label>
              <input
                value={newPartName}
                onChange={(e) => { setNewPartName(e.target.value); if (e.target.value) setSelectedLineItemId(""); }}
                placeholder={lang === "es" ? "Ej: Filtro de aire" : "e.g. Air filter"}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white"
              />

              <input value={warrantyProvider} onChange={(e) => setWarrantyProvider(e.target.value)} placeholder={txt.provider}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={warrantyStart} onChange={(e) => setWarrantyStart(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
                <input type="date" value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
              <input value={warrantyNotes} onChange={(e) => setWarrantyNotes(e.target.value)} placeholder={txt.notes}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
              <div className="flex gap-2">
                <button onClick={saveWarranty} disabled={savingWarranty}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm disabled:opacity-40">
                  {savingWarranty ? "…" : txt.save}
                </button>
                <button onClick={() => setShowWarranty(false)} className="px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm">{txt.cancel}</button>
              </div>
            </div>
          )}
        </div>

        {/* Scanned Receipts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">🧾 {lang === "es" ? "Recibos" : "Receipts"}</h2>
            <div className="flex gap-1.5">
              <button
                onClick={() => { setShowManualReceipt(x => !x); setShowAddReceipt(false); setShowAddFile(false); }}
                className={`text-xs px-2.5 py-1.5 rounded-xl font-semibold active:opacity-80 transition ${showManualReceipt ? "bg-gray-700 text-white" : "bg-gray-800 text-gray-300 border border-gray-700"}`}
              >
                {showManualReceipt ? "✕" : `+ ${lang === "es" ? "Manual" : "Manual"}`}
              </button>
              <button
                onClick={() => { setShowAddReceipt((x) => !x); setShowManualReceipt(false); setShowAddFile(false); }}
                className={`text-xs px-2.5 py-1.5 rounded-xl font-semibold active:opacity-80 transition ${showAddReceipt ? "bg-gray-700 text-white" : "bg-amber-500 text-black"}`}
              >
                {showAddReceipt ? "✕" : "🤖 Scan"}
              </button>
            </div>
          </div>

          {showManualReceipt && (
            <ManualReceiptForm
              serviceRecordId={record.id}
              onAdded={(r) => { handleReceiptAdded(r); setShowManualReceipt(false); }}
              lang={lang}
            />
          )}

          {showAddReceipt && (
            <AddReceiptButton serviceRecordId={record.id} onAdded={handleReceiptAdded} />
          )}

          {(() => {
            const scanned = record.receipts.filter((r) => !r.fileType);
            return scanned.length === 0 && !showAddReceipt && !showManualReceipt ? (
              <p className="text-sm text-gray-600 text-center py-3">{lang === "es" ? "Sin recibos aún." : "No receipts yet."}</p>
            ) : (
              <div className="space-y-4">
                {scanned.map((r) => <ReceiptSection key={r.id} receipt={r} onMoved={handleReceiptMoved} />)}
              </div>
            );
          })()}
        </div>

        {/* Files & Estimates — proper attachments, NOT receipts */}
        <div className="space-y-3 pb-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              📎 Files & Estimates
              {attachments.length > 0 && (
                <span className="ml-2 bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full text-xs font-normal">{attachments.length}</span>
              )}
            </h2>
            <button
              onClick={() => { setShowAddFile((x) => !x); setShowAddReceipt(false); }}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold active:opacity-80 transition ${showAddFile ? "bg-gray-700 text-white" : "bg-gray-800 text-gray-300"}`}
            >
              {showAddFile ? "✕ Cancel" : "+ Add"}
            </button>
          </div>

          {showAddFile && (
            <AttachmentUpload
              serviceRecordId={record.id}
              onAdded={(a) => { setAttachments((prev) => [...prev, a]); setShowAddFile(false); }}
              onCancel={() => setShowAddFile(false)}
            />
          )}

          {attachments.length === 0 && !showAddFile ? (
            <p className="text-sm text-gray-600 text-center py-3">No files yet — add estimates, quotes, photos.</p>
          ) : (
            <AttachmentGrid
              attachments={attachments}
              onDelete={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
              onBulkUpdate={(ids, patch) => setAttachments((prev) => prev.map((a) => ids.includes(a.id) ? { ...a, ...patch } : a))}
              serviceRecordId={record.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
