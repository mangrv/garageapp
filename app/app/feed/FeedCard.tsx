"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, X, ExternalLink, Heart, Bookmark, Share2 } from "lucide-react";
import { trackMatomoEvent } from "@/app/lib/matomo";

// ── Smooth swipe carousel hook ────────────────────────────────────────────────
function useSwipeCarousel(count: number) {
  const [idx, setIdx] = useState(0);
  const [dragX, setDragX] = useState(0);   // live drag offset in px
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((i: number) => setIdx(Math.max(0, Math.min(count - 1, i))), [count]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setDragging(true);
    setDragX(0);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return;
    setDragX(e.touches[0].clientX - startX.current);
  }, [dragging]);

  const onTouchEnd = useCallback(() => {
    setDragging(false);
    const threshold = (containerRef.current?.offsetWidth ?? 200) * 0.25;
    if (dragX < -threshold) goTo(idx + 1);
    else if (dragX > threshold) goTo(idx - 1);
    setDragX(0);
  }, [dragX, idx, goTo]);

  return { idx, goTo, dragX, dragging, containerRef, onTouchStart, onTouchMove, onTouchEnd };
}

type FeedJob = {
  id: string;
  title: string;
  notes: string | null;
  feedCaption: string | null;
  status: string;
  feedUpdatedAt: string | null;
  car: { year: number; make: string; model: string } | null;
  user: { id: string; name: string | null; username: string | null } | null;
  liked: boolean;
  bookmarked: boolean;
  likesCount: number;
  bookmarksCount: number;
  photos: { id: string; filename: string; mediaType?: "image" | "video"; caption: string | null; isPrimary: boolean }[];
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To Do", up_next: "Up Next", active: "In Progress",
  in_progress: "In Progress", blocked: "Blocked", testing: "Testing",
  done: "Done", archived: "Archived",
};
const STATUS_COLOR: Record<string, string> = {
  todo: "bg-gray-700 text-gray-300", up_next: "bg-blue-900 text-blue-400",
  active: "bg-amber-900 text-amber-400", in_progress: "bg-amber-900 text-amber-400",
  blocked: "bg-red-900 text-red-400", testing: "bg-blue-900 text-blue-400",
  done: "bg-emerald-900 text-emerald-400", archived: "bg-gray-800 text-gray-500",
};

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(d / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Feed lightbox — Twitter/X style ──────────────────────────────────────────
function FeedLightbox({
  photos, startIdx, title, description, displayName, carLabel, jobHref, onClose,
}: {
  photos: FeedJob["photos"]; startIdx: number; title: string;
  description: string | null; displayName: string; carLabel: string | null;
  jobHref: string; onClose: () => void;
}) {
  const { idx, goTo, dragX, dragging, containerRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeCarousel(photos.length);
  const [infoExpanded, setInfoExpanded] = useState(false);

  useEffect(() => { goTo(startIdx); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (infoExpanded) setInfoExpanded(false); else onClose(); }
      if (!infoExpanded && e.key === "ArrowLeft") goTo(idx - 1);
      if (!infoExpanded && e.key === "ArrowRight") goTo(idx + 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, goTo, idx, infoExpanded]);

  return createPortal(
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 99999 }}>
      {/* Top bar — always on top, hardcoded dark so never hidden */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 py-2"
        style={{ background: "rgba(0,0,0,0.80)", minHeight: 52 }}>
        {/* ✕ Close — left so thumb can reach it */}
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <X size={18} />
        </button>
        {/* Title — takes all remaining space, wraps to 2 lines */}
        <span style={{ color: "#ffffff", fontSize: 15, fontWeight: 600, lineHeight: 1.25, flex: 1 }}>
          {title}
        </span>
        {/* Counter badge — only when multi-photo */}
        {photos.length > 1 && (
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, flexShrink: 0 }}>
            {idx + 1}/{photos.length}
          </span>
        )}
      </div>

      {/* Full-screen sliding image — swipe area only, no arrows inside */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ touchAction: "none" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (Math.abs(dragX) < 5) onClose(); }}
      >
        <div
          style={{
            position: "absolute", inset: 0,
            transform: `translate3d(calc(${-idx * 100}% + ${dragX}px), 0, 0)`,
            transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
            willChange: "transform",
          }}
        >
          {photos.map((p, i) => (
            <div key={p.id} style={{ position: "absolute", left: `${i * 100}%`, top: 0, width: "100%", height: "100%" }}>
              {p.mediaType === "video" ? (
                <video src={`/uploads/${p.filename}`} poster={`/uploads/${p.filename}.thumb.webp`} className="w-full h-full object-contain" controls playsInline preload="metadata" />
              ) : (
                <img src={`/uploads/${p.filename}`} alt={p.caption ?? title} className="w-full h-full object-contain select-none" draggable={false} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Arrows — outside the swipe area so they never jitter during drag */}
      {idx > 0 && (
        <button
          onClick={() => goTo(idx - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", backdropFilter: "blur(4px)" }}
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
      )}
      {idx < photos.length - 1 && (
        <button
          onClick={() => goTo(idx + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", backdropFilter: "blur(4px)" }}
        >
          <ChevronRight size={22} strokeWidth={2.5} />
        </button>
      )}

      {/* Dot strip */}
      {photos.length > 1 && photos.length <= 20 && (
        <div className="absolute bottom-36 left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-10">
          {photos.map((_, i) => (
            <div key={i}
              className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5" : "w-1.5 h-1.5"}`}
              style={{
                background: i === idx ? "#ffffff" : "rgba(255,255,255,0.5)",
                boxShadow: "0 0 3px rgba(0,0,0,0.8)",
              }}
            />
          ))}
        </div>
      )}

      {/* ── Post info overlay — collapsed or expanded ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20"
        style={{ transition: "all 0.3s cubic-bezier(0.25,0.46,0.45,0.94)" }}
      >
        {/* Gradient scrim — tall + strong so all text is readable over any photo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.92) 30%, rgba(0,0,0,0.7) 55%, rgba(0,0,0,0.3) 75%, transparent 100%)" }}
        />

        {/* Text shadow mixin applied to all text children */}
        <div
          className="relative px-4 pt-12 pb-8 space-y-1"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.7)" }}
          onClick={e => { e.stopPropagation(); setInfoExpanded(v => !v); }}
        >
          {/* Author + car */}
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 500 }}>
            {displayName}{carLabel ? ` · ${carLabel}` : ""}
          </p>

          {/* Description */}
          {description && (
            <p style={{ color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 1.55 }}
              className={infoExpanded ? "" : "line-clamp-2"}>
              {description}
            </p>
          )}

          {/* Expand hint / View job */}
          {infoExpanded ? (
            <Link
              href={jobHref}
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-3 py-1.5 rounded-xl"
              style={{ color: "#93c5fd", background: "rgba(37,99,235,0.35)", border: "1px solid rgba(59,130,246,0.7)", textShadow: "none" }}
            >
              View full job <ExternalLink size={11} />
            </Link>
          ) : (
            description && (
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                Tap for more <ChevronRight size={10} />
              </p>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Feed card ─────────────────────────────────────────────────────────────────
export default function FeedCard({ job, isOwner }: { job: FeedJob; isOwner: boolean }) {
  const { idx, goTo, dragX, dragging, containerRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeCarousel(job.photos.length);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [liked, setLiked] = useState(job.liked);
  const [bookmarked, setBookmarked] = useState(job.bookmarked);
  const [likesCount, setLikesCount] = useState(job.likesCount ?? 0);
  const [bookmarksCount, setBookmarksCount] = useState(job.bookmarksCount ?? 0);
  const photos = job.photos;
  const photo = photos[idx];
  const hasMultiple = photos.length > 1;

  if (!photo) return null;

  const carLabel = job.car ? `${job.car.year} ${job.car.make} ${job.car.model}` : null;
  const displayName = job.user?.name ?? job.user?.username ?? "Garage member";
  const statusLabel = STATUS_LABEL[job.status] ?? job.status;
  const statusColor = STATUS_COLOR[job.status] ?? "bg-gray-700 text-gray-300";
  const jobHref = isOwner ? `/job/${job.id}` : `/share/${job.id}`;
  const description = job.feedCaption || job.notes;
  const hasLongDescription = !!description && description.length > 160;

  const openLightbox = useCallback(() => {
    setLightboxOpen(true);
    // Lock body scroll so page doesn't jump behind the overlay
    document.body.style.overflow = "hidden";
    // Push URL so back button / refresh preserves the open state
    history.pushState({ lightbox: job.id }, "", `?post=${job.id}`);
  }, [job.id]);

  const sharePost = useCallback(async () => {
    const url = `${location.origin}${jobHref}`;
    const title = job.title;
    const text = description ?? "Check out this GarageMeet build";

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      trackMatomoEvent("Feed", "Share", job.id);
    } catch {}
  }, [jobHref, job.title, description]);

  const toggleInteraction = useCallback(async (action: "like" | "bookmark") => {
    const res = await fetch(`/api/feed/${job.id}/interactions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setLiked(!!data.liked);
    setBookmarked(!!data.bookmarked);
    setLikesCount(data.likesCount ?? 0);
    setBookmarksCount(data.bookmarksCount ?? 0);
    trackMatomoEvent("Feed", action === "like" ? "Toggle Like" : "Toggle Bookmark", job.id);
  }, [job.id]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    document.body.style.overflow = "";
    // Restore URL (go back if we pushed, else just clear the param)
    if (history.state?.lightbox === job.id) {
      history.back();
    } else {
      history.replaceState(null, "", location.pathname);
    }
  }, [job.id]);

  // Close on browser back
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = () => { setLightboxOpen(false); document.body.style.overflow = ""; };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [lightboxOpen]);

  // Safety: always unlock scroll on unmount
  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  return (
    <>
      {lightboxOpen && (
        <FeedLightbox
          photos={photos}
          startIdx={idx}
          title={job.title}
          description={description ?? null}
          displayName={displayName}
          carLabel={carLabel}
          jobHref={jobHref}
          onClose={closeLightbox}
        />
      )}

      <article className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Author row */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            {carLabel && <p className="text-[11px] text-gray-500">{carLabel}</p>}
          </div>
          <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Image carousel — smooth swipe, tap to open lightbox */}
        <div className="relative bg-gray-800 aspect-square overflow-hidden">
          {/* Swipe zone — isolated from arrows */}
          <div
            ref={containerRef}
            className="absolute inset-0"
            style={{ touchAction: "pan-y" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={() => { if (Math.abs(dragX) < 5) openLightbox(); }}
          >
            <div
              style={{
                position: "absolute", inset: 0,
                transform: `translate3d(calc(${-idx * 100}% + ${dragX}px), 0, 0)`,
                transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)",
                willChange: "transform",
              }}
            >
              {photos.map((p, i) => (
                <div key={p.id} style={{ position: "absolute", left: `${i * 100}%`, top: 0, width: "100%", height: "100%" }}>
                  {p.mediaType === "video" ? (
                    <video src={`/uploads/${p.filename}`} poster={`/uploads/${p.filename}.thumb.webp`} className="w-full h-full object-cover" muted playsInline preload="metadata" controls />
                  ) : (
                    <img src={`/uploads/${p.filename}`} alt={p.caption ?? job.title} className="w-full h-full object-cover" draggable={false} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Arrows — outside swipe zone, won't jitter */}
          {hasMultiple && idx > 0 && (
            <button onClick={() => goTo(idx - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.65)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
          )}
          {hasMultiple && idx < photos.length - 1 && (
            <button onClick={() => goTo(idx + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.65)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          )}

          {hasMultiple && (
            <>
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 pointer-events-none z-10">
                {photos.map((_, i) => (
                  <div key={i} className={`rounded-full transition-all ${i === idx ? "w-4 h-1.5" : "w-1.5 h-1.5"}`}
                    style={{ background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", boxShadow: "0 0 3px rgba(0,0,0,0.8)" }} />
                ))}
              </div>
              <div className="absolute top-2 right-2 z-10 text-[10px] px-1.5 py-0.5 rounded-full pointer-events-none"
                style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                {idx + 1}/{photos.length}
              </div>
            </>
          )}
        </div>

        {/* Description + meta */}
        <div className="px-4 py-3 space-y-2">
          {/* Job title links to job page */}
          <div className="flex items-start justify-between gap-2">
            <Link href={jobHref} className="block min-w-0">
              <p className="text-sm font-semibold text-white hover:text-blue-400 transition-colors">{job.title}</p>
            </Link>
            <Link href={jobHref} className="flex-shrink-0 flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300">
              <ExternalLink size={11} />
            </Link>
          </div>

          {/* IG-style post actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => toggleInteraction("like")}
              className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1"
              aria-label="Like post"
            >
              <Heart size={18} className={liked ? "text-red-400" : "text-gray-300"} fill={liked ? "currentColor" : "none"} />
              <span className="text-xs text-gray-500">{likesCount}</span>
            </button>
            <button
              onClick={() => toggleInteraction("bookmark")}
              className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1"
              aria-label="Save post"
            >
              <Bookmark size={18} className={bookmarked ? "text-blue-400" : "text-gray-300"} fill={bookmarked ? "currentColor" : "none"} />
              <span className="text-xs text-gray-500">{bookmarksCount}</span>
            </button>
            <button
              onClick={sharePost}
              className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              aria-label="Share post"
            >
              <Share2 size={18} className="text-gray-300" />
            </button>
          </div>

          {/* Feed caption / description (IG-style collapsed by default) */}
          {description && (
            <div className="space-y-1">
              <p className={`text-sm text-gray-300 leading-relaxed ${!captionExpanded && hasLongDescription ? "line-clamp-3" : ""}`}>
                {description}
              </p>
              {hasLongDescription && !captionExpanded && (
                <button
                  onClick={() => setCaptionExpanded(true)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  more
                </button>
              )}
              {hasLongDescription && captionExpanded && (
                <button
                  onClick={() => setCaptionExpanded(false)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  less
                </button>
              )}
            </div>
          )}

          {/* Photo caption if different */}
          {photo.caption && photo.caption !== description && (
            <p className="text-xs text-gray-500 italic">{photo.caption}</p>
          )}

          {job.feedUpdatedAt && (
            <div className="flex items-center gap-1 text-[11px] text-gray-600">
              <Clock size={10} />
              {timeAgo(job.feedUpdatedAt)}
            </div>
          )}
        </div>
      </article>
    </>
  );
}
