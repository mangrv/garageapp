"use client";

import { useState } from "react";
import { BookOpen, Pencil, Check, X, RefreshCw, Sparkles } from "lucide-react";
import Glyph from "@/app/components/Glyph";

/** Lightweight markdown renderer — h2, h3, bullet lists, bold, paragraphs */
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (!listItems.length) return;
    elements.push(
      <ul key={key} className="list-disc list-inside space-y-1 my-2">
        {listItems.map((item, i) => (
          <li key={i} className="text-sm text-gray-300 leading-relaxed">
            <InlineText text={item} />
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("## ")) {
      flushList(`l${i}`);
      elements.push(<h2 key={i} className="text-sm font-bold text-white mt-5 mb-1.5 first:mt-0">{t.slice(3)}</h2>);
    } else if (t.startsWith("### ")) {
      flushList(`l${i}`);
      elements.push(<h3 key={i} className="text-xs font-bold text-gray-200 uppercase tracking-wide mt-4 mb-1">{t.slice(4)}</h3>);
    } else if (t.startsWith("- ") || t.startsWith("* ")) {
      listItems.push(t.slice(2));
    } else if (t === "") {
      flushList(`l${i}`);
    } else {
      flushList(`l${i}`);
      elements.push(<p key={i} className="text-sm text-gray-300 leading-relaxed my-2"><InlineText text={t} /></p>);
    }
  });
  flushList("lf");
  return <>{elements}</>;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="text-white font-semibold">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

interface Props {
  carId: string;
  carLabel: string;
  blurb: string | null;
  generatedAt: string | null;
  generating?: boolean;
  onSave: (blurb: string) => void;
}

export default function VehicleBlurbPanel({ carId, carLabel, blurb, generatedAt, generating, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(blurb ?? "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${carId}/blurb`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blurb: draft }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onSave(draft);
      setEditing(false);
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  // Not yet generated and not currently generating — quiet placeholder
  if (!blurb && !generating) return null;

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-amber-400 flex-shrink-0" />
          <div>
            <h2 className="font-bold text-sm text-white">Vehicle History</h2>
            {formattedDate && !editing && (
              <p className="text-[11px] text-gray-600 mt-0.5">AI overview · {formattedDate}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {generating && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <Sparkles size={12} className="animate-pulse" /> Writing…
            </span>
          )}
          {!generating && !editing && blurb && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors active:scale-95"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={cancelEdit}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <X size={15} />
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-on-accent hover:bg-amber-400 disabled:opacity-40 transition-colors active:scale-95"
              >
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-700/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Generating skeleton */}
      {generating && (
        <div className="px-4 py-6 space-y-3">
          {[80, 60, 90, 50, 70].map((w, i) => (
            <div key={i} className={`h-3 bg-gray-800 rounded animate-pulse`} style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {/* Edit mode */}
      {!generating && editing && (
        <div className="px-4 py-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={20}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-3 text-sm text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-amber-500/60 resize-y"
            placeholder="Write or paste your vehicle history here. Supports markdown (## headings, **bold**, - bullets)."
          />
          <p className="text-[11px] text-gray-600 mt-2">Supports markdown formatting</p>
        </div>
      )}

      {/* Read mode */}
      {!generating && !editing && blurb && (
        <div className="px-4 py-4">
          <SimpleMarkdown text={blurb} />
          <p className="text-[11px] text-gray-700 mt-4 border-t border-gray-800 pt-3">
            <Glyph e="✦" /> AI-generated overview about the {carLabel} model · verify critical specs independently.
          </p>
        </div>
      )}
    </section>
  );
}
