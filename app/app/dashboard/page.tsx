import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import SearchBarHome from "../SearchBarHome";

import { getSession } from "@/lib/session";
import { T } from "@/app/components/T";
import { DT } from "@/app/components/DT";
import GuestImportBridge from "../components/GuestImportBridge";

const ASSET_TYPES = [
  { type: "vehicle", label: "Cars", singular: "car", emoji: "🚗" },
  { type: "bicycle", label: "Bicycles", singular: "bicycle", emoji: "🚲" },
  { type: "riding_mower", label: "Riding Mowers", singular: "riding mower", emoji: "🚜" },
  { type: "trailer", label: "Trailers", singular: "trailer", emoji: "🚚" },
  { type: "equipment", label: "Equipment", singular: "equipment", emoji: "🧰" },
] as const;

function carEmoji(make: string, assetType = "vehicle") {
  if (assetType === "trailer") return "🚚";
  if (assetType === "riding_mower") return "🚜";
  if (assetType === "equipment") return "🧰";
  if (assetType === "bicycle") return "🚲";
  if (make.toLowerCase() === "ford") return "🐎";
  if (make.toLowerCase() === "jeep") return "🚙";
  if (make.toLowerCase() === "chevy" || make.toLowerCase() === "chevrolet") return "🏁";
  if (make.toLowerCase() === "dodge") return "🐏";
  if (make.toLowerCase() === "toyota") return "🟦";
  if (make.toLowerCase() === "honda") return "🔵";
  return "🚗";
}

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function SummaryCard({ href, emoji, label, value, sub }: { href?: string; emoji: string; label: string; value: string; sub: string }) {
  const content = (
    <div className="h-full rounded-2xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-amber-500/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        </div>
        <span className="text-2xl">{emoji}</span>
      </div>
      <p className="mt-3 text-xs text-gray-500">{sub}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ filter?: string; view?: string; type?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  const { filter, view, type } = await searchParams;
  // Home page always shows active jobs — completed/archived viewed per-car
  const statusFilter = { in: ["todo", "up_next", "active", "in_progress", "blocked", "testing"] };
  const currentFilter = "active";
  const currentView = view === "list" ? "list" : "grid";
  const viewBase = "/dashboard";

  const cars = await (prisma.car as any).findMany({
    where: { userId: session.userId },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      photos: true,
      jobs: {
        where: statusFilter ? { status: statusFilter } : { status: { not: "archived" } },
        orderBy: { createdAt: "desc" },
        include: {
          phases: { include: { tasks: true } },
        },
      },
      serviceRecords: {
        orderBy: { serviceDate: "desc" },
        take: 1,
      },
    },
  });



  const activeType = ASSET_TYPES.some((a) => a.type === type) ? type : "";
  const filteredCars = activeType
    ? cars.filter((c: any) => ((c as any).assetType || "vehicle") === activeType)
    : cars;
  const assetGroups = ASSET_TYPES
    .map((asset) => {
      const items = cars.filter((c: any) => ((c as any).assetType || "vehicle") === asset.type);
      return {
        ...asset,
        count: items.length,
        activeJobs: items.reduce((s: number, c: any) => s + c.jobs.length, 0),
      };
    })
    .filter((asset) => asset.count > 0);
  const selectedAsset = ASSET_TYPES.find((a) => a.type === activeType);
  const totalJobs = cars.reduce((s: number, c: any) => s + c.jobs.length, 0);
  const filteredJobs = filteredCars.reduce((s: number, c: any) => s + c.jobs.length, 0);
  const assetSummary = cars.length + " " + (cars.length === 1 ? "asset" : "assets");
  const [inboxCount, warrantyAlerts, receiptTotals] = await Promise.all([
    prisma.receipt.count({ where: { userId: session.userId, status: "inbox" } }),
    prisma.receiptLineItem.findMany({
      where: {
        receipt: { userId: session.userId, serviceRecord: { isNot: null } },
        warrantyEnd: { not: null, gt: new Date() },
      },
      orderBy: { warrantyEnd: "asc" },
      take: 8,
      select: {
        id: true,
        name: true,
        warrantyEnd: true,
        warrantyProvider: true,
        receipt: { select: { serviceRecord: { select: { car: { select: { id: true, year: true, make: true, model: true } } } } } },
      },
    }),
    prisma.receipt.aggregate({
      where: { userId: session.userId },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
  ]);
  const totalReceiptCost = receiptTotals._sum.totalAmount ?? 0;

  return (
    <div className="min-h-screen pb-24 w-full max-w-full overflow-x-hidden" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur border-b border-sidebar-border px-3 sm:px-4 py-3 space-y-3" style={{ background: "var(--sidebar-bg)" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--sidebar-text)" }}>{selectedAsset ? selectedAsset.label : "Garage Overview"}</p>
            <p className="text-xs" style={{ color: "var(--sidebar-muted)" }}>
              <Link href="/dashboard?view=list" className="underline-offset-2 hover:underline">{assetSummary}</Link>
              {" · "}{activeType ? filteredJobs : totalJobs} active jobs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden border border-sidebar-border">
              <Link href={activeType ? "/dashboard?view=list&type=" + activeType : "/dashboard?view=list"} className={`px-3 py-1.5 text-xs font-medium transition-colors ${currentView === "list" ? "bg-amber-500 text-[#ffffff]" : ""}`} style={currentView !== "list" ? { color: "var(--sidebar-muted)" } : {}}>List</Link>
              <Link href="/dashboard" className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-sidebar-border ${currentView === "grid" ? "bg-amber-500 text-[#ffffff]" : ""}`} style={currentView !== "grid" ? { color: "var(--sidebar-muted)" } : {}}>Grid</Link>
            </div>
            <Link
              href="/cars/new"
              className="flex-shrink-0 h-9 px-4 inline-flex items-center justify-center bg-amber-500 text-[#ffffff] font-bold rounded-xl text-sm active:scale-95 transition-transform whitespace-nowrap gap-1.5"
            >
              <span>+</span><span className="hidden sm:inline"><T k="addCar" /></span>
            </Link>
          </div>
        </div>
        <SearchBarHome />
      </header>

      <GuestImportBridge />

      <main className={`px-4 pt-6 ${currentView === "grid" ? "grid grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-6"}`}>
        <section className="col-span-full space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard href="/dashboard?view=list" emoji="🏠" label="Assets" value={String(cars.length)} sub={assetGroups.map((a) => a.count + " " + a.label.toLowerCase()).join(" · ") || "No assets yet"} />
            <SummaryCard href="/projects" emoji="🔧" label="Active Jobs" value={String(totalJobs)} sub={totalJobs + (totalJobs === 1 ? " job needs attention" : " jobs need attention")} />
            <SummaryCard href="/receipts" emoji="🧾" label="Receipts" value={String(inboxCount)} sub={inboxCount === 1 ? "1 receipt needs filing" : inboxCount + " receipts need filing"} />
            <SummaryCard emoji="💵" label="Tracked Costs" value={money(totalReceiptCost)} sub={receiptTotals._count.id + (receiptTotals._count.id === 1 ? " receipt logged" : " receipts logged")} />
          </div>
          {assetGroups.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {assetGroups.map((asset) => (
                <Link key={asset.type} href={"/dashboard?view=list&type=" + asset.type} className={(activeType === asset.type ? "border-amber-500 bg-amber-500/10" : "border-gray-800 bg-gray-900 hover:border-amber-500/40") + " rounded-2xl border p-4 transition-colors"}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl">{asset.emoji}</span>
                    <span className="text-xl font-bold text-white">{asset.count}</span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{asset.label}</p>
                  <p className="mt-1 text-xs text-gray-500">{asset.activeJobs} active {asset.activeJobs === 1 ? "job" : "jobs"}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
        {warrantyAlerts.length > 0 && (
          <section className={`${currentView === "grid" ? "col-span-full" : ""} rounded-2xl p-4 border border-sidebar-border`} style={{ background: "var(--sidebar-accent)" }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm flex items-center gap-1.5" style={{ color: "var(--sidebar-text)" }}>
                <span>🛡️</span> <T k="warrantyAlerts" />
              </h2>
              <span className="text-xs" style={{ color: "var(--sidebar-muted)" }}>Top {warrantyAlerts.length}</span>
            </div>
            <div className="space-y-1.5">
              {warrantyAlerts.map((w) => {
                const end = w.warrantyEnd ? new Date(w.warrantyEnd) : null;
                const diffDays = end ? Math.floor((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const car = w.receipt.serviceRecord?.car;
                const dateColor = diffDays != null && diffDays <= 30 ? "#f59e0b" : "#22c55e";
                return (
                  <div key={w.id} className="text-xs flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 border border-sidebar-border" style={{ background: "var(--sidebar-bg)" }}>
                    <div className="min-w-0">
                      <div className="font-medium truncate" style={{ color: "var(--sidebar-text)" }}>{w.name}{car ? ` · ${car.year} ${car.make} ${car.model}` : ""}</div>
                      <div className="truncate mt-0.5" style={{ color: "var(--sidebar-muted)" }}>{w.warrantyProvider || "Warranty"}</div>
                    </div>
                    <div className="flex-shrink-0 font-semibold" style={{ color: dateColor }}>
                      {end ? end.toLocaleDateString("en-US") : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {cars.length === 0 && (
          <div className={`text-center py-20 space-y-4 ${currentView === "grid" ? "col-span-full" : ""}`}>
            <div className="text-6xl">🚗</div>
            <p className="text-gray-400 text-lg"><T k="noCarFound" /></p>
            <Link href="/cars/new" className="inline-block bg-amber-500 text-gray-950 font-bold px-6 py-3 rounded-xl">
              <T k="addFirstCar" />
            </Link>
          </div>
        )}

        {currentView === "list" && (() => {
          // Group by asset type for the inventory list view
          const TYPE_ORDER = ["vehicle", "bicycle", "riding_mower", "equipment", "trailer"];
          const TYPE_LABELS: Record<string, string> = {
            vehicle: "🚗 Cars", bicycle: "🚲 Bicycles", trailer: "🚚 Trailers",
            riding_mower: "🚜 Riding Mowers", equipment: "🧰 Equipment",
          };
          const grouped = TYPE_ORDER
            .map(t => ({ type: t, label: TYPE_LABELS[t], items: (filteredCars as any[]).filter((c: any) => ((c as any).assetType || "vehicle") === t) }))
            .filter(g => g.items.length > 0);
          const multiGroup = grouped.length > 1;

          return (
            <div className="col-span-full space-y-5">
              {grouped.map(group => (
                <section key={group.type}>
                  {multiGroup && (
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 px-1 mb-2">{group.label}</h2>
                  )}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
                    {group.items.map(car => {
                      const assetType = (car as any).assetType || "vehicle";
                      const isBike = assetType === "bicycle";
                      const isMower = assetType === "riding_mower";
                      const carName = isBike
                        ? `${car.make} ${car.model}`
                        : `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
                      const ACTIVE_STATUSES = ["todo", "up_next", "active", "in_progress", "blocked", "testing"];
                      const activeJobs = car.jobs.filter((p: any) => ACTIVE_STATUSES.includes(p.status)).length;
                      const lastService = car.serviceRecords[0] ?? null;
                      const lastServiceLabel = lastService
                        ? new Date(lastService.serviceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                        : null;
                      const addedLabel = new Date(car.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
                      const featured = car.photos.find((p: any) => p.isFeatured) ?? car.photos[0] ?? null;

                      return (
                        <Link key={car.id} href={`/cars/${car.id}`}>
                          <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 active:bg-gray-800 transition-colors">
                            {/* Thumbnail or emoji */}
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gray-800 flex items-center justify-center">
                              {featured ? (
                                <img src={`/uploads/${featured.filename}`} alt={carName} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-2xl">{carEmoji(car.make, assetType)}</span>
                              )}
                            </div>

                            {/* Main info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate text-gray-100"><DT text={carName} /></div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                {car.color && <span className="text-xs text-gray-500">🎨 {car.color}</span>}
                                {isBike && (car as any).bikeType && (
                                  <span className="text-xs text-gray-500 capitalize">{(car as any).bikeType}</span>
                                )}
                                {isBike && (car as any).frameSize && (
                                  <span className="text-xs text-gray-500">📐 {(car as any).frameSize}</span>
                                )}
                                {isBike && (car as any).wheelSize && (
                                  <span className="text-xs text-gray-500">⭕ {(car as any).wheelSize}&quot;</span>
                                )}
                                {!isBike && car.mileage != null && (
                                  <span className="text-xs text-gray-500">
                                    📍 {car.mileage.toLocaleString()} {isMower ? "hrs" : "mi"}
                                  </span>
                                )}
                                {car.vin && !isBike && (
                                  <span className="text-xs text-gray-600 font-mono">VIN: {car.vin.slice(-6)}</span>
                                )}
                                {car.vin && isBike && (
                                  <span className="text-xs text-gray-600 font-mono">S/N: {car.vin.slice(-6)}</span>
                                )}
                              </div>
                            </div>

                            {/* Right side: jobs + service */}
                            <div className="flex-shrink-0 text-right space-y-0.5">
                              {activeJobs > 0 ? (
                                <div className="text-xs font-semibold text-amber-400">🔧 {activeJobs} active</div>
                              ) : (
                                <div className="text-xs text-gray-600">No jobs</div>
                              )}
                              {lastServiceLabel ? (
                                <div className="text-[11px] text-gray-500">🛠 {lastServiceLabel}</div>
                              ) : (
                                <div className="text-[11px] text-gray-600">📅 Added {addedLabel}</div>
                              )}
                            </div>

                            <span className="text-gray-600 text-xs flex-shrink-0">›</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          );
        })()}

        {currentView === "grid" && activeType && (filteredCars as any[]).map((car: any) => {
          const carName = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;
          const featured = car.photos.find((p: any) => p.isFeatured) ?? car.photos[0] ?? null;
          const ACTIVE_STATUSES_GRID = ["todo", "up_next", "active", "in_progress", "blocked", "testing"];
          const activeJobs = car.jobs.filter((p: any) => ACTIVE_STATUSES_GRID.includes(p.status)).length;
          const lastService = car.serviceRecords[0] ?? null;
          const lastServiceLabel = lastService
            ? new Date(lastService.serviceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : null;
          const addedLabel = new Date(car.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });
          return (
            <div key={car.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <Link href={`/cars/${car.id}`}>
                <div className="relative h-36 bg-gray-800">
                  {featured ? (
                    <img src={`/uploads/${featured.filename}`} alt={carName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl">{carEmoji(car.make, (car as any).assetType ?? "vehicle")}</div>
                  )}
                  <div className="absolute inset-0 photo-overlay-gradient" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <div className="font-bold text-sm truncate photo-overlay-text"><DT text={carName} /></div>
                    <div className="text-[11px] mt-0.5 flex items-center gap-2 photo-overlay-subtext">
                      <span className="capitalize">{((car as any).assetType ?? "vehicle").replace("_", " ")}</span>
                      {car.mileage && <><span>•</span><span>{car.mileage.toLocaleString()} {((car as any).assetType ?? "vehicle") === "vehicle" ? "mi" : "hrs"}</span></>}
                    </div>
                  </div>
                </div>
              </Link>

              <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                {activeJobs > 0 ? (
                  <span className="chip-active border px-2 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap">
                    🔧 {activeJobs} active
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-600 font-medium">No active jobs</span>
                )}
                {lastServiceLabel ? (
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">🛠 {lastServiceLabel}</span>
                ) : (
                  <span className="text-[11px] text-gray-600 whitespace-nowrap">📅 Added {addedLabel}</span>
                )}
              </div>

              {/* Jobs for this car */}
              <div className="p-3 space-y-2">
                {car.jobs.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-2"><T k="noJobs" /></p>
                ) : (
                  car.jobs.map((p: any) => {
                    const total = p.phases.reduce((s: number, ph: any) => s + ph.tasks.length, 0);
                    const done = p.phases.reduce((s: number, ph: any) => s + ph.tasks.filter((t: any) => t.done).length, 0);
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    const donePhases = p.phases.filter((ph: any) => ph.status === "done").length;
                    const statusColor = pct === 100 ? "text-emerald-400" : "text-amber-400";

                    return (
                      <Link key={p.id} href={`/job/${p.id}`}>
                        <div className="bg-gray-800 rounded-xl p-3 active:scale-[0.98] transition-transform">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate"><DT text={p.title} /></div>
                              <div className={`text-xs mt-0.5 ${statusColor}`}>
                                {pct === 100 ? <T k="complete" /> : <T k="inProgress" />} · {donePhases}/{p.phases.length} <T k="phases" />
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-base font-bold">{pct}%</div>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-amber-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}

                <Link href={`/jobs/new?carId=${car.id}`}>
                  <div className="border border-dashed border-gray-700 rounded-xl p-3 text-center text-xs text-gray-500 active:text-gray-300 transition-colors mt-1">
                    <T k="newJob" />
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </main>

      {/* Shared Garages section */}


      <footer className="mt-8 pb-8 flex items-center justify-center gap-6">
        <Link href="/templates" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">
          <T k="myTemplates" />
        </Link>
        <Link href="/prd" className="text-xs text-gray-700 hover:text-gray-500 transition-colors">
          📄 PRD
        </Link>
      </footer>
    </div>
  );
}
