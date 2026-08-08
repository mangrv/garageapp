"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Photo = {
  id: string;
  filename: string;
  caption: string | null;
};

// ── Lightbox (mirrors GalleryClient lightbox) ────────────────────────────────
function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const photo = photos[index];
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(
    () => onNavigate((index - 1 + photos.length) % photos.length),
    [index, photos.length, onNavigate]
  );
  const goNext = useCallback(
    () => onNavigate((index + 1) % photos.length),
    [index, photos.length, onNavigate]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

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
        <span className="text-sm text-gray-400">{index + 1} / {photos.length}</span>
        {photo.caption && (
          <span className="text-sm text-gray-300 truncate max-w-[50%]">{photo.caption}</span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-2xl text-gray-300 w-10 h-10 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {/* Image + prev/next arrows */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 z-10 text-white text-3xl bg-black/50 rounded-full w-11 h-11 flex items-center justify-center active:bg-black/80"
          >
            ‹
          </button>
        )}
        <img
          src={`/uploads/${photo.filename}`}
          alt={photo.caption ?? ""}
          className="max-h-full max-w-full object-contain select-none"
          draggable={false}
        />
        {photos.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 z-10 text-white text-3xl bg-black/50 rounded-full w-11 h-11 flex items-center justify-center active:bg-black/80"
          >
            ›
          </button>
        )}
      </div>

      {/* Dot indicators */}
      {photos.length > 1 && photos.length <= 20 && (
        <div className="flex justify-center gap-1.5 py-2 bg-black/60 flex-shrink-0">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onNavigate(i)}
              className={`rounded-full transition-all ${
                i === index ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-gray-600"
              }`}
            />
          ))}
        </div>
      )}

      {/* Actions row (save + close) */}
      <div className="flex justify-center gap-4 px-4 py-4 bg-black/90 border-t border-gray-800 flex-shrink-0">
        <a
          href={`/uploads/${photo.filename}`}
          download
          className="flex flex-col items-center gap-1 text-xs text-gray-300 bg-gray-800 px-5 py-3 rounded-xl"
        >
          <span className="text-xl">⬇️</span>
          Save
        </a>
        <button
          type="button"
          onClick={onClose}
          className="flex flex-col items-center gap-1 text-xs text-gray-300 bg-gray-800 px-5 py-3 rounded-xl"
        >
          <span className="text-xl">✕</span>
          Close
        </button>
      </div>
    </div>
  );
}

// ── Gallery grid ─────────────────────────────────────────────────────────────
export default function SharePhotoGallery({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {/* Grid — same 3-column layout as the gallery page */}
      <div className="mt-3 grid grid-cols-3 gap-1">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square overflow-hidden rounded-lg bg-gray-800 group focus:outline-none"
          >
            <img
              src={`/uploads/${photo.filename}`}
              alt={photo.caption ?? ""}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform select-none"
              draggable={false}
            />
            {/* Expand hint on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="bg-black/60 rounded-full w-8 h-8 flex items-center justify-center text-white text-sm">⛶</span>
            </div>
            {/* Count badge on first photo */}
            {i === 0 && photos.length > 1 && (
              <span className="absolute top-1 right-1 bg-black/70 text-white text-[10px] rounded px-1.5 py-0.5">
                1/{photos.length}
              </span>
            )}
            {photo.caption && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-1 truncate">
                {photo.caption}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
