"use client";

import { useEffect, useState } from "react";
import { loadDraft, hasDraft, clearDraft, draftSummary } from "@/lib/guestDraft";

export default function GuestImportPrompt({ onDone }: { onDone: () => void }) {
  const [draft, setDraft] = useState<ReturnType<typeof loadDraft>>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [lang] = useState<"en" | "es">(() => {
    if (typeof document === "undefined") return "en";
    return (localStorage.getItem("garage-lang") as "en" | "es") ?? "en";
  });

  useEffect(() => {
    const d = loadDraft();
    if (d && hasDraft()) setDraft(d);
  }, []);

  if (!draft) return null;
  if (result) {
    return (
      <div className={`rounded-2xl p-4 text-sm text-center ${result.ok ? "bg-emerald-900/30 border border-emerald-700/40 text-emerald-300" : "bg-red-900/30 border border-red-700/40 text-red-300"}`}>
        {result.msg}
        <button onClick={onDone} className="block mt-3 mx-auto text-xs text-gray-400 underline">
          {lang === "es" ? "Continuar" : "Continue"}
        </button>
      </div>
    );
  }

  const txt = {
    title: lang === "es" ? "¿Importar tu borrador?" : "Import your guest draft?",
    desc: lang === "es" ? `Tienes datos de invitado: ${draftSummary(draft)}. ¿Deseas importarlos a tu cuenta?` : `You have guest data: ${draftSummary(draft)}. Import it into your account?`,
    yes: lang === "es" ? "Sí, importar" : "Yes, import",
    no: lang === "es" ? "No, descartar" : "No, discard",
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/guest/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (res.ok) {
        clearDraft();
        setResult({ ok: true, msg: lang === "es" ? `✅ Importado: ${draftSummary(draft)}` : `✅ Imported: ${draftSummary(draft)}` });
      } else {
        setResult({ ok: false, msg: data.error ?? (lang === "es" ? "Error al importar" : "Import failed") });
      }
    } catch {
      setResult({ ok: false, msg: lang === "es" ? "Error de red" : "Network error" });
    } finally {
      setImporting(false);
    }
  };

  const handleDiscard = () => {
    clearDraft();
    localStorage.removeItem("garage_guest_mode");
    onDone();
  };

  return (
    <div className="bg-amber-900/20 border border-amber-700/40 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold text-amber-400">🛠️ {txt.title}</p>
      <p className="text-xs text-gray-400">{txt.desc}</p>
      <div className="flex gap-2">
        <button onClick={handleImport} disabled={importing}
          className="flex-1 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm disabled:opacity-40">
          {importing ? "…" : txt.yes}
        </button>
        <button onClick={handleDiscard}
          className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm">
          {txt.no}
        </button>
      </div>
    </div>
  );
}
