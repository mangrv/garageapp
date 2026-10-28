"use client";

import { useState, useRef, useTransition } from "react";
import { useApp } from "@/app/providers/AppProviders";
import Link from "next/link";
import Image from "next/image";
import Glyph from "@/app/components/Glyph";

type PhotoItem = { id: string; filename: string; caption: string | null; createdAt: string; isPrivate: boolean };
type ReceiptItem = { id: string; filename: string; vendor: string | null; receiptDate: string | null };
type DocumentItem = { id: string; carId: string; filename: string; type: string; label: string | null; isPrivate: boolean };

type GalleryImage = {
  id: string;
  src: string;
  caption: string | null;
  category: "photo" | "receipt" | "document";
  isPdf: boolean;
  isPrivate: boolean;
};

type Tab = "all" | "photo" | "receipt" | "document";

function buildImages(
  photos: PhotoItem[],
  receipts: ReceiptItem[],
  documents: DocumentItem[]
): GalleryImage[] {
  const result: GalleryImage[] = [];
  for (const p of photos) {
    result.push({
      id: p.id,
      src: `/uploads/${p.filename}`,
      caption: p.caption,
      category: "photo",
      isPdf: p.filename.toLowerCase().endsWith(".pdf"),
      isPrivate: p.isPrivate,
    });
  }
  for (const r of receipts) {
    result.push({
      id: r.id,
      src: `/uploads/${r.filename}`,
      caption: r.vendor ?? null,
      category: "receipt",
      isPdf: r.filename.toLowerCase().endsWith(".pdf"),
      isPrivate: false, // receipts inherit privacy from their job/service record context
    });
  }
  for (const d of documents) {
    result.push({
      id: d.id,
      src: `/uploads/cars/${d.carId}/docs/${d.filename}`,
      caption: d.label ?? d.type,
      category: "document",
      isPdf: d.filename.toLowerCase().endsWith(".pdf"),
      isPrivate: d.isPrivate,
    });
  }
  return result;
}

const CATEGORY_BADGE: Record<string, string> = {
  photo: "🚗",
  receipt: "🧾",
  document: "📁",
};

const TAB_LABELS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "photo", label: "Car Photos" },
  { key: "receipt", label: "Receipts" },
  { key: "document", label: "Documents" },
];

