"use client";

import { useState, useTransition } from "react";
import { useApp } from "@/app/providers/AppProviders";
import { CheckCircle2, Circle, RefreshCw, ChevronDown, ChevronRight, AlertCircle, Clock, Cpu, Droplets, Zap, CircleDot, Filter, Thermometer, Eye, Battery, Wrench } from "lucide-react";

type Item = {
  id: string;
  task: string;
  category: string;
  notes: string | null;
  intervalMiles: number | null;
  intervalMonths: number | null;
  lastDoneMiles: number | null;
  lastDoneDate: string | null;
  isCustom: boolean;
  sortOrder: number;
};

type StatusType = "overdue" | "due-soon" | "ok" | "not-done";

function getStatus(item: Item, currentMileage: number | null): StatusType {
  const hasBeenDone = item.lastDoneMiles || item.lastDoneDate;
  if (!hasBeenDone) return "not-done";

  let milesStatus: StatusType = "ok";
  let timeStatus: StatusType = "ok";

  // Mileage check
  if (item.intervalMiles && currentMileage && item.lastDoneMiles) {
    const nextDue = item.lastDoneMiles + item.intervalMiles;
    const diff = nextDue - currentMileage;
    if (diff < 0) milesStatus = "overdue";
    else if (diff <= 1500) milesStatus = "due-soon";
  }

  // Time check
  if (item.intervalMonths && item.lastDoneDate) {
    const lastDate = new Date(item.lastDoneDate);
    const nextDueDate = new Date(lastDate);
    nextDueDate.setMonth(nextDueDate.getMonth() + item.intervalMonths);
    const now = new Date();
    const daysLeft = Math.floor((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) timeStatus = "overdue";
    else if (daysLeft <= 30) timeStatus = "due-soon";
  }

  // Return the worse of the two (overdue > due-soon > ok)
  if (milesStatus === "overdue" || timeStatus === "overdue") return "overdue";
  if (milesStatus === "due-soon" || timeStatus === "due-soon") return "due-soon";
  return "ok";
}

function nextDueMiles(item: Item): number | null {
  if (!item.intervalMiles || !item.lastDoneMiles) return null;
  return item.lastDoneMiles + item.intervalMiles;
}

function nextDueDate(item: Item): Date | null {
  if (!item.intervalMonths || !item.lastDoneDate) return null;
  const d = new Date(item.lastDoneDate);
  d.setMonth(d.getMonth() + item.intervalMonths);
  return d;
}

const STATUS_CONFIG = {
  overdue:  { color: "text-red-400",    bg: "bg-red-900/20 border-red-800/40",    icon: AlertCircle,   label: "Overdue",   labelEs: "Atrasado" },
  "due-soon": { color: "text-amber-400", bg: "bg-amber-900/20 border-amber-800/40", icon: Clock,         label: "Due soon",  labelEs: "Pronto" },
  ok:       { color: "text-emerald-400", bg: "bg-gray-900 border-gray-800",         icon: CheckCircle2,  label: "OK",        labelEs: "OK" },
  "not-done":{ color: "text-gray-500",  bg: "bg-gray-900 border-gray-800",          icon: Circle,        label: "Not logged",labelEs: "No registrado" },
};

const CATEGORY_ICON: Record<string, any> = {
  engine: Cpu, brakes: CircleDot, fluids: Droplets, tires: CircleDot,
  electrical: Zap, filters: Filter, cooling: Thermometer, inspection: Eye, general: Wrench,
};

const CATEGORY_LABEL: Record<string, [string, string]> = {
  engine:     ["Engine",      "Motor"],
  brakes:     ["Brakes",      "Frenos"],
  fluids:     ["Fluids",      "Fluidos"],
  tires:      ["Tires",       "Neumáticos"],
  electrical: ["Electrical",  "Eléctrico"],
  filters:    ["Filters",     "Filtros"],
  cooling:    ["Cooling",     "Enfriamiento"],
  inspection: ["Inspection",  "Inspección"],
  general:    ["General",     "General"],
};

function intervalLabel(item: Item, es: boolean): string {
  const parts: string[] = [];
  if (item.intervalMiles) parts.push(`${item.intervalMiles.toLocaleString()} ${es ? "mi" : "mi"}`);
  if (item.intervalMonths) parts.push(`${item.intervalMonths} ${es ? "meses" : "mo"}`);
  if (parts.length === 0) return es ? "Revisión periódica" : "Periodic check";
  return (es ? "Cada " : "Every ") + parts.join(` ${es ? "o" : "or"} `);
}

function groupByInterval(items: Item[]): { label: string; labelEs: string; miles: number | null; items: Item[] }[] {
  const map = new Map<string, { label: string; labelEs: string; miles: number | null; items: Item[] }>();

  for (const item of items) {
    const mi = item.intervalMiles;
    const mo = item.intervalMonths;
    let key: string;
    let label: string;
    let labelEs: string;

    if (!mi && !mo) {
      key = "periodic";
      label = "Periodic Checks";
      labelEs = "Revisiones Periódicas";
    } else if (mi && mi <= 250) {
      key = "250";
      label = "Weekly / Every 250 mi";
      labelEs = "Semanal / Cada 250 mi";
    } else if (mi) {
      const k = mi.toLocaleString();
      key = String(mi);
      const moStr = mo ? ` or ${mo} mo` : "";
      label = `Every ${k} mi${moStr}`;
      labelEs = `Cada ${k} mi${mo ? ` o ${mo} meses` : ""}`;
    } else {
      key = `mo_${mo}`;
      label = `Every ${mo} months`;
      labelEs = `Cada ${mo} meses`;
    }

    if (!map.has(key)) map.set(key, { label, labelEs, miles: mi ?? null, items: [] });
    map.get(key)!.items.push(item);
  }

  return Array.from(map.values()).sort((a, b) => (a.miles ?? 999999) - (b.miles ?? 999999));
}

function DoneModal({
  item, carMileage, onSave, onClose, es,
}: {
  item: Item; carMileage: number | null; onSave: (miles: number | null, date: string, createRecord: boolean) => void; onClose: () => void; es: boolean;
}) {
  const [miles, setMiles] = useState(carMileage ? String(carMileage) : "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [createRecord, setCreateRecord] = useState(true);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-3xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-bold text-white text-base">{es ? "Marcar como hecho" : "Mark as Done"}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{item.task}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">{es ? "Millaje actual" : "Current mileage"}</label>
            <input
              type="number"
              value={miles}
              onChange={e => setMiles(e.target.value)}
              placeholder={es ? "ej. 87500" : "e.g. 87500"}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">{es ? "Fecha" : "Date"}</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={createRecord}
            onChange={e => setCreateRecord(e.target.checked)}
            className="w-4 h-4 rounded accent-amber-500"
          />
          <span className="text-sm text-gray-300">{es ? "Crear registro de servicio" : "Create service record"}</span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={() => onSave(miles ? parseInt(miles) : null, date, createRecord)}
            className="flex-1 bg-amber-500 text-gray-950 font-bold py-3 rounded-xl text-sm"
          >
            {es ? "Guardar" : "Save"}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-800 text-gray-300 py-3 rounded-xl text-sm">
            {es ? "Cancelar" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScheduleClient({
  carId, carName, currentMileage, initialItems,
}: {
  carId: string; carName: string; currentMileage: number | null; initialItems: Item[];
}) {
  const { lang } = useApp();
  const es = lang === "es";
  const [items, setItems] = useState<Item[]>(initialItems);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneModal, setDoneModal] = useState<Item | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${carId}/schedule`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setGenerating(false);
    }
  };

  const markDone = async (item: Item, miles: number | null, date: string, createRecord: boolean) => {
    setDoneModal(null);
    startTransition(async () => {
      const res = await fetch(`/api/cars/${carId}/schedule/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastDoneMiles: miles, lastDoneDate: date, createServiceRecord: createRecord }),
      });
      const data = await res.json();
      if (res.ok) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, lastDoneMiles: data.item.lastDoneMiles, lastDoneDate: data.item.lastDoneDate } : i));
      }
    });
  };

  const groups = groupByInterval(items);

  // Summary stats
  const overdueCount = items.filter(i => getStatus(i, currentMileage) === "overdue").length;
  const dueSoonCount = items.filter(i => getStatus(i, currentMileage) === "due-soon").length;
  const doneCount = items.filter(i => i.lastDoneMiles || i.lastDoneDate).length;

  const toggleGroup = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Wrench size={18} className="text-gray-400" />
            {es ? "Programa de Mantenimiento" : "Maintenance Schedule"}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{carName}{currentMileage ? ` · ${currentMileage.toLocaleString()} mi` : ""}</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-gray-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={generating ? "animate-spin" : ""} />
          {generating ? (es ? "Generando…" : "Generating…") : items.length > 0 ? (es ? "Regenerar" : "Regenerate") : (es ? "Generar con IA" : "Generate")}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>}

      {/* Summary pills */}
      {items.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {overdueCount > 0 && (
            <span className="text-xs bg-red-900/30 border border-red-800/50 text-red-400 px-3 py-1 rounded-full font-semibold">
              🔴 {overdueCount} {es ? "atrasado(s)" : "overdue"}
            </span>
          )}
          {dueSoonCount > 0 && (
            <span className="text-xs bg-amber-900/30 border border-amber-800/50 text-amber-400 px-3 py-1 rounded-full font-semibold">
              🟡 {dueSoonCount} {es ? "próximo(s)" : "due soon"}
            </span>
          )}
          <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
            ✅ {doneCount}/{items.length} {es ? "registrados" : "logged"}
          </span>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !generating && (
        <div className="text-center py-16 space-y-4">
          <Wrench size={48} className="mx-auto text-gray-700" />
          <div>
            <p className="text-sm text-gray-400 font-medium">{es ? "Sin programa de mantenimiento" : "No schedule yet"}</p>
            <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto">
              {es
                ? `Genera el programa de fábrica completo para tu ${carName} — millajes, intervalos y especificaciones.`
                : `Generate the complete factory schedule for your ${carName} — mileage intervals, service items, and specs.`}
            </p>
          </div>
          <button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-gray-950 font-bold text-sm disabled:opacity-50">
            <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
            {es ? "Generar con IA" : "Generate with AI"}
          </button>
          <p className="text-xs text-gray-700">{es ? "Generado por IA — verifica con tu manual" : "AI-generated — verify with your owner's manual"}</p>
        </div>
      )}

      {/* Skeleton */}
      {generating && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-1/3" />
              {[1, 2, 3].map(j => <div key={j} className="h-3 bg-gray-800 rounded w-full" />)}
            </div>
          ))}
        </div>
      )}

      {/* Schedule groups */}
      {!generating && groups.map(group => {
        const key = group.label;
        const isOpen = !collapsed.has(key);
        const groupOverdue = group.items.filter(i => getStatus(i, currentMileage) === "overdue").length;
        const groupDueSoon = group.items.filter(i => getStatus(i, currentMileage) === "due-soon").length;

        return (
          <div key={key} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{es ? group.labelEs : group.label}</span>
                {groupOverdue > 0 && <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">{groupOverdue} 🔴</span>}
                {groupDueSoon > 0 && <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded-full">{groupDueSoon} 🟡</span>}
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="text-xs">{group.items.length} {es ? "ítems" : "items"}</span>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            </button>

            {/* Items */}
            {isOpen && (
              <div className="border-t border-gray-800 divide-y divide-gray-800">
                {group.items.map(item => {
                  const status = getStatus(item, currentMileage);
                  const sc = STATUS_CONFIG[status];
                  const StatusIcon = sc.icon;
                  const CatIcon = CATEGORY_ICON[item.category] ?? Wrench;
                  const nextMi = nextDueMiles(item);
                  const nextDt = nextDueDate(item);
                  const catLabel = CATEGORY_LABEL[item.category] ?? ["General", "General"];

                  return (
                    <div key={item.id} className={`px-4 py-3 flex items-start gap-3 ${status === "overdue" ? "bg-red-950/10" : status === "due-soon" ? "bg-amber-950/10" : ""}`}>
                      {/* Status icon */}
                      <StatusIcon size={15} className={`flex-shrink-0 mt-0.5 ${sc.color}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-white">{item.task}</span>
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <CatIcon size={9} />{es ? catLabel[1] : catLabel[0]}
                          </span>
                        </div>

                        {item.notes && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.notes}</p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-600">
                          {/* Last done */}
                          {(item.lastDoneMiles || item.lastDoneDate) && (
                            <span>
                              ✔ {es ? "Último" : "Last"}: {item.lastDoneMiles ? `${item.lastDoneMiles.toLocaleString()} mi` : ""}{item.lastDoneMiles && item.lastDoneDate ? " · " : ""}{item.lastDoneDate ? new Date(item.lastDoneDate).toLocaleDateString(es ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                            </span>
                          )}
                          {/* Next due by mileage */}
                          {nextMi && currentMileage && (
                            <span className={status === "overdue" ? "text-red-400" : status === "due-soon" ? "text-amber-400" : ""}>
                              📍 {es ? "Próximo" : "Next"}: {nextMi.toLocaleString()} mi
                              {status === "overdue" && <span className="ml-1">({(currentMileage - nextMi).toLocaleString()} mi {es ? "atrasado" : "overdue"})</span>}
                              {status === "due-soon" && <span className="ml-1">({(nextMi - currentMileage).toLocaleString()} mi {es ? "restantes" : "to go"})</span>}
                            </span>
                          )}
                          {/* Next due by date */}
                          {nextDt && (() => {
                            const daysLeft = Math.floor((nextDt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const dateStr = nextDt.toLocaleDateString(es ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" });
                            const isDateOverdue = daysLeft < 0;
                            const isDateSoon = daysLeft >= 0 && daysLeft <= 30;
                            return (
                              <span className={isDateOverdue ? "text-red-400" : isDateSoon ? "text-amber-400" : ""}>
                                📅 {dateStr}
                                {isDateOverdue && <span className="ml-1">({Math.abs(daysLeft)}d {es ? "atrasado" : "overdue"})</span>}
                                {isDateSoon && <span className="ml-1">({daysLeft}d {es ? "restantes" : "left"})</span>}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Mark done button */}
                      <button
                        onClick={() => setDoneModal(item)}
                        disabled={pending}
                        className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                          status === "overdue" ? "bg-red-900/40 text-red-300 hover:bg-red-900/60" :
                          status === "due-soon" ? "bg-amber-900/40 text-amber-300 hover:bg-amber-900/60" :
                          "bg-gray-800 text-gray-400 hover:text-gray-300"
                        }`}
                      >
                        {es ? "Hecho" : "Done"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {items.length > 0 && !generating && (
        <p className="text-xs text-gray-700 text-center">{es ? "Generado por IA — verifica con tu manual del propietario" : "AI-generated — verify with your owner's manual"}</p>
      )}

      {/* Done modal */}
      {doneModal && (
        <DoneModal
          item={doneModal}
          carMileage={currentMileage}
          onSave={(miles, date, createRecord) => markDone(doneModal, miles, date, createRecord)}
          onClose={() => setDoneModal(null)}
          es={es}
        />
      )}
    </div>
  );
}
