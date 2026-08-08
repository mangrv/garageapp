"use client";

import { useState, useRef, useTransition, useEffect, useCallback } from "react";
import { useT } from "@/app/hooks/useT";
import { useApp } from "@/app/providers/AppProviders";
import { setFeaturedPhoto, deleteCarPhoto, updateCarPhoto } from "./actions";
import { compressImage } from "@/app/lib/compressImage";

type Photo = {
  id: string;
  filename: string;
  caption: string | null;
  takenAt: string | null;
  isFeatured: boolean;
  createdAt: string;
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function toInputDate(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ── Shared Lightbox ──────────────────────────────────────────────────────────
function Lightbox({
  photos,
  index,
  carId,
  onClose,
  onNavigate,
}: {
  photos: Photo[];
  index: number;
  carId: string;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const { lang } = useApp();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const touchStartX = useRef<number | null>(null);

  const photo = photos[index];

  // Reset editing state when photo changes
  useEffect(() => {
    setEditing(false);
    setCaption(photo.caption ?? "");
    setTakenAt(toInputDate(photo.takenAt));
  }, [photo.id, photo.caption, photo.takenAt]);

  const goPrev = useCallback(() => onNavigate((index - 1 + photos.length) % photos.length), [index, photos.length, onNavigate]);
  const goNext = useCallback(() => onNavigate((index + 1) % photos.length), [index, photos.length, onNavigate]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  // Swipe
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) { dx < 0 ? goNext() : goPrev(); }
    touchStartX.current = null;
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateCarPhoto(photo.id, carId, caption, takenAt);
      setEditing(false);
    });
  };

  const handleDelete = () => {
    if (!confirm(lang === "es" ? "¿Eliminar esta foto?" : "Delete this photo?")) return;
    startTransition(async () => {
      await deleteCarPhoto(photo.id, carId);
      if (photos.length > 1) {
        onNavigate(Math.min(index, photos.length - 2));
      } else {
        onClose();
      }
    });
  };

  const handleFeature = () => {
    startTransition(async () => {
      await setFeaturedPhoto(photo.id, carId);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 flex-shrink-0">
        <span className="text-sm text-gray-400">{index + 1} / {photos.length}</span>
        {photo.isFeatured && (
          <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">⭐ Featured</span>
        )}
        <button onClick={onClose} className="text-2xl text-gray-300 w-10 h-10 flex items-center justify-center">✕</button>
      </div>

      {/* Image + arrows */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
        {photos.length > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-2 z-10 text-white text-3xl bg-black/50 rounded-full w-11 h-11 flex items-center justify-center active:bg-black/80"
          >‹</button>
        )}

        <img
          src={`/uploads/${photo.filename}`}
          alt={photo.caption ?? ""}
          className="max-h-full max-w-full object-contain select-none"
          draggable={false}
        />

        {photos.length > 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 z-10 text-white text-3xl bg-black/50 rounded-full w-11 h-11 flex items-center justify-center active:bg-black/80"
          >›</button>
        )}
      </div>

      {/* Dot indicators */}
      {photos.length > 1 && photos.length <= 20 && (
        <div className="flex justify-center gap-1.5 py-2 bg-black/60 flex-shrink-0">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => onNavigate(i)}
              className={`rounded-full transition-all ${i === index ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-gray-600"}`}
            />
          ))}
        </div>
      )}

      {/* Caption / edit form */}
      <div className="bg-black/80 px-4 py-3 flex-shrink-0">
        {editing ? (
          <div className="space-y-2">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={lang === "es" ? "Descripción…" : "Caption…"}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              autoFocus
            />
            <input
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={pending} className="flex-1 bg-amber-500 text-gray-950 font-bold py-2 rounded-xl text-sm disabled:opacity-40">
                {lang === "es" ? "Guardar" : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-sm">
                {lang === "es" ? "Cancelar" : "Cancel"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {photo.caption && <p className="text-sm text-white mb-0.5">{photo.caption}</p>}
            {photo.takenAt && <p className="text-xs text-gray-400">📅 {formatDate(photo.takenAt)}</p>}
            {!photo.caption && !photo.takenAt && <p className="text-xs text-gray-600">{lang === "es" ? "Sin descripción" : "No caption"}</p>}
          </div>
        )}
      </div>

      {/* Action bar */}
      {!editing && (
        <div className="flex justify-around px-4 py-3 bg-black/90 border-t border-gray-800 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="flex flex-col items-center gap-1 text-xs text-gray-300">
            <span className="text-xl">✏️</span>{lang === "es" ? "Editar" : "Edit"}
          </button>
          {!photo.isFeatured && (
            <button onClick={handleFeature} disabled={pending} className="flex flex-col items-center gap-1 text-xs text-amber-300 disabled:opacity-40">
              <span className="text-xl">⭐</span>{lang === "es" ? "Destacar" : "Feature"}
            </button>
          )}
          <a
            href={`/uploads/${photo.filename}`}
            download
            className="flex flex-col items-center gap-1 text-xs text-gray-300"
          >
            <span className="text-xl">⬇️</span>{lang === "es" ? "Guardar" : "Save"}
          </a>
          <button onClick={handleDelete} disabled={pending} className="flex flex-col items-center gap-1 text-xs text-red-400 disabled:opacity-40">
            <span className="text-xl">🗑</span>{lang === "es" ? "Eliminar" : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── CarGallery ───────────────────────────────────────────────────────────────
export default function CarGallery({ carId, photos: initialPhotos }: { carId: string; photos: Photo[] }) {
  const t = useT();
  const { lang } = useApp();
  const [photos] = useState<Photo[]>(initialPhotos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [pendingCaption, setPendingCaption] = useState("");
  const [pendingDate, setPendingDate] = useState(new Date().toISOString().slice(0, 10));
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setShowUpload(true);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    startTransition(async () => {
      setUploading(true);
      try {
        const uploadFile = selectedFile.type?.startsWith("image/")
          ? await compressImage(selectedFile)
          : selectedFile;
        const fd = new FormData();
        fd.append("photo", uploadFile);
        fd.append("caption", pendingCaption);
        fd.append("takenAt", pendingDate);

        // Use API route for reliable large-file/mobile uploads (esp. videos)
        const res = await fetch(`/api/cars/${carId}/photos`, { method: "POST", body: fd });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as any)?.error || `Upload failed (${res.status})`);
        }
        setSelectedFile(null);
        setPreview(null);
        setPendingCaption("");
        setPendingDate(new Date().toISOString().slice(0, 10));
        setShowUpload(false);
        if (fileRef.current) fileRef.current.value = "";
      } catch (e: any) {
        alert((lang === "es" ? "Falló la carga: " : "Upload failed: ") + (e.message ?? "Unknown error."));
      } finally {
        setUploading(false);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Shared lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          carId={carId}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {/* Upload area */}
      {showUpload && preview ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
          {selectedFile?.type?.startsWith("video/") ? (
            <video src={preview} controls playsInline className="w-full max-h-48 object-cover rounded-xl bg-black" />
          ) : (
            <img src={preview} alt="preview" className="w-full max-h-48 object-cover rounded-xl" />
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{lang === "es" ? "Descripción" : "Caption"}</label>
            <input
              value={pendingCaption}
              onChange={(e) => setPendingCaption(e.target.value)}
              placeholder={lang === "es" ? "ej. Después del primer lavado…" : "e.g. After first wash…"}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{lang === "es" ? "Fecha tomada" : "Date taken"}</label>
            <input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleUpload}
              disabled={pending || uploading}
              className="flex-1 bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
            >
              {uploading ? t("uploading") : t("addPhoto")}
            </button>
            <button
              onClick={() => { setShowUpload(false); setSelectedFile(null); setPreview(null); }}
              className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm"
            >
              {lang === "es" ? "Cancelar" : "Cancel"}
            </button>
          </div>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-700 rounded-2xl p-4 cursor-pointer active:border-amber-500 transition-colors">
          <span className="text-2xl">📷</span>
          <span className="text-sm text-gray-400">{lang === "es" ? "Agregar una foto" : "Add a photo"}</span>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
        </label>
      )}

      {/* Gallery grid */}
      {photos.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">{t("noPhotosYet")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className={`relative rounded-xl overflow-hidden bg-gray-800 border cursor-pointer active:opacity-80 transition-opacity ${photo.isFeatured ? "border-amber-400" : "border-gray-700"}`}
              onClick={() => setLightboxIndex(index)}
            >
              <div className="aspect-square">
                <img
                  src={`/uploads/${photo.filename}`}
                  alt={photo.caption ?? ""}
                  className="w-full h-full object-cover"
                />
              </div>
              {photo.isFeatured && (
                <div className="absolute top-2 left-2 bg-amber-400 text-gray-950 text-xs font-bold px-2 py-0.5 rounded-full">
                  ⭐ {lang === "es" ? "Destacada" : "Featured"}
                </div>
              )}
              {photo.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5">
                  <p className="text-xs text-white truncate">{photo.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
