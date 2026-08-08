"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Camera, X, Globe, Lock, Star, Plus, Trash2, Eye,
  ArrowUpDown, Check, ChevronLeft, ChevronRight,
} from "lucide-react";
import { compressImage } from "@/app/lib/compressImage";
import { trackMatomoEvent } from "@/app/lib/matomo";

type JobPhoto = {
  id: string;
  filename: string;
  mediaType?: "image" | "video";
  processingStatus?: "processing" | "ready";
  caption: string | null;
  isPublic: boolean;
  isPrimary: boolean;
  sortOrder: number;
  createdAt: string;
};

// ── Smooth swipe hook (shared) ────────────────────────────────────────────────
function useSwipe(count: number, initial = 0) {
  const [idx, setIdx] = useState(initial);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const ref = useRef<HTMLDivElement>(null);
  const goTo = useCallback((i: number) => setIdx(Math.max(0, Math.min(count - 1, i))), [count]);
  const onTouchStart = useCallback((e: React.TouchEvent) => { startX.current = e.touches[0].clientX; setDragging(true); }, []);
  const onTouchMove  = useCallback((e: React.TouchEvent) => { if (dragging) setDragX(e.touches[0].clientX - startX.current); }, [dragging]);
  const onTouchEnd   = useCallback(() => {
    setDragging(false);
    const w = ref.current?.offsetWidth ?? 300;
    if (dragX < -(w * 0.25)) goTo(idx + 1);
    else if (dragX > w * 0.25) goTo(idx - 1);
    setDragX(0);
  }, [dragX, idx, goTo]);
  return { idx, goTo, dragX, dragging, ref, onTouchStart, onTouchMove, onTouchEnd };
}

// ── Full-screen lightbox ──────────────────────────────────────────────────────
function Lightbox({ photos, startIdx, onClose }: { photos: JobPhoto[]; startIdx: number; onClose: () => void }) {
  const { idx, goTo, dragX, dragging, ref, onTouchStart, onTouchMove, onTouchEnd } = useSwipe(photos.length, startIdx);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goTo(idx - 1);
      if (e.key === "ArrowRight") goTo(idx + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goTo, idx]);

  const photo = photos[idx];
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
        <span className="text-sm text-gray-400">{idx + 1} / {photos.length}</span>
        {photo.caption && <span className="text-sm text-gray-300 truncate max-w-[60%]">{photo.caption}</span>}
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-white text-xl">✕</button>
      </div>
      <div
        ref={ref}
        className="flex-1 overflow-hidden relative"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(${-idx * 100}% + ${dragX}px))`,
            transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
            width: `${photos.length * 100}%`,
          }}
        >
          {photos.map(p => (
            <div key={p.id} className="h-full flex items-center justify-center" style={{ width: `${100 / photos.length}%` }}>
              {p.mediaType === "video" ? (
                <video src={`/uploads/${p.filename}`} poster={`/uploads/${p.filename}.thumb.webp`} className="max-h-full max-w-full object-contain" controls playsInline preload="metadata" />
              ) : (
                <img src={`/uploads/${p.filename}`} alt={p.caption ?? ""} className="max-h-full max-w-full object-contain select-none" draggable={false} />
              )}
            </div>
          ))}
        </div>
        {idx > 0 && <button onClick={() => goTo(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/60 flex items-center justify-center text-white text-2xl">‹</button>}
        {idx < photos.length - 1 && <button onClick={() => goTo(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/60 flex items-center justify-center text-white text-2xl">›</button>}
      </div>
      {photos.length > 1 && photos.length <= 20 && (
        <div className="flex justify-center gap-1.5 py-3 flex-shrink-0">
          {photos.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-gray-600"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reorder mode: tap photos in the order you want them ───────────────────────
function ReorderMode({
  photos,
  onDone,
  onCancel,
}: {
  photos: JobPhoto[];
  onDone: (orderedIds: string[]) => void;
  onCancel: () => void;
}) {
  // null = unassigned, number = position (1-based)
  const [assigned, setAssigned] = useState<(number | null)[]>(() => photos.map((_, i) => i + 1));
  const nextPos = (assigned.filter(Boolean).length) + 1;
  const allAssigned = assigned.every(v => v !== null);

  const tap = (i: number) => {
    setAssigned(prev => {
      const cur = prev[i];
      if (cur !== null) {
        // Unassign: remove this position and shift others down
        const pos = cur;
        return prev.map((v, j) => {
          if (j === i) return null;
          if (v !== null && v > pos) return v - 1;
          return v;
        });
      } else {
        // Assign next position
        const next = prev.filter(Boolean).length + 1;
        const copy = [...prev];
        copy[i] = next;
        return copy;
      }
    });
  };

  const reset = () => setAssigned(photos.map(() => null));

  const handleDone = () => {
    // Build ordered id array from assignments (unassigned go to end in original order)
    const pairs = photos.map((p, i) => ({ id: p.id, pos: assigned[i] ?? Infinity }));
    pairs.sort((a, b) => a.pos - b.pos);
    onDone(pairs.map(p => p.id));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Reorder Photos</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {allAssigned
              ? "Tap a number to remove it, then retap to reassign"
              : `Tap photos in the order you want — next: #${nextPos}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="text-xs px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400">Reset</button>
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-xl bg-gray-800 text-gray-400">Cancel</button>
          <button
            onClick={handleDone}
            disabled={!allAssigned}
            className="text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-40 flex items-center gap-1"
          >
            <Check size={12} /> Done
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => {
          const pos = assigned[i];
          const isPrimary = pos === 1;
          return (
            <button
              key={photo.id}
              onClick={() => tap(i)}
              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
                pos !== null
                  ? isPrimary
                    ? "border-amber-400"
                    : "border-blue-500"
                  : "border-gray-700 opacity-60"
              }`}
            >
              {photo.mediaType === "video" ? (
                <video src={`/uploads/${photo.filename}`} poster={`/uploads/${photo.filename}.thumb.webp`} className="w-full h-full object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={`/uploads/${photo.filename}`} alt="" className="w-full h-full object-cover" />
              )}
              {pos !== null ? (
                <div className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-lg ${
                  isPrimary ? "bg-amber-400 text-gray-950" : "bg-blue-600 text-white"
                }`}>
                  {isPrimary ? <Star size={12} fill="currentColor" /> : pos}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-600 text-center">
        ⭐ = primary photo (position 1) · Tap to assign order · Tap number to remove
      </p>
    </div>
  );
}