export default function GalleryClient({
  carId,
  carName,
  photos,
  receipts,
  documents,
}: {
  carId: string;
  carName: string;
  photos: PhotoItem[];
  receipts: ReceiptItem[];
  documents: DocumentItem[];
}) {
  const { lang } = useApp();
  const [allImages, setAllImages] = useState(() => buildImages(photos, receipts, documents));
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleting, startDelTransition] = useTransition();
  const [togglingPrivacy, startPrivacyTransition] = useTransition();

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const filtered = activeTab === "all" ? allImages : allImages.filter((img) => img.category === activeTab);

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goPrev = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + filtered.length) % filtered.length);
  };

  const goNext = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % filtered.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const delta = touchStartX.current - touchEndX.current;
    if (delta > 50) goNext();
    else if (delta < -50) goPrev();
  };

  const currentImage = lightboxIndex !== null ? filtered[lightboxIndex] : null;

  const handleDelete = async (img: GalleryImage) => {
    const msg = lang === "es" ? "¿Eliminar esta imagen?" : "Delete this image?";
    if (!confirm(msg)) return;
    startDelTransition(async () => {
      try {
        if (img.category === "photo") {
          await fetch(`/api/cars/${carId}/photos/${img.id}`, { method: "DELETE" });
        } else if (img.category === "document") {
          await fetch(`/api/cars/${carId}/documents/${img.id}`, { method: "DELETE" });
        } else if (img.category === "receipt") {
          await fetch(`/api/receipts/${img.id}`, { method: "DELETE" });
        }
        setAllImages((prev) => prev.filter((i) => i.id !== img.id));
        closeLightbox();
      } catch {
        alert(lang === "es" ? "Error al eliminar" : "Failed to delete");
      }
    });
  };

  const handleTogglePrivacy = async (img: GalleryImage) => {
    if (img.category === "receipt") return; // receipts not toggleable here
    startPrivacyTransition(async () => {
      try {
        const newPrivate = !img.isPrivate;
        if (img.category === "photo") {
          await fetch(`/api/cars/${carId}/photos/${img.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPrivate: newPrivate }),
          });
        } else if (img.category === "document") {
          await fetch(`/api/cars/${carId}/documents/${img.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPrivate: newPrivate }),
          });
        }
        setAllImages((prev) =>
          prev.map((i) => (i.id === img.id ? { ...i, isPrivate: newPrivate } : i))
        );
      } catch {
        alert("Failed to update privacy");
      }
    });
  };

  const buildShareMessage = (url: string) =>
    `Check out this app I built — My Garage \n\nTrack your vehicles, manage repairs, log service history, and more. You can browse as a guest or register free for the full experience.\n\n${url}`;

  const handleShare = async (img: GalleryImage) => {
    const url = `${window.location.origin}${img.src}`;
    if (navigator.share) {
      try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        const ext = img.src.split(".").pop() ?? "jpg";
        const file = new File([blob], `image.${ext}`, { type: blob.type });
        await navigator.share({
          files: [file],
          title: img.caption ?? carName,
          text: buildShareMessage(window.location.origin),
        });
        return;
      } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(buildShareMessage(url));
      alert("Copied! Message + link ready to paste.");
    } catch {
      alert(buildShareMessage(url));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link href={`/cars/${carId}`} className="text-amber-400 text-sm">← Back</Link>
        <h1 className="font-bold text-base flex-1 truncate"><Glyph e="📸" /> {carName} — Gallery</h1>
        <a
          href={`/api/cars/${carId}/gallery/download`}
          download
          className="text-xs bg-amber-500 text-on-accent font-semibold px-3 py-1.5 rounded-lg"
        >
          <Glyph e="⬇" /> ZIP
        </a>
      </div>

      {/* Privacy legend */}
      <div className="mx-4 mt-3 mb-1 px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-xs text-gray-400 flex items-center gap-2">
        <span><Glyph e="🔒" /></span>
        <span>Private items are only visible to you — friends cannot see them. Tap <Glyph e="🔒" />/<Glyph e="🌐" /> in any item to toggle.</span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setLightboxIndex(null); }}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap font-medium transition-colors ${
              activeTab === key
                ? "bg-amber-500 text-on-accent"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-16">No images in this category</div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-1 px-1 pt-1">
          {filtered.map((img, index) => (
            <div key={img.id} className="relative">
              <button
                onClick={() => openLightbox(index)}
                className={`relative w-full aspect-square overflow-hidden rounded-xl bg-gray-800 group ${img.isPrivate ? "ring-2 ring-inset ring-amber-500/60" : ""}`}
              >
                {img.isPdf ? (
                  <div className="w-full h-full flex items-center justify-center text-4xl"><Glyph e="📄" /></div>
                ) : (
                  <Image
                    unoptimized
                    src={img.src}
                    alt={img.caption ?? ""}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                    sizes="(max-width: 768px) 33vw, 25vw"
                  />
                )}
                {/* Private overlay tint */}
                {img.isPrivate && (
                  <div className="absolute inset-0 bg-amber-900/20 rounded-xl" />
                )}
                {/* Category badge */}
                <span className="absolute bottom-1 left-1 text-xs bg-black/60 rounded px-1">
                  <Glyph e={CATEGORY_BADGE[img.category]} />
                </span>
                {/* Caption */}
                {img.caption && (
                  <span className="absolute bottom-1 right-1 text-xs bg-black/60 rounded px-1 truncate max-w-[60%]">
                    {img.caption}
                  </span>
                )}
              </button>
              {/* Privacy toggle button (top-right corner) */}
              {img.category !== "receipt" && (
                <button
                  onClick={() => handleTogglePrivacy(img)}
                  disabled={togglingPrivacy}
                  title={img.isPrivate ? "Private — tap to make public" : "Visible to friends — tap to make private"}
                  className="absolute top-1 right-1 text-sm bg-black/70 rounded-full w-6 h-6 flex items-center justify-center leading-none z-10 active:scale-90 transition-transform"
                >
                  {img.isPrivate ? <Glyph e="🔒" /> : <Glyph e="🌐" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {currentImage && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <span className="text-sm text-gray-400">
              {lightboxIndex + 1} / {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm"><Glyph e={CATEGORY_BADGE[currentImage.category]} /></span>
              {currentImage.isPrivate && (
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  <Glyph e="🔒" /> Private
                </span>
              )}
            </div>
            <button onClick={closeLightbox} className="text-2xl text-gray-300 leading-none"><Glyph e="✕" /></button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <button
              onClick={goPrev}
              className="absolute left-2 z-10 text-white text-3xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center"
            >
              ‹
            </button>
            {currentImage.isPdf ? (
              <div className="text-8xl"><Glyph e="📄" /></div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImage.src}
                alt={currentImage.caption ?? ""}
                className="max-h-full max-w-full object-contain"
              />
            )}
            <button
              onClick={goNext}
              className="absolute right-2 z-10 text-white text-3xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center"
            >
              ›
            </button>
          </div>

          {/* Caption */}
          {currentImage.caption && (
            <div className="text-center text-sm text-gray-300 px-4 py-2 bg-black/80">
              {currentImage.caption}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-center gap-3 px-4 py-4 bg-black/80 flex-wrap">
            {currentImage.category !== "receipt" && (
              <button
                onClick={() => handleTogglePrivacy(currentImage)}
                disabled={togglingPrivacy}
                className={`flex flex-col items-center gap-1 text-xs px-4 py-3 rounded-xl ${
                  currentImage.isPrivate
                    ? "text-amber-300 bg-amber-900/30"
                    : "text-gray-300 bg-gray-800"
                }`}
              >
                <span className="text-xl">{currentImage.isPrivate ? <Glyph e="🔒" /> : <Glyph e="🌐" />}</span>
                {currentImage.isPrivate ? "Private" : "Public"}
              </button>
            )}
            <button
              onClick={() => handleShare(currentImage)}
              className="flex flex-col items-center gap-1 text-xs text-gray-300 bg-gray-800 px-4 py-3 rounded-xl"
            >
              <span className="text-xl"><Glyph e="🔗" /></span>
              Share
            </button>
            <a
              href={currentImage.src}
              download
              className="flex flex-col items-center gap-1 text-xs text-gray-300 bg-gray-800 px-4 py-3 rounded-xl"
            >
              <span className="text-xl"><Glyph e="⬇" /></span>
              Save
            </a>
            <button
              onClick={closeLightbox}
              className="flex flex-col items-center gap-1 text-xs text-gray-300 bg-gray-800 px-4 py-3 rounded-xl"
            >
              <span className="text-xl"><Glyph e="✕" /></span>
              Close
            </button>
            <button
              onClick={() => handleDelete(currentImage)}
              disabled={deleting}
              className="flex flex-col items-center gap-1 text-xs text-red-400 bg-gray-800 px-4 py-3 rounded-xl disabled:opacity-40"
            >
              <span className="text-xl"><Glyph e="🗑" /></span>
              {lang === "es" ? "Eliminar" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
