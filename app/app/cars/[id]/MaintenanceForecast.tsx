"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/app/providers/AppProviders";
import { t } from "@/lib/i18n";

type ForecastItem = {
  id: string;
  name: string;
  category: string;
  interval: string;
  dueMileage: number | null;
  dueDate: string | null;
  estimatedCostDIY: number;
  estimatedCostShop: number;
  priority: "overdue" | "due-now" | "upcoming" | "ok";
  doneAt: string | null;
  doneMileage: number | null;
  notes: string;
};

type Phase = { id: string; title: string; emoji: string | null; sortOrder: number };
type Job = { id: string; title: string; phases: Phase[] };

type ActionPanel =
  | { itemId: string; type: "done"; date: string; mileage: string }
  | { itemId: string; type: "task"; jobId: string; phaseId: string; projects: Job[] | null; creatingNew: boolean; newProjectTitle: string };

const CATEGORY_ICONS: Record<string, string> = {
  Engine: "⚙️", Fluids: "🛢", Brakes: "🛑", Tires: "⬛",
  Electrical: "⚡", Suspension: "🔩", Filters: "🌀", "Belts & Hoses": "〰️",
};

const today = () => new Date().toISOString().slice(0, 10);

export default function MaintenanceForecast({
  carId,
  carName,
  carMileage,
}: {
  carId: string;
  carName: string;
  carMileage?: number | null;
}) {
  const { lang } = useApp();

  const PRIORITY_CONFIG = {
    overdue:  { label: t("overdue", lang),   color: "text-red-400",    bg: "bg-red-900/30 border-red-700/50",    icon: "🔴" },
    "due-now":{ label: t("dueNow", lang),    color: "text-amber-400",  bg: "bg-amber-900/30 border-amber-700/50",icon: "🟡" },
    upcoming: { label: t("upcoming", lang),  color: "text-sky-400",    bg: "bg-sky-900/20 border-sky-700/30",    icon: "🔵" },
    ok:       { label: t("ok", lang),        color: "text-emerald-400",bg: "bg-emerald-900/20 border-emerald-700/30", icon: "✅" },
  };

  const [items, setItems] = useState<ForecastItem[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<"all" | "action">("action");

  // Action panel state — one open at a time
  const [panel, setPanel] = useState<ActionPanel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // "added" tracking: itemId → projectTitle
  const [added, setAdded] = useState<Record<string, string>>({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cars/${carId}/forecast`)
      .then(r => r.json())
      .then(d => { if (d.items) { setItems(d.items); setGeneratedAt(d.generatedAt); } })
      .finally(() => setLoading(false));
  }, [carId]);

  const generate = async () => {
    setGenerating(true);
    setPanel(null);
    try {
      const res = await fetch(`/api/cars/${carId}/forecast`, { method: "POST" });
      const d = await res.json();
      if (d.items) { setItems(d.items); setGeneratedAt(d.generatedAt); }
    } finally {
      setGenerating(false);
    }
  };

  const openDonePanel = (itemId: string) => {
    setPanel(p =>
      p?.itemId === itemId && p.type === "done"
        ? null
        : { itemId, type: "done", date: today(), mileage: carMileage ? String(carMileage) : "" }
    );
  };

  const openTaskPanel = async (itemId: string) => {
    if (panel?.itemId === itemId && panel.type === "task") {
      setPanel(null);
      return;
    }
    // Open with loading state
    setPanel({ itemId, type: "task", jobId: "", phaseId: "", projects: null, creatingNew: false, newProjectTitle: "" });
    const res = await fetch(`/api/cars/${carId}/jobs`);
    const d = await res.json();
    const projects: Job[] = d.jobs ?? [];
    setPanel({ itemId, type: "task", jobId: projects[0]?.id ?? "", phaseId: projects[0]?.phases[0]?.id ?? "", projects, creatingNew: projects.length === 0, newProjectTitle: "" });
  };

  const submitDone = async (item: ForecastItem) => {
    if (panel?.type !== "done") return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cars/${carId}/forecast/log-done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forecastItemId: item.id,
          title: item.name,
          mileage: panel.mileage || null,
          serviceDate: panel.date,
        }),
      });
      const d = await res.json();
      if (d.items) setItems(d.items);
      setPanel(null);
    } finally {
      setSubmitting(false);
    }
  };

  const submitTask = async (item: ForecastItem) => {
    if (panel?.type !== "task") return;
    setSubmitting(true);
    try {
      let phaseId = panel.phaseId;
      let projectTitle = "";

      // If creating a new project, do that first
      if (panel.creatingNew) {
        if (!panel.newProjectTitle.trim()) return;
        const createRes = await fetch(`/api/cars/${carId}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: panel.newProjectTitle.trim() }),
        });
        const created = await createRes.json();
        if (!created.job) return;
        phaseId = created.job.phases[0]?.id ?? "";
        projectTitle = created.job.title;
      } else {
        projectTitle = panel.projects?.find(p => p.id === panel.jobId)?.title ?? "";
      }

      const body: Record<string, string | null> = { title: item.name, notes: item.notes ?? null };
      if (phaseId) {
        body.phaseId = phaseId;
      } else {
        // Job exists but has no phases — backend will auto-create a "To Do" phase
        body.jobId = panel.jobId;
      }

      const res = await fetch(`/api/cars/${carId}/forecast/add-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.ok) {
        setAdded(a => ({ ...a, [item.id]: projectTitle || d.projectTitle }));
        setPanel(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const displayed = items
    ? (filter === "action"
        ? items.filter(i => !i.doneAt && (i.priority === "overdue" || i.priority === "due-now" || i.priority === "upcoming"))
        : items)
    : [];

  const overdueCount = items?.filter(i => !i.doneAt && i.priority === "overdue").length ?? 0;
  const dueNowCount = items?.filter(i => !i.doneAt && i.priority === "due-now").length ?? 0;
  const upcomingCount = items?.filter(i => !i.doneAt && i.priority === "upcoming").length ?? 0;
  const actionCost = items
    ?.filter(i => i.priority !== "ok" && !i.doneAt)
    .reduce((s, i) => s + (i.estimatedCostDIY || 0), 0) ?? 0;

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500";
  const selectCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 font-bold text-base">
          <span>{t("maintenanceForecast", lang)}</span>
          {overdueCount > 0 && (
            <span className="text-xs bg-red-700 text-white px-2 py-0.5 rounded-full font-medium">{overdueCount} {t("overdue", lang).toLowerCase()}</span>
          )}
          <span className="text-gray-600 text-sm">{open ? "▲" : "▼"}</span>
        </button>
        <button
          onClick={generate}
          disabled={generating}
          className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-800 text-gray-300 border border-gray-700 disabled:opacity-40"
        >
          {generating ? t("generating", lang) : items ? t("regenerate", lang) : t("generate", lang)}
        </button>
      </div>

      {open && (
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-6 text-gray-600 text-sm">{t("loadingForecast", lang)}</div>
          )}

          {!loading && !items && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center space-y-3">
              <div className="text-3xl">🤖</div>
              <div className="text-sm text-gray-300 font-medium">AI Maintenance Forecast</div>
              <div className="text-xs text-gray-500 leading-relaxed">
                Claude will analyze your {carName}'s mileage, age, and service history to generate a personalized maintenance checklist — showing what's overdue, due now, and coming up.
              </div>
              <button
                onClick={generate}
                disabled={generating}
                className="w-full bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
              >
                {generating ? t("analyzing", lang) : t("generateForecast", lang)}
              </button>
            </div>
          )}

          {items && items.length > 0 && (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-red-400">{overdueCount}</div>
                  <div className="text-xs text-gray-500">{t("overdue", lang)}</div>
                </div>
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-amber-400">{dueNowCount}</div>
                  <div className="text-xs text-gray-500">{t("dueNow", lang)}</div>
                </div>
                <div className="bg-sky-900/20 border border-sky-700/30 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-bold text-sky-400">{upcomingCount}</div>
                  <div className="text-xs text-gray-500">{t("upcoming", lang)}</div>
                </div>
              </div>

              {actionCost > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{t("estCostDIY", lang)}</span>
                  <span className="text-sm font-bold text-amber-400">~${actionCost.toLocaleString()}</span>
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex gap-2">
                {(["action", "all"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${filter === f ? "bg-amber-500 text-gray-950" : "bg-gray-800 text-gray-400"}`}>
                    {f === "action" ? `${t("needsAttention", lang)} (${overdueCount + dueNowCount + upcomingCount})` : `${t("all", lang)} (${items.length})`}
                  </button>
                ))}
              </div>

              {/* Items list */}
              <div className="space-y-2">
                {displayed.map(item => {
                  const cfg = PRIORITY_CONFIG[item.priority];
                  const catIcon = CATEGORY_ICONS[item.category] ?? "🔧";
                  const isDone = !!item.doneAt;
                  const isAddedToJob = !!added[item.id];
                  const panelOpen = panel?.itemId === item.id;

                  return (
                    <div key={item.id} className={`border rounded-xl overflow-hidden ${isDone ? "bg-gray-900/40 border-gray-800 opacity-60" : cfg.bg}`}>
                      {/* Main item row */}
                      <div className="p-3">
                        <div className="flex items-start gap-2">
                          <span className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${isDone ? "line-through text-gray-500" : "text-white"}`}>{item.name}</span>
                              <span className="text-xs text-gray-600">{catIcon} {item.category}</span>
                              {isDone && <span className="text-xs text-emerald-500">✓ {t("done", lang)} {item.doneAt}</span>}
                              {isAddedToJob && !isDone && (
                                <span className="text-xs text-sky-400">{t("addedTo", lang)} {added[item.id]}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                              <span>🔁 {item.interval}</span>
                              {item.dueMileage && <span>📍 {t("dueAt", lang)} {item.dueMileage.toLocaleString()} mi</span>}
                              {item.dueDate && <span>📅 {t("dueDate", lang)} {item.dueDate}</span>}
                            </div>
                            {item.notes && (
                              <div className="mt-1.5 text-xs text-gray-500 leading-relaxed">{item.notes}</div>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-xs text-gray-400 font-mono">${item.estimatedCostDIY} {t("diyLabel", lang)}</div>
                            <div className="text-xs text-gray-600 font-mono">${item.estimatedCostShop} {t("shopLabel", lang)}</div>
                          </div>
                        </div>

                        {/* Action buttons — only for undone items */}
                        {!isDone && (
                          <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-white/5">
                            <button
                              onClick={() => openTaskPanel(item.id)}
                              className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-colors ${
                                panelOpen && panel?.type === "task"
                                  ? "bg-sky-600 border-sky-500 text-white"
                                  : "bg-gray-800/80 border-gray-700 text-gray-300 hover:border-sky-600 hover:text-sky-300"
                              }`}
                            >
                              {t("addToJob", lang)}
                            </button>
                            <button
                              onClick={() => openDonePanel(item.id)}
                              className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-colors ${
                                panelOpen && panel?.type === "done"
                                  ? "bg-emerald-600 border-emerald-500 text-white"
                                  : "bg-gray-800/80 border-gray-700 text-gray-300 hover:border-emerald-600 hover:text-emerald-300"
                              }`}
                            >
                              {t("logAsDone", lang)}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Inline panel: Log as done */}
                      {panelOpen && panel?.type === "done" && (
                        <div className="px-3 pb-3 bg-gray-900/60 border-t border-white/5 space-y-2">
                          <p className="text-xs text-gray-500 pt-2 font-medium">{t("logServiceRecord", lang)}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-600 mb-1 block">{t("date", lang)}</label>
                              <input
                                type="date"
                                className={inputCls}
                                value={panel.date}
                                onChange={e => setPanel(p => p && p.type === "done" ? { ...p, date: e.target.value } : p)}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 mb-1 block">{t("mileage", lang)}</label>
                              <input
                                type="number"
                                className={inputCls}
                                placeholder={carMileage ? String(carMileage) : "e.g. 85000"}
                                value={panel.mileage}
                                onChange={e => setPanel(p => p && p.type === "done" ? { ...p, mileage: e.target.value } : p)}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => submitDone(item)}
                              disabled={submitting || !panel.date}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg font-medium disabled:opacity-40"
                            >
                              {submitting ? t("saving", lang) : t("saveRecord", lang)}
                            </button>
                            <button
                              onClick={() => setPanel(null)}
                              className="px-4 bg-gray-800 text-gray-400 text-xs py-2 rounded-lg"
                            >
                              {t("cancel", lang)}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline panel: Add to project */}
                      {panelOpen && panel?.type === "task" && (
                        <div className="px-3 pb-3 bg-gray-900/60 border-t border-white/5 space-y-2">
                          <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-gray-500 font-medium">{t("addToJobTitle", lang)}</p>
                            {/* Toggle: existing vs new — only show toggle if there are existing projects */}
                            {panel.projects !== null && panel.projects.length > 0 && (
                              <button
                                onClick={() => setPanel(p => p && p.type === "task" ? { ...p, creatingNew: !p.creatingNew, newProjectTitle: "" } : p)}
                                className="text-xs text-sky-400 hover:text-sky-300 underline"
                              >
                                {panel.creatingNew ? t("pickExisting", lang) : t("newJobLabel", lang)}
                              </button>
                            )}
                          </div>

                          {panel.projects === null && (
                            <p className="text-xs text-gray-600 py-1">{t("loading", lang)}</p>
                          )}

                          {/* Create new project form */}
                          {panel.projects !== null && panel.creatingNew && (
                            <>
                              <div>
                                <label className="text-xs text-gray-600 mb-1 block">{t("projectName", lang)}</label>
                                <input
                                  type="text"
                                  autoFocus
                                  className={inputCls}
                                  placeholder={`e.g. Brake Service — ${carName}`}
                                  value={panel.newProjectTitle}
                                  onChange={e => setPanel(p => p && p.type === "task" ? { ...p, newProjectTitle: e.target.value } : p)}
                                  onKeyDown={e => { if (e.key === "Enter") submitTask(item); }}
                                />
                              </div>
                              <p className="text-xs text-gray-600">{t("defaultPhaseNote", lang)}</p>
                            </>
                          )}

                          {/* Pick existing project */}
                          {panel.projects !== null && !panel.creatingNew && panel.projects.length > 0 && (() => {
                            const selectedJob = panel.projects!.find(p => p.id === panel.jobId) ?? panel.projects![0];
                            return (
                              <>
                                <div>
                                  <label className="text-xs text-gray-600 mb-1 block">{t("project", lang)}</label>
                                  <select
                                    className={selectCls}
                                    value={panel.jobId}
                                    onChange={e => {
                                      const proj = panel.projects!.find(p => p.id === e.target.value);
                                      setPanel(p => p && p.type === "task"
                                        ? { ...p, jobId: e.target.value, phaseId: proj?.phases[0]?.id ?? "" }
                                        : p
                                      );
                                    }}
                                  >
                                    {panel.projects!.map(p => (
                                      <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                  </select>
                                </div>
                                {selectedJob.phases.length > 0 && (
                                  <div>
                                    <label className="text-xs text-gray-600 mb-1 block">{t("phase", lang)}</label>
                                    <select
                                      className={selectCls}
                                      value={panel.phaseId}
                                      onChange={e => setPanel(p => p && p.type === "task" ? { ...p, phaseId: e.target.value } : p)}
                                    >
                                      {selectedJob.phases.map(ph => (
                                        <option key={ph.id} value={ph.id}>
                                          {ph.emoji ? `${ph.emoji} ` : ""}{ph.title}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                {selectedJob.phases.length === 0 && (
                                  <p className="text-xs text-gray-500">No phases yet — a "To Do" phase will be created automatically.</p>
                                )}
                              </>
                            );
                          })()}

                          {/* Confirm / cancel */}
                          {panel.projects !== null && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => submitTask(item)}
                                disabled={
                                  submitting ||
                                  (panel.creatingNew ? !panel.newProjectTitle.trim() : !panel.jobId)
                                }
                                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs py-2 rounded-lg font-medium disabled:opacity-40"
                              >
                                {submitting
                                  ? (panel.creatingNew ? t("creating", lang) : t("adding", lang))
                                  : (panel.creatingNew ? t("createAndAdd", lang) : t("addTask", lang))}
                              </button>
                              <button
                                onClick={() => setPanel(null)}
                                className="px-4 bg-gray-800 text-gray-400 text-xs py-2 rounded-lg"
                              >
                                {t("cancel", lang)}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {generatedAt && (
                <div className="text-xs text-gray-700 text-center">
                  {t("generatedOn", lang)} {new Date(generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" · "}
                  <button onClick={generate} disabled={generating} className="text-gray-600 underline disabled:opacity-40">
                    {t("regenerate", lang)}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