// ── Main gallery ──────────────────────────────────────────────────────────────
export default function JobPhotoGallery({ jobId, initialPhotos, initialFeedCaption }: { jobId: string; initialPhotos: JobPhoto[]; initialFeedCaption: string | null }) {
  const [photos, setPhotos] = useState<JobPhoto[]>(
    [...initialPhotos].sort((a, b) => a.sortOrder - b.sortOrder)
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialPhotos.find(p => p.isPrimary)?.id ?? initialPhotos[0]?.id ?? null
  );
  const [reorderMode, setReorderMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showVideoPoster, setShowVideoPoster] = useState(true);
  const [feedCaption, setFeedCaption] = useState(initialFeedCaption ?? "");
  const [captionSaving, setCaptionSaving] = useState(false);
  const [captionDirty, setCaptionDirty] = useState(false);
  const mediaFileRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const saveCaption = async () => {
    setCaptionSaving(true);
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedCaption }),
    });
    setCaptionSaving(false);
    setCaptionDirty(false);
    showToast("Caption saved");
  };

  const enterSelectMode = () => { setSelectMode(true); setSelectedIds(new Set()); };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const toggleSelectPhoto = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(photos.map(p => p.id)));

  const bulkSetPublic = async (makePublic: boolean) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    await Promise.all(ids.map(id =>
      fetch(`/api/jobs/${jobId}/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: makePublic }),
      })
    ));
    setPhotos(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, isPublic: makePublic } : p));
    setBulkBusy(false);
    showToast(makePublic ? `📡 ${ids.length} photo${ids.length > 1 ? "s" : ""} added to feed!` : `${ids.length} photo${ids.length > 1 ? "s" : ""} removed from feed`);
    exitSelectMode();
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} photo${ids.length > 1 ? "s" : ""}? This can't be undone.`)) return;
    setBulkBusy(true);
    await Promise.all(ids.map(id => fetch(`/api/jobs/${jobId}/photos/${id}`, { method: "DELETE" })));
    setPhotos(prev => {
      const next = prev.filter(p => !selectedIds.has(p.id));
      if (selectedIds.has(selectedId ?? "")) setSelectedId(next[0]?.id ?? null);
      return next;
    });
    setBulkBusy(false);
    showToast(`🗑 ${ids.length} photo${ids.length > 1 ? "s" : ""} deleted`);
    exitSelectMode();
  };

  const disableEntirePost = async () => {
    if (publicCount === 0) return;
    if (!confirm("Disable this entire post from the feed? All photos will become private.")) return;
    setBusy(true);
    await fetch(`/api/jobs/${jobId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setPublic: false }),
    });
    setPhotos(prev => prev.map(p => ({ ...p, isPublic: false })));
    setBusy(false);
    showToast("Post removed from feed");
  };

  const selected = photos.find(p => p.id === selectedId) ?? photos[0] ?? null;
  const publicCount = photos.filter(p => p.isPublic).length;

  useEffect(() => { setShowVideoPoster(true); }, [selectedId]);

  // Auto-scroll filmstrip to keep selected thumb visible
  useEffect(() => {
    if (!stripRef.current || !selectedId) return;
    const el = stripRef.current.querySelector(`[data-id="${selectedId}"]`) as HTMLElement;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    let uploadTimeout: ReturnType<typeof setTimeout> | null = null;
    try {
      const incoming = Array.from(files);
      trackMatomoEvent("Job Media", "Upload Start", String(incoming.length));
      const processed = await Promise.all(incoming.map(async (f) => {
        if (f.type.startsWith("image/")) return compressImage(f);
        return f;
      }));
      const fd = new FormData();
      processed.forEach(f => fd.append("photos", f));

      const controller = new AbortController();
      const hasVideo = processed.some(f => f.type.startsWith("video/"));
      const totalBytes = processed.reduce((sum, f) => sum + f.size, 0);
      // Give videos enough time on mobile + slower uplinks
      // - images only: 3 min
      // - mixed/video: 10 min baseline
      // - very large payloads (>=120MB): 15 min
      const timeoutMs = totalBytes >= 120 * 1024 * 1024
        ? 15 * 60 * 1000
        : hasVideo
          ? 10 * 60 * 1000
          : 3 * 60 * 1000;
      uploadTimeout = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`/api/jobs/${jobId}/photos`, { method: "POST", body: fd, signal: controller.signal });

      let data: any = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        const detail = data?.error || data?.message || res.statusText || "Upload failed";
        setUploadError(`Upload failed (${res.status}): ${detail}`);
        console.error("[upload-client] jobs/photos failed", { status: res.status, detail, payloadBytes: totalBytes, hasVideo });
      } else if (data.photos?.length) {
        setPhotos(prev => [...prev, ...data.photos]);
        setSelectedId(data.photos[0].id);
        trackMatomoEvent("Job Media", "Upload Success", String(data.photos.length));
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setUploadError("Upload timed out after several minutes. Please retry on Wi‑Fi, or upload a shorter clip.");
        trackMatomoEvent("Job Media", "Upload Timeout", "abort");
      } else {
        setUploadError(`Upload failed: ${err?.message ?? "unknown error"}`);
        console.error("[upload-client] jobs/photos exception", err);
        trackMatomoEvent("Job Media", "Upload Error", err?.message ?? "unknown");
      }
    } finally {
      if (uploadTimeout) clearTimeout(uploadTimeout);
      setUploading(false);
      if (mediaFileRef.current) mediaFileRef.current.value = "";
    }
  };

  const uploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => uploadFiles(e.target.files);

  const patch = useCallback(async (photoId: string, data: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(`/api/jobs/${jobId}/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.photo) return;
    setPhotos(prev => {
      let next = prev.map(p => {
        if (json.photo.isPrimary && p.id !== photoId) return { ...p, isPrimary: false };
        if (p.id === photoId) return json.photo;
        return p;
      });
      // If setting primary, move to front
      if (json.photo.isPrimary) {
        const idx = next.findIndex(p => p.id === photoId);
        if (idx > 0) {
          const [item] = next.splice(idx, 1);
          next = [item, ...next];
          // Persist new order
          fetch(`/api/jobs/${jobId}/photos`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order: next.map(p => p.id) }),
          });
        }
      }
      return next;
    });
    return json.photo;
  }, [jobId]);

  const deletePhoto = useCallback(async (photoId: string) => {
    await fetch(`/api/jobs/${jobId}/photos/${photoId}`, { method: "DELETE" });
    setPhotos(prev => {
      const next = prev.filter(p => p.id !== photoId);
      if (selectedId === photoId) setSelectedId(next[0]?.id ?? null);
      return next;
    });
    showToast("Photo deleted");
  }, [jobId, selectedId]);

  const applyReorder = useCallback(async (orderedIds: string[]) => {
    // Optimistic update
    const idToPhoto = new Map(photos.map(p => [p.id, p]));
    const reordered = orderedIds.map((id, i) => ({ ...idToPhoto.get(id)!, sortOrder: i }));
    // Mark new primary
    if (reordered[0]) reordered[0] = { ...reordered[0], isPrimary: true };
    for (let i = 1; i < reordered.length; i++) reordered[i] = { ...reordered[i], isPrimary: false };
    setPhotos(reordered);

    // Persist order
    await fetch(`/api/jobs/${jobId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: orderedIds }),
    });
    // Persist new primary
    if (reordered[0] && !photos[0].isPrimary) {
      await fetch(`/api/jobs/${jobId}/photos/${reordered[0].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
    }
    setReorderMode(false);
    showToast("Order saved");
  }, [jobId, photos]);

  // ── Reorder mode ────────────────────────────────────────────────────────────
  if (reorderMode) {
    return (
      <div className="space-y-4">
        <ReorderMode
          photos={photos}
          onDone={applyReorder}
          onCancel={() => setReorderMode(false)}
        />
      </div>
    );
  }

  // ── Normal view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="bg-red-950/60 border border-red-700 rounded-xl p-3 flex items-center gap-2">
          <X size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300 flex-1">{uploadError}</p>
          <button onClick={() => setUploadError(null)}><X size={12} className="text-red-500" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-white flex flex-wrap items-center gap-2 min-w-0">
          <Camera size={15} className="text-blue-400 flex-shrink-0" />
          <span className="truncate">
            Media {photos.length > 0 && <span className="text-gray-500 font-normal">({photos.length})</span>}
          </span>
          {publicCount > 0 && (
            <>
              <span className="text-[10px] bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
                <Globe size={9} /> {publicCount} on feed
              </span>
              <button
                onClick={disableEntirePost}
                disabled={busy}
                className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700 hover:text-white disabled:opacity-50"
              >
                Disable post
              </button>
            </>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
          {photos.length > 0 && !selectMode && (
            <button
              onClick={enterSelectMode}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white"
            >
              Select
            </button>
          )}
          {selectMode ? (
            <>
              <button onClick={selectAll} className="text-xs px-2.5 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white">
                All
              </button>
              <button onClick={exitSelectMode} className="text-xs px-2.5 py-1.5 rounded-xl bg-gray-800 text-gray-400">
                Cancel
              </button>
            </>
          ) : (
            <>
              {photos.length > 1 && (
                <button
                  onClick={() => setReorderMode(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white"
                >
                  <ArrowUpDown size={12} /> Reorder
                </button>
              )}
              <button
                onClick={() => mediaFileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-xl hover:bg-blue-500 active:scale-95 disabled:opacity-50 transition-all"
              >
                <Plus size={13} />
                {uploading ? "Uploading…" : "Add media"}
              </button>
            </>
          )}
        </div>
        <input ref={mediaFileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={uploadMedia} />
      </div>

      {photos.length === 0 ? (
        <div className="w-full border border-dashed border-gray-700 rounded-2xl p-10 text-center text-gray-600">
          <Camera size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Add your first media</p>
          <p className="text-xs mt-1 text-gray-700">Share your build progress on GarageMeet</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={() => mediaFileRef.current?.click()} className="text-xs bg-blue-600 text-white font-semibold px-3 py-1.5 rounded-xl">Add media</button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Feed post caption ── */}
          {publicCount > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                  <Globe size={11} className="text-emerald-400" /> Post description
                </p>
                {captionDirty && (
                  <button
                    onClick={saveCaption}
                    disabled={captionSaving}
                    className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50"
                  >
                    {captionSaving ? "Saving…" : "Save"}
                  </button>
                )}
              </div>
              <textarea
                value={feedCaption}
                onChange={e => { setFeedCaption(e.target.value); setCaptionDirty(true); }}
                onBlur={() => { if (captionDirty) saveCaption(); }}
                placeholder="Describe this build for the GarageMeet feed…"
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-blue-600"
              />
            </div>
          )}

          {/* ── Select mode: full grid ── */}
          {selectMode ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map(photo => {
                const isChecked = selectedIds.has(photo.id);
                return (
                  <button
                    key={photo.id}
                    onClick={() => toggleSelectPhoto(photo.id)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
                      isChecked ? "border-blue-500" : "border-transparent opacity-60"
                    }`}
                  >
                    {photo.mediaType === "video" ? (
                      <video src={`/uploads/${photo.filename}`} poster={`/uploads/${photo.filename}.thumb.webp`} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={`/uploads/${photo.filename}`} alt="" className="w-full h-full object-cover" />
                    )}
                    {/* Check circle */}
                    <div className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isChecked ? "bg-blue-600 border-blue-600" : "bg-black/40 border-gray-400"
                    }`}>
                      {isChecked && <Check size={13} className="text-white" />}
                    </div>
                    {/* Feed status dot */}
                    {photo.isPublic && (
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-emerald-600/90 rounded-full px-1.5 py-0.5">
                        <Globe size={8} className="text-white" />
                        <span className="text-[8px] text-white font-semibold">Feed</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
          /* ── Normal filmstrip ── */
          <div
            ref={stripRef}
            className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
          >
            {photos.map((photo, i) => {
              const isSelected = photo.id === selectedId;
              return (
                <button
                  key={photo.id}
                  data-id={photo.id}
                  onClick={() => setSelectedId(photo.id)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    isSelected ? "border-blue-500 scale-105" : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  {photo.mediaType === "video" ? (
                    <video src={`/uploads/${photo.filename}`} poster={`/uploads/${photo.filename}.thumb.webp`} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={`/uploads/${photo.filename}`} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    photo.isPrimary ? "bg-amber-400 text-gray-950" : "bg-black/70 text-white"
                  }`}>
                    {photo.isPrimary ? <Star size={7} fill="currentColor" /> : i + 1}
                  </div>
                  {photo.isPublic && (
                    <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 flex items-center justify-center">
                      <Globe size={7} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => mediaFileRef.current?.click()}
              disabled={uploading}
              className="flex-shrink-0 w-16 h-16 rounded-xl border border-dashed border-gray-700 flex items-center justify-center text-gray-600 hover:text-gray-400"
              title="Add media"
            >
              <Plus size={18} />
            </button>
          </div>
          )}

          {/* ── Selected photo detail ── */}
          {selected && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Photo */}
              <div
                className={`relative ${selected.mediaType !== "video" ? "cursor-pointer" : ""}`}
                onClick={selected.mediaType !== "video" ? () => setLightboxIdx(photos.findIndex(p => p.id === selected.id)) : undefined}
              >
                {selected.mediaType === "video" ? (
                  <div className="relative w-full rounded-t-2xl bg-black" style={{ maxHeight: 360 }} onClick={e => e.stopPropagation()}>
                    <video
                      src={`/uploads/${selected.filename}`}
                      poster={`/uploads/${selected.filename}.thumb.webp`}
                      className="w-full rounded-t-2xl bg-black"
                      style={{ maxHeight: 360, display: "block" }}
                      controls
                      playsInline
                      preload="metadata"
                      onPlay={() => setShowVideoPoster(false)}
                    />
                    {showVideoPoster && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const video = (e.currentTarget.previousElementSibling as HTMLVideoElement | null);
                          if (video) {
                            setShowVideoPoster(false);
                            video.play().catch(() => {});
                          }
                        }}
                        className="absolute inset-0 w-full h-full"
                        style={{ backgroundImage: `url(/uploads/${selected.filename}.thumb.webp)`, backgroundSize: "cover", backgroundPosition: "center" }}
                        aria-label="Play video"
                      >
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center text-2xl">▶</span>
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  <img
                    src={`/uploads/${selected.filename}`}
                    alt={selected.caption ?? ""}
                    className="w-full object-cover"
                    style={{ maxHeight: 300 }}
                  />
                )}
                {/* Nav arrows within detail */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={e => { e.stopPropagation(); const i = photos.findIndex(p => p.id === selectedId); setSelectedId(photos[Math.max(0, i - 1)].id); }}
                      disabled={photos.findIndex(p => p.id === selectedId) === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white disabled:opacity-0 active:bg-black/90"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); const i = photos.findIndex(p => p.id === selectedId); setSelectedId(photos[Math.min(photos.length - 1, i + 1)].id); }}
                      disabled={photos.findIndex(p => p.id === selectedId) === photos.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white disabled:opacity-0 active:bg-black/90"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
                {/* Tap to fullscreen hint */}
                <div className="absolute bottom-2 right-2 bg-black/60 rounded-lg px-2 py-1 flex items-center gap-1">
                  <Eye size={11} className="text-gray-300" />
                  <span className="text-[10px] text-gray-300">Full screen</span>
                </div>
                {/* Status badges */}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {selected.isPrimary && (
                    <span className="flex items-center gap-1 bg-amber-400 text-gray-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Star size={9} fill="currentColor" /> Primary
                    </span>
                  )}
                  {selected.mediaType === "video" && selected.processingStatus === "processing" && (
                    <span className="flex items-center gap-1 bg-blue-900/80 text-blue-200 text-[10px] px-2 py-0.5 rounded-full">
                      ⏳ Processing
                    </span>
                  )}
                  {selected.isPublic ? (
                    <span className="flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      <Globe size={9} /> On Feed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-gray-800/90 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">
                      <Lock size={9} /> Private
                    </span>
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="px-3 py-3 space-y-2">
                {/* Feed toggle */}
                <button
                  onClick={async () => {
                    const updated = await patch(selected.id, { isPublic: !selected.isPublic });
                    if (updated?.isPublic) showToast("📡 Now on GarageMeet feed!");
                    else showToast("Removed from feed");
                  }}
                  disabled={busy}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-95 disabled:opacity-50 ${
                    selected.isPublic
                      ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700"
                      : "bg-emerald-600 text-white hover:bg-emerald-500"
                  }`}
                >
                  {selected.isPublic ? <><Lock size={14} /> Remove from feed</> : <><Globe size={14} /> Share to GarageMeet feed</>}
                </button>

                {/* Primary + Delete row */}
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await patch(selected.id, { isPrimary: !selected.isPrimary });
                      showToast(selected.isPrimary ? "Removed as primary" : "⭐ Set as primary — moved to top");
                    }}
                    disabled={busy}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm transition-colors active:scale-95 disabled:opacity-50 ${
                      selected.isPrimary
                        ? "bg-amber-400/20 text-amber-400 border border-amber-500"
                        : "bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-500"
                    }`}
                  >
                    <Star size={13} fill={selected.isPrimary ? "currentColor" : "none"} />
                    {selected.isPrimary ? "Primary photo" : "Set as primary"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this photo?")) deletePhoto(selected.id);
                    }}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-xl bg-gray-800 text-gray-500 hover:text-red-400 hover:bg-red-950/40 border border-gray-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Position indicator */}
                <p className="text-center text-xs text-gray-600">
                  Photo {photos.findIndex(p => p.id === selected.id) + 1} of {photos.length}
                  {photos.length > 1 && <span className="ml-2 text-gray-700">· Use <span className="text-gray-500">Reorder</span> to change order</span>}
                </p>
              </div>
            </div>
          )}

          {/* Feed hint */}
          {publicCount === 0 && (
            <p className="text-xs text-gray-600 text-center">
              <Globe size={11} className="inline mr-1" />
              Hit <strong className="text-gray-500">Share to feed</strong> to show this job on GarageMeet
            </p>
          )}
        </>
      )}

      {/* ── Bulk action bar ── */}
      {selectMode && (
        <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-3 space-y-2">
            <p className="text-xs text-center text-gray-400">
              {selectedIds.size === 0
                ? "Tap photos to select"
                : `${selectedIds.size} photo${selectedIds.size > 1 ? "s" : ""} selected`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => bulkSetPublic(true)}
                disabled={bulkBusy || selectedIds.size === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:scale-95 disabled:opacity-40 transition-all"
              >
                <Globe size={15} />
                Share to feed{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </button>
              <button
                onClick={() => bulkSetPublic(false)}
                disabled={bulkBusy || selectedIds.size === 0}
                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm active:scale-95 disabled:opacity-40 border border-gray-700"
              >
                <Lock size={15} />
              </button>
              <button
                onClick={bulkDelete}
                disabled={bulkBusy || selectedIds.size === 0}
                className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-red-950/60 text-red-400 text-sm active:scale-95 disabled:opacity-40 border border-red-900"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox photos={photos} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </div>
  );
}
