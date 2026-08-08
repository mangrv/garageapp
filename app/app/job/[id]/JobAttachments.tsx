"use client";
import { useT } from "@/app/hooks/useT";
import { useState, useRef, useEffect, useCallback } from "react";
import { compressImage } from "@/app/lib/compressImage";

type Attachment = {
  id: string;
  filename: string;
  type: string;
  vendor: string | null;
  amount: number | null;
  caption: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  receipt:  { label: "Receipt",  icon: "🧾" },
  estimate: { label: "Estimate", icon: "📋" },
  invoice:  { label: "Invoice",  icon: "📄" },
  photo:    { label: "Photo",    icon: "📷" },
  other:    { label: "Other",    icon: "📎" },
};

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "heic"];
function isImage(filename: string) {
  return IMAGE_EXTS.includes(filename.split(".").pop()?.toLowerCase() ?? "");
}

// ── Shared photo lightbox ────────────────────────────────────────────────────
function PhotoLightbox({
  attachments,
  index,
  onClose,
  onNavigate,
  onDelete,
}: {
  attachments: Attachment[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
  onDelete: (id: string) => void;
}) {
  const touchStartX = useRef<number | null>(null);
  const a = attachments[index];
  const url = `/uploads/${a.filename}`;

  const goPrev = useCallback(() => onNavigate((index - 1 + attachments.length) % attachments.length), [index, attachments.length, onNavigate]);
  const goNext = useCallback(() => onNavigate((index + 1) % attachments.length), [index, attachments.length, onNavigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  const handleDelete = async () => {
    if (!confirm("Delete this photo?")) return;
    const parts = a.filename.split("/");
    const jobId = parts[1];
    await fetch(`/api/jobs/${jobId}/attachments/${a.id}`, { method: "DELETE" });
    onDelete(a.id);
    if (attachments.length > 1) onNavigate(Math.min(index, attachments.length - 2));
    else onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) dx < 0 ? goNext() : goPrev();
        touchStartX.current = null;
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
        <span className="text-sm text-gray-400">{index + 1} / {attachments.length}</span>
        {a.caption && <span className="text-sm text-gray-300 truncate max-w-[50%]">{a.caption}</span>}
        <button onClick={onClose} className="text-2xl text-gray-300 w-10 h-10 flex items-center justify-center">✕</button>
      </div>

      {/* Image + arrows */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
        {attachments.length > 1 && (
          <button onClick={goPrev} className="absolute left-2 z-10 text-white text-3xl bg-black/50 rounded-full w-11 h-11 flex items-center justify-center active:bg-black/80">‹</button>
        )}
        <img
          src={url}
          alt={a.caption ?? ""}
          className="max-h-full max-w-full object-contain select-none"
          draggable={false}
        />
        {attachments.length > 1 && (
          <button onClick={goNext} className="absolute right-2 z-10 text-white text-3xl bg-black/50 rounded-full w-11 h-11 flex items-center justify-center active:bg-black/80">›</button>
        )}
      </div>

      {/* Dot indicators */}
      {attachments.length > 1 && attachments.length <= 20 && (
        <div className="flex justify-center gap-1.5 py-2 bg-black/60 flex-shrink-0">
          {attachments.map((_, i) => (
            <button key={i} onClick={() => onNavigate(i)}
              className={`rounded-full transition-all ${i === index ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-gray-600"}`} />
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="bg-black/80 px-4 py-2 flex-shrink-0">
        {a.vendor && <p className="text-xs text-gray-400">🏪 {a.vendor}</p>}
        {a.amount != null && <p className="text-sm font-bold text-emerald-400">${a.amount.toFixed(2)}</p>}
        <p className="text-xs text-gray-600 mt-0.5">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
      </div>

      {/* Actions */}
      <div className="flex justify-around px-4 py-3 bg-black/90 border-t border-gray-800 flex-shrink-0">
        <a href={url} download className="flex flex-col items-center gap-1 text-xs text-gray-300">
          <span className="text-xl">⬇️</span>Save
        </a>
        <button onClick={handleDelete} className="flex flex-col items-center gap-1 text-xs text-red-400">
          <span className="text-xl">🗑</span>Delete
        </button>
      </div>
    </div>
  );
}

// ── AttachmentCard ────────────────────────────────────────────────────────────
function AttachmentCard({
  a,
  photoIndex,
  onDelete,
  onOpenLightbox,
}: {
  a: Attachment;
  photoIndex: number | null;
  onDelete: () => void;
  onOpenLightbox: ((i: number) => void) | null;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const meta = TYPE_LABELS[a.type] ?? TYPE_LABELS.other;
  const url = `/uploads/${a.filename}`;
  const displayName = a.filename.split("/").pop() ?? a.filename;

  const handleDelete = async () => {
    setDeleting(true);
    const parts = a.filename.split("/");
    const jobId = parts[1];
    await fetch(`/api/jobs/${jobId}/attachments/${a.id}`, { method: "DELETE" });
    onDelete();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {isImage(a.filename) && (
        <div
          className="w-full h-36 bg-gray-800 overflow-hidden cursor-pointer active:opacity-80"
          onClick={() => onOpenLightbox && photoIndex !== null && onOpenLightbox(photoIndex)}
        >
          <img src={url} alt={a.caption ?? displayName} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
            {meta.icon} {meta.label}
          </span>
          {a.amount != null && (
            <span className="text-sm font-bold text-emerald-400">
              ${a.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        {a.vendor && <div className="text-xs text-gray-400">🏪 {a.vendor}</div>}
        {a.caption && <div className="text-xs text-gray-500">{a.caption}</div>}
        {!isImage(a.filename) && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline block truncate">
            {meta.icon} {displayName}
          </a>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-600">
            {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-gray-600 active:text-red-400 px-1">🗑</button>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-500">Remove?</span>
              <button onClick={handleDelete} disabled={deleting} className="text-xs text-red-400 font-semibold disabled:opacity-40">{deleting ? "…" : "Yes"}</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500">No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── JobAttachments ────────────────────────────────────────────────────────────
export default function JobAttachments({ jobId, initialAttachments }: {
  jobId: string;
  initialAttachments: Attachment[];
}) {
  const t = useT();
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState("estimate");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Only photo attachments go in the lightbox
  const photoAttachments = attachments.filter((a) => isImage(a.filename));

  const pickFile = (f: File | null) => { setSelectedFile(f); setShowForm(true); };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    // Compress images before upload (phone photos can be 10-25 MB)
    const fileToUpload = /\.(jpg|jpeg|png|webp|heic)/i.test(selectedFile.name)
      ? await compressImage(selectedFile)
      : selectedFile;
    const fd = new FormData();
    fd.append("file", fileToUpload);
    fd.append("type", type);
    fd.append("vendor", vendor);
    fd.append("amount", amount);
    fd.append("caption", caption);
    const res = await fetch(`/api/jobs/${jobId}/attachments`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.attachment) {
      setAttachments((prev) => [data.attachment, ...prev]);
      setShowForm(false);
      setSelectedFile(null);
      setType("estimate");
      setVendor("");
      setAmount("");
      setCaption("");
    }
    setUploading(false);
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600";
  const totalCost = attachments.reduce((s, a) => s + (a.amount ?? 0), 0);

  return (
    <section>
      {/* Lightbox */}
      {lightboxIndex !== null && photoAttachments.length > 0 && (
        <PhotoLightbox
          attachments={photoAttachments}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDelete={(id) => setAttachments((prev) => prev.filter((x) => x.id !== id))}
        />
      )}

      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-bold text-base">📎 Estimates & Files</h2>
          {totalCost > 0 && <p className="text-xs text-amber-400 mt-0.5">Total: ${totalCost.toFixed(2)}</p>}
        </div>
        {!showForm && (
          <div className="flex gap-2">
            <button onClick={() => cameraRef.current?.click()} className="text-xs px-3 py-1.5 rounded-xl bg-gray-800 text-gray-300 active:bg-gray-700">📷</button>
            <button onClick={() => fileRef.current?.click()} className="text-xs px-3 py-1.5 rounded-xl bg-amber-500 text-black font-semibold active:bg-amber-400">+ Add</button>
          </div>
        )}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
        <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-amber-600 rounded-2xl p-4 space-y-3 mb-4">
          {selectedFile && (
            <div className="flex items-center gap-3 p-2.5 bg-gray-800 rounded-xl">
              <span className="text-xl">{/\.(jpg|jpeg|png|webp|gif|heic)/i.test(selectedFile.name) ? "🖼️" : "📄"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => { setSelectedFile(null); setShowForm(false); }} className="text-gray-500 text-lg">✕</button>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              <option value="estimate">📋 Estimate / Quote</option>
              <option value="receipt">🧾 Receipt</option>
              <option value="invoice">📄 Invoice</option>
              <option value="photo">📷 Photo</option>
              <option value="other">📎 Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Shop / Vendor</label>
              <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Maaco" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount ($)</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. includes clear coat, 2-stage" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleUpload} disabled={!selectedFile || uploading} className="flex-1 bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-40">
              {uploading ? t("uploading") : "Save"}
            </button>
            <button onClick={() => { setShowForm(false); setSelectedFile(null); }} className="px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">No estimates yet — snap a quote or upload a file.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {attachments.map((a) => {
            const photoIndex = isImage(a.filename) ? photoAttachments.findIndex((p) => p.id === a.id) : null;
            return (
              <AttachmentCard
                key={a.id}
                a={a}
                photoIndex={photoIndex}
                onDelete={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                onOpenLightbox={photoIndex !== null ? setLightboxIndex : null}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
