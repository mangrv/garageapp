"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useT } from "@/app/hooks/useT";
import { useApp } from "@/app/providers/AppProviders";
import { addMileageLog, deleteMileageLog, updateMileageLog } from "./actions";

export type MileageLog = {
  id: string; mileage: number; recordedAt: string; source: string; notes: string | null; sourceName?: string | null; sourceId?: string | null;
};

export default function MileageSection({ carId, logs, currentMileage, assetType }: { carId: string; logs: MileageLog[]; currentMileage: number | null; assetType: string }) {
  const t = useT();
  const { lang } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  // Use local calendar date (not UTC) so it matches what the user sees on their device
  const [recordedAt, setRecordedAt] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [pending, startTransition] = useTransition();

  const lastLogged = logs[0]?.mileage ?? currentMileage ?? null;
  const enteredNum = parseInt(mileage);
  const isLower = !isNaN(enteredNum) && lastLogged !== null && enteredNum < lastLogged;

  const handleAdd = () => {
    if (!mileage || isNaN(enteredNum)) return;
    startTransition(async () => {
      await addMileageLog(carId, enteredNum, notes, recordedAt);
      setMileage(""); setNotes(""); setShowAdd(false);
    });
  };

  const displayedLogs = showAll ? logs : logs.slice(0, 5);
  const sourceLabel: Record<string, string> = {
    manual: lang === "es" ? "Manual" : "Manual",
    service: lang === "es" ? "🛠 Servicio" : "🛠 Service",
    project: lang === "es" ? "🔧 Trabajo" : "🔧 Job",
  };

  const readingLabel = assetType === "vehicle" ? (lang === "es" ? "Millaje" : "Mileage") : (lang === "es" ? "Uso" : "Usage");
  const readingUnit = assetType === "vehicle" ? "mi" : "hrs/mi";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-base">📍 {readingLabel} {lang === "es" ? "Historial" : "History"}</h2>
        <button
          onClick={() => setShowAdd((o) => !o)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${showAdd ? "bg-amber-500 text-gray-950" : "bg-gray-800 text-gray-300"}`}
        >
          {showAdd ? (lang === "es" ? "✕ Cancelar" : "✕ Cancel") : (lang === "es" ? `+ Registrar ${readingLabel.toLowerCase()}` : `+ Log ${readingLabel.toLowerCase()}`)}
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-900 border border-amber-600 rounded-2xl p-4 space-y-3 mb-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{readingLabel} *</label>
              <input
                type="number"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                placeholder={lastLogged ? `${lang === "es" ? "Último" : "Last"}: ${lastLogged.toLocaleString()} ${readingUnit}` : "e.g. 87500"}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600"
                autoFocus
              />
              {isLower && (
                <p className="text-xs text-red-400 mt-1">{lang === "es" ? `⚠️ Menor que el último registro (${lastLogged?.toLocaleString()} mi) — ¿confirmar?` : `⚠️ Lower than last recorded (${lastLogged?.toLocaleString()} mi) — double check?`}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{lang === "es" ? "Fecha" : "Date"}</label>
              <input
                type="date"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{lang === "es" ? "Notas (opcional)" : "Notes (optional)"}</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === "es" ? "ej. Después de viaje, post-servicio…" : "e.g. After road trip, post-service…"}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={pending || !mileage}
            className="w-full bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
          >
            {pending ? (lang === "es" ? "Guardando…" : "Saving…") : (lang === "es" ? `Registrar ${readingLabel}` : `Log ${readingLabel}`)}
          </button>
        </div>
      )}

      {logs.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-3">{lang === "es" ? "Sin registros de millaje aún." : "No mileage logs yet."}</p>
      ) : (
        <div className="space-y-2">
          {displayedLogs.map((log) => (
            <MileageLogRow
              key={log.id}
              log={log}
              carId={carId}
              readingUnit={readingUnit}
              lang={lang}
              sourceLabel={sourceLabel}
              pending={pending}
              startTransition={startTransition}
            />
          ))}
          {logs.length > 5 && (
            <button onClick={() => setShowAll((o) => !o)} className="w-full text-xs text-gray-500 py-2 active:text-gray-300">
              {showAll ? (lang === "es" ? "Mostrar menos ▲" : "Show less ▲") : (lang === "es" ? `Mostrar ${logs.length} registros ▼` : `Show all ${logs.length} entries ▼`)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function MileageLogRow({ log, carId, readingUnit, lang, sourceLabel, pending, startTransition }: {
  log: MileageLog;
  carId: string;
  readingUnit: string;
  lang: string;
  sourceLabel: Record<string, string>;
  pending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [mileage, setMileage] = useState(String(log.mileage));
  const [date, setDate] = useState(new Date(log.recordedAt).toISOString().slice(0, 10));
  const [notes, setNotes] = useState(log.notes ?? "");

  const save = () => {
    const m = parseInt(mileage);
    if (!mileage || isNaN(m)) return;
    startTransition(async () => {
      await updateMileageLog(log.id, carId, m, date, notes);
      setEditing(false);
    });
  };

  const cancel = () => {
    setMileage(String(log.mileage));
    setDate(new Date(log.recordedAt).toISOString().slice(0, 10));
    setNotes(log.notes ?? "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-gray-900 border border-amber-600/60 rounded-xl px-3 py-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">{readingUnit === "mi" ? "Mileage" : "Usage"} *</label>
            <input
              type="number"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-1">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-sm text-white placeholder-gray-600"
            placeholder="Optional note…"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={pending}
            className="flex-1 bg-amber-500 text-gray-950 font-bold py-2 rounded-lg text-sm disabled:opacity-40"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={cancel}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-white">{log.mileage.toLocaleString()} {readingUnit}</div>
        <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-0.5">
          <span>📅 {new Date(log.recordedAt).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</span>
          {log.sourceId && (log.source === "service" || log.source === "job") ? (
            <Link
              href={`/cars/${carId}/service-history/${log.sourceId}`}
              className="text-amber-400 hover:text-amber-300 active:text-amber-200 transition-colors"
            >
              {sourceLabel[log.source] ?? log.source}{log.sourceName ? ` · ${log.sourceName}` : ""}
            </Link>
          ) : (
            <span>{sourceLabel[log.source] ?? log.source}{log.sourceName ? ` · ${log.sourceName}` : ""}</span>
          )}
          {log.notes && <span>· {log.notes}</span>}
        </div>
      </div>
      {log.source === "manual" && (
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-gray-500 hover:text-gray-300 px-1.5 py-1 rounded transition-colors"
            title="Edit"
          >✏️</button>
          <button
            onClick={() => startTransition(async () => { await deleteMileageLog(log.id, carId); })}
            disabled={pending}
            className="text-gray-600 text-sm active:text-red-400 px-1 disabled:opacity-40"
          >🗑</button>
        </div>
      )}
    </div>
  );
}
