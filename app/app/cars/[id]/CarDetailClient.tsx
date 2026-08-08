"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import MileageSection from "./MileageSection";
import { useT } from "@/app/hooks/useT";
import { useApp } from "@/app/providers/AppProviders";
import { saveCar, deleteCar, addMileageLog, deleteMileageLog } from "./actions";
import CarGallery from "./CarGallery";
import MaintenanceForecast from "./MaintenanceForecast";
import CarDocuments from "./CarDocuments";
import VehicleBlurbPanel from "./VehicleBlurbPanel";
import Link from "next/link";

type Photo = {
  id: string; filename: string; caption: string | null;
  takenAt: string | null; isFeatured: boolean; createdAt: string;
};
type Job = {
  id: string; title: string; pct: number;
};
type Car = {
  id: string; assetType: string; relationshipToUser: string;
  managedOwnerName: string | null; managedOwnerContact: string | null; managedOwnerNotes: string | null;
  year: number; make: string; model: string;
  trim: string | null; color: string | null; mileage: number | null;
  vin: string | null; transmission: string | null; notes: string | null;
  acquiredDate: string | null; purchasePrice: number | null;
  bikeType: string | null; frameSize: string | null; wheelSize: string | null;
};
type ServiceRecord = {
  id: string; title: string; mileage: number | null; serviceDate: string;
};
type CarStats = {
  total: number; active: number; done: number; archived: number; serviceCount: number;
};
type MileageLog = {
  id: string; mileage: number; recordedAt: string; source: string; notes: string | null;
};

function carEmoji(make: string, assetType = "vehicle") {
  if (assetType === "trailer") return "🚚";
  if (assetType === "riding_mower") return "🚜";
  if (assetType === "equipment") return "🧰";
  if (assetType === "bicycle") return "🚲";
  if (make.toLowerCase() === "ford") return "🐎";
  if (make.toLowerCase() === "jeep") return "🚙";
  return "🚗";
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function relationshipLabel(value: string) {
  if (value === "family") return "Family vehicle";
  if (value === "friend_customer") return "Managed for a friend/customer";
  if (value === "other") return "Managed asset";
  return null;
}



type CostData = {
  purchasePrice: number | null;
  totalServiceCost: number;
  jobReceiptTotal: number;
  totalInvested: number;
  costPerYear: number | null;
  costPerMile: number | null;
  monthsOwned: number | null;
  serviceCount: number;
  byCategory: { cat: string; total: number }[];
};

type CarDoc = {
  id: string; filename: string; type: string; label: string | null;
  expiresAt: string | null; notes: string | null; createdAt: string;
};

type WarrantyItem = {
  id: string;
  name: string;
  warrantyProvider: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  warrantyNotes: string | null;
  receiptId: string;
  serviceRecordId: string | null;
};

export default function CarDetailClient({
  car, photos, projects, recentService, stats, mileageLogs, costData, documents, warranties, accessLevel,
  enrichment, vehicleEstimate, estimateSnapshots, marketLow, marketHigh, isPublic: initialIsPublic, publicNotes: initialPublicNotes,
  vehicleBlurb, vehicleBlurbGeneratedAt,
}: {
  car: Car;
  photos: Photo[];
  projects: Job[];
  recentService: ServiceRecord[];
  stats: CarStats;
  enrichment?: any;
  vehicleEstimate?: any;
  estimateSnapshots?: any[];
  marketLow?: number | null;
  marketHigh?: number | null;
  mileageLogs: MileageLog[];
  costData: CostData;
  documents: CarDoc[];
  warranties: WarrantyItem[];
  accessLevel?: "view" | "full" | "none";
  isPublic?: boolean;
  publicNotes?: string;
  vehicleBlurb?: string | null;
  vehicleBlurbGeneratedAt?: string | null;
}) {
  const t = useT();
  const { lang } = useApp();
  const router = useRouter();
  const canWrite = !accessLevel || accessLevel === "full";
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Blurb state — shared between VehicleBlurbPanel and PublicCarSection
  const [blurb, setBlurb] = useState<string | null>(vehicleBlurb ?? null);
  const [blurbGeneratedAt, setBlurbGeneratedAt] = useState<string | null>(vehicleBlurbGeneratedAt ?? null);
  const [blurbGenerating, setBlurbGenerating] = useState(false);

  const generateBlurb = async () => {
    if (blurbGenerating) return;
    setBlurbGenerating(true);
    try {
      const res = await fetch(`/api/cars/${car.id}/blurb`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBlurb(data.blurb);
        setBlurbGeneratedAt(data.blurbGeneratedAt);
      }
    } catch { /* silent */ } finally {
      setBlurbGenerating(false);
    }
  };

  // Auto-generate if car is already public and has no blurb yet
  useEffect(() => {
    if (initialIsPublic && !vehicleBlurb) {
      generateBlurb();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // edit form state
  const [assetType, setAssetType] = useState(car.assetType || "vehicle");
  const [relationshipToUser, setRelationshipToUser] = useState(car.relationshipToUser || "owned");
  const [managedOwnerName, setManagedOwnerName] = useState(car.managedOwnerName ?? "");
  const [managedOwnerContact, setManagedOwnerContact] = useState(car.managedOwnerContact ?? "");
  const [managedOwnerNotes, setManagedOwnerNotes] = useState(car.managedOwnerNotes ?? "");
  const [year, setYear] = useState(String(car.year));
  const [make, setMake] = useState(car.make);
  const [model, setModel] = useState(car.model);
  const [trim, setTrim] = useState(car.trim ?? "");
  const [color, setColor] = useState(car.color ?? "");
  const [mileage, setMileage] = useState(car.mileage ? String(car.mileage) : "");
  const [vin, setVin] = useState(car.vin ?? "");
  const [transmission, setTransmission] = useState(car.transmission ?? "");
  const [notes, setNotes] = useState(car.notes ?? "");
  const [acquiredDate, setAcquiredDate] = useState(car.acquiredDate ? car.acquiredDate.slice(0, 10) : "");
  const [purchasePrice, setPurchasePrice] = useState(car.purchasePrice ? String(car.purchasePrice) : "");
  const [bikeType, setBikeType] = useState(car.bikeType ?? "");
  const [frameSize, setFrameSize] = useState(car.frameSize ?? "");
  const [wheelSize, setWheelSize] = useState(car.wheelSize ?? "");
  const [showDelete, setShowDelete] = useState(false);

  const featured = photos.find((p) => p.isFeatured) ?? photos[0] ?? null;
  const carName = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`;

  const handleSave = () => {
    startTransition(async () => {
      await saveCar(
        car.id,
        assetType,
        relationshipToUser,
        relationshipToUser === "owned" ? null : managedOwnerName.trim() || null,
        relationshipToUser === "owned" ? null : managedOwnerContact.trim() || null,
        relationshipToUser === "owned" ? null : managedOwnerNotes.trim() || null,
        parseInt(year) || car.year,
        make.trim() || car.make,
        model.trim() || car.model,
        trim.trim() || null,
        color.trim() || null,
        parseInt(mileage) || null,
        vin.trim() || null,
        notes.trim() || null,
        acquiredDate || null,
        parseFloat(purchasePrice) || null,
        transmission || null,
        bikeType.trim() || null,
        frameSize.trim() || null,
        wheelSize.trim() || null,
      );
      setEditOpen(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteCar(car.id);
    });
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white";
  const labelCls = "block text-xs text-gray-400 mb-1";

  return (
    <div className="min-h-screen bg-gray-950 pb-24 w-full max-w-full overflow-x-hidden">
      {/* Hero */}
      {featured ? (
        <div className="relative w-full h-56 bg-gray-900">
          <img src={`/uploads/${featured.filename}`} alt={carName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="text-white font-bold text-xl drop-shadow">{carEmoji(car.make, car.assetType)} {carName}</div>
            {featured.takenAt && (
              <div className="text-gray-300 text-xs mt-0.5">📅 {formatDate(featured.takenAt)}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{carEmoji(car.make, car.assetType)}</span>
            <div>
              <h1 className="font-bold text-lg">{carName}</h1>
              <div className="text-xs text-gray-400 flex gap-2">
                {car.color && <span>🎨 {car.color}</span>}
                {car.mileage && <span>📍 {car.mileage.toLocaleString()} mi</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back + top actions */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button onClick={() => router.back()} className="text-gray-400 text-sm">{`← ${t("myGarage")}`}</button>
        {canWrite && (
          <button
            onClick={() => setEditOpen((o) => !o)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${editOpen ? "bg-amber-500 text-gray-950" : "bg-gray-800 text-gray-300"}`}
          >
            {editOpen ? t("close") : `✏️ ${t("editAsset")}`}
          </button>
        )}
      </div>

      <div className="px-4 space-y-6 pt-2">
        {/* ── Inline edit form ── */}
        {editOpen && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
            <div className="text-sm font-semibold text-gray-200 mb-1">Edit asset details</div>

            <div>
              <label className={labelCls}>Asset type</label>
              <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className={inputCls}>
                <option value="vehicle">🚗 Vehicle</option>
                <option value="trailer">🚚 Trailer</option>
                <option value="riding_mower">🚜 Riding mower</option>
                <option value="equipment">🧰 Equipment</option>
                <option value="bicycle">🚲 Bicycle</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Relationship to this asset</label>
              <select value={relationshipToUser} onChange={(e) => setRelationshipToUser(e.target.value)} className={inputCls}>
                <option value="owned">I own this</option>
                <option value="family">Family/household vehicle</option>
                <option value="friend_customer">Friend/customer vehicle</option>
                <option value="other">Other managed asset</option>
              </select>
              {relationshipToUser !== "owned" && (
                <p className="mt-1.5 text-xs text-gray-500">Private by default. Use this for assets you maintain but do not personally own.</p>
              )}
            </div>

            {relationshipToUser !== "owned" && (
              <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
                <div>
                  <label className={labelCls}>Owner name</label>
                  <input value={managedOwnerName} onChange={(e) => setManagedOwnerName(e.target.value)} placeholder="Optional" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Owner contact</label>
                  <input value={managedOwnerContact} onChange={(e) => setManagedOwnerContact(e.target.value)} placeholder="Phone, email, or handle" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Permission/context notes</label>
                  <textarea value={managedOwnerNotes} onChange={(e) => setManagedOwnerNotes(e.target.value)} rows={2} placeholder="Brake job for a friend, family vehicle, customer repair..." className={inputCls} />
                </div>
              </div>
            )}

            {/* Bicycle-specific fields */}
            {assetType === "bicycle" && (
              <>
                <div>
                  <label className={labelCls}>Bike type</label>
                  <select value={bikeType} onChange={(e) => setBikeType(e.target.value)} className={inputCls}>
                    <option value="">Select type…</option>
                    <option value="road">Road</option>
                    <option value="mountain">Mountain (MTB)</option>
                    <option value="gravel">Gravel / Adventure</option>
                    <option value="hybrid">Hybrid / Commuter</option>
                    <option value="bmx">BMX</option>
                    <option value="electric">Electric (e-bike)</option>
                    <option value="cruiser">Cruiser / Beach</option>
                    <option value="kids">Kids / Youth</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Frame size</label>
                    <input value={frameSize} onChange={(e) => setFrameSize(e.target.value)} placeholder="S, M, L, 54cm…" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Wheel size</label>
                    <select value={wheelSize} onChange={(e) => setWheelSize(e.target.value)} className={inputCls}>
                      <option value="">Unknown</option>
                      <option value="700c">700c (road/gravel)</option>
                      <option value="29">29&quot; (MTB)</option>
                      <option value="27.5">27.5&quot; / 650b</option>
                      <option value="26">26&quot;</option>
                      <option value="24">24&quot;</option>
                      <option value="20">20&quot; (BMX/kids)</option>
                      <option value="16">16&quot; (kids)</option>
                      <option value="12">12&quot; (toddler)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Year {assetType === "bicycle" ? "(optional)" : "*"}</label>
                <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>{assetType === "bicycle" ? "Brand *" : "Make *"}</label>
              <input value={make} onChange={(e) => setMake(e.target.value)}
                placeholder={assetType === "bicycle" ? "Trek, Specialized, Giant…" : "e.g. Jeep"} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Model *</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Grand Cherokee" className={inputCls} />
            </div>
            {assetType !== "bicycle" && assetType !== "trailer" && (
              <div>
                <label className={labelCls}>{assetType === "riding_mower" || assetType === "equipment" ? "Engine / Configuration" : "Trim / Engine"}</label>
                <input value={trim} onChange={(e) => setTrim(e.target.value)} placeholder="e.g. 4x4 Limited, 3.6L V6" className={inputCls} />
              </div>
            )}

            {/* Odometer / hours — vehicle & mower only */}
            {(assetType === "vehicle" || assetType === "riding_mower") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{assetType === "riding_mower" ? "Hour meter" : "Odometer (miles)"}</label>
                  <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder={assetType === "riding_mower" ? "342" : "87000"} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{assetType === "vehicle" ? "VIN" : "Serial #"}</label>
                  <input value={vin} onChange={(e) => setVin(e.target.value)} placeholder="optional" className={`${inputCls} font-mono text-xs`} />
                </div>
              </div>
            )}

            {/* VIN/Serial standalone for other types */}
            {assetType !== "vehicle" && assetType !== "riding_mower" && (
              <div>
                <label className={labelCls}>{assetType === "bicycle" ? "Serial #" : "Serial / VIN"} (optional)</label>
                <input value={vin} onChange={(e) => setVin(e.target.value)} placeholder="optional" className={`${inputCls} font-mono text-xs`} />
              </div>
            )}

            {/* Transmission — vehicle only */}
            {assetType === "vehicle" && (
              <div>
                <label className={labelCls}>Transmission</label>
                <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className={inputCls}>
                  <option value="">Unknown / not set</option>
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual (stick shift)</option>
                  <option value="cvt">CVT</option>
                  <option value="dct">DCT / Dual-clutch</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date Acquired</label>
                <input type="date" value={acquiredDate} onChange={(e) => setAcquiredDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Purchase Price ($)</label>
                <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="e.g. 24500" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any notes…" className={inputCls} />
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={pending}
                className="flex-1 bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm active:scale-95 transition-transform disabled:opacity-40">
                {pending ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditOpen(false)}
                className="flex-1 bg-gray-800 text-gray-300 py-2.5 rounded-xl text-sm">
                Cancel
              </button>
            </div>

            {/* Delete */}
            <div className="pt-1 border-t border-gray-800">
              {!showDelete ? (
                <button onClick={() => setShowDelete(true)}
                  className="w-full text-xs text-red-500 py-2 rounded-lg active:bg-red-900/20">
                  🗑 Remove this car from garage
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 text-center">Jobs will be unlinked, not deleted. Are you sure?</p>
                  <div className="flex gap-2">
                    <button onClick={handleDelete} disabled={pending}
                      className="flex-1 bg-red-700 text-white font-semibold py-2 rounded-xl text-sm active:bg-red-800 disabled:opacity-40">
                      Yes, remove
                    </button>
                    <button onClick={() => setShowDelete(false)}
                      className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-xl text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Car stats chips (when not editing) */}
        {!editOpen && (
          <>
            <div className="flex flex-wrap gap-2 text-sm text-gray-400">
              <span className="bg-gray-800 px-3 py-1 rounded-full capitalize">{carEmoji(car.make, car.assetType)} {car.assetType.replace("_", " ").replace("vehicle", t("vehicle")).replace("trailer", t("trailerLabel") || "trailer").replace("equipment", t("equipment") || "equipment")}</span>
              {relationshipLabel(car.relationshipToUser) && <span className="bg-sky-950/70 border border-sky-900/70 px-3 py-1 rounded-full text-sky-200">{relationshipLabel(car.relationshipToUser)}</span>}
              {car.color && <span className="bg-gray-800 px-3 py-1 rounded-full">🎨 {car.color}</span>}
              {car.mileage && car.assetType !== "bicycle" && <span className="bg-gray-800 px-3 py-1 rounded-full">📍 {car.mileage.toLocaleString()} {car.assetType === "vehicle" ? "mi" : "hrs"}</span>}
              {(car as any).transmission && car.assetType === "vehicle" && (
                <span className="bg-gray-800 px-3 py-1 rounded-full capitalize">
                  ⚙️ {({"automatic":"Automatic","manual":"Manual","cvt":"CVT","dct":"DCT"} as Record<string,string>)[(car as any).transmission] ?? (car as any).transmission}
                </span>
              )}
              {/* Bicycle-specific chips */}
              {car.assetType === "bicycle" && (car as any).bikeType && (
                <span className="bg-gray-800 px-3 py-1 rounded-full capitalize">🚴 {(car as any).bikeType.replace("_", " ")}</span>
              )}
              {car.assetType === "bicycle" && (car as any).frameSize && (
                <span className="bg-gray-800 px-3 py-1 rounded-full">📐 Frame: {(car as any).frameSize}</span>
              )}
              {car.assetType === "bicycle" && (car as any).wheelSize && (
                <span className="bg-gray-800 px-3 py-1 rounded-full">⭕ Wheels: {(car as any).wheelSize}&quot;</span>
              )}
              {car.vin && <span className="bg-gray-800 px-3 py-1 rounded-full font-mono text-xs">{car.assetType === "vehicle" ? "VIN" : "Serial"}: {car.vin}</span>}
              {car.acquiredDate && (() => {
                const acquired = new Date(car.acquiredDate);
                const now = new Date();
                const months = (now.getFullYear() - acquired.getFullYear()) * 12 + (now.getMonth() - acquired.getMonth());
                const years = Math.floor(months / 12);
                const remMonths = months % 12;
                const yr = lang === "es" ? "a" : "y";
                const mo = lang === "es" ? "m" : "mo";
                const duration = years > 0 ? `${years}${yr} ${remMonths}${mo}` : `${remMonths}${mo}`;
                return (
                  <span className="bg-gray-800 px-3 py-1 rounded-full text-xs">
                    🗓 {lang === "es" ? `Propietario ${duration} · desde ${acquired.toLocaleDateString("es-US", { month: "short", year: "numeric" })}` : `Owned ${duration} · since ${acquired.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                  </span>
                );
              })()}
              {car.purchasePrice && <span className="bg-gray-800 px-3 py-1 rounded-full text-xs">{lang === "es" ? `💵 Pagado $${car.purchasePrice.toLocaleString()}` : `💵 Paid $${car.purchasePrice.toLocaleString()}`}</span>}
              {car.notes && <span className="bg-gray-800 px-3 py-1 rounded-full">{car.notes}</span>}
            </div>

            {/* ── Stats dashboard ── */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Active Jobs */}
              <a
                href={`/cars/${car.id}#active-jobs`}
                className="bg-gray-900 border border-gray-800 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col gap-1 active:scale-[0.98] transition-all group"
              >
                <div className="text-2xl font-bold text-amber-400 group-hover:text-amber-300">{stats.active}</div>
                <div className="text-xs font-semibold text-gray-300">{t("activeJobs")}</div>
                <div className="text-[11px] text-gray-500">{t("inProgressNow")}</div>
              </a>

              {/* AI Suggestions */}
              <a
                href={`/cars/${car.id}#forecast`}
                className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl p-4 flex flex-col gap-1 active:scale-[0.98] transition-all group"
              >
                <div className="text-2xl font-bold text-gray-300 group-hover:text-white">AI</div>
                <div className="text-xs font-semibold text-gray-300">{t("suggestedJobs")}</div>
                <div className="text-[11px] text-gray-500">{t("whatsNext")}</div>
              </a>

              {/* Completed Jobs */}
              <a
                href={`/cars/${car.id}?jobFilter=done#active-jobs`}
                className="bg-gray-900 border border-gray-800 hover:border-emerald-500/40 rounded-2xl p-4 flex flex-col gap-1 active:scale-[0.98] transition-all group"
              >
                <div className="text-2xl font-bold text-emerald-400 group-hover:text-emerald-300">{stats.done}</div>
                <div className="text-xs font-semibold text-gray-300">{t("completedJobs")}</div>
                <div className="text-[11px] text-gray-500">{t("viewHistory")}</div>
              </a>

              {/* Service History */}
              <a
                href={`/cars/${car.id}/service-history`}
                className="bg-gray-900 border border-gray-800 hover:border-sky-500/40 rounded-2xl p-4 flex flex-col gap-1 active:scale-[0.98] transition-all group"
              >
                <div className="text-2xl font-bold text-sky-400 group-hover:text-sky-300">{stats.serviceCount}</div>
                <div className="text-xs font-semibold text-gray-300">{t("serviceHistory")}</div>
                <div className="text-[11px] text-gray-500">{t("fullHistory")}</div>
              </a>
            </div>

            {/* Export link (small, below tiles) */}
            <div className="flex justify-end">
              <a href={`/api/export/car/${car.id}`} download className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                {t("exportHistory")}
              </a>
            </div>
          </>
        )}

        {/* Cost of Ownership */}
        {(costData.purchasePrice || costData.totalServiceCost > 0) && (
          <section>
            <h2 className="font-bold text-base mb-3">{`💰 ${t("costOfOwnership")}`}</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              {/* Big number row */}
              <div className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">{t("totalInvested")}</div>
                <div className="text-2xl font-bold text-white">${costData.totalInvested.toLocaleString()}</div>
                {costData.purchasePrice != null && (costData.totalServiceCost > 0 || costData.jobReceiptTotal > 0) && (
                  <div className="text-xs text-gray-600 mt-1">
                    ${costData.purchasePrice.toLocaleString()} purchase
                    {costData.totalServiceCost > 0 && ` + $${costData.totalServiceCost.toLocaleString()} service`}
                    {costData.jobReceiptTotal > 0 && ` + $${costData.jobReceiptTotal.toLocaleString()} parts`}
                  </div>
                )}
              </div>

              {/* Secondary stats */}
              <div className="border-t border-gray-800 px-4 py-3 flex flex-wrap gap-4">
                {costData.purchasePrice && (
                  <div className="text-xs">
                    <span className="text-gray-500">🛒 Purchase </span>
                    <span className="text-white font-medium">${costData.purchasePrice.toLocaleString()}</span>
                  </div>
                )}
                {costData.totalServiceCost > 0 && (
                  <div className="text-xs">
                    <span className="text-gray-500">🔧 Maintenance </span>
                    <span className="text-white font-medium">${costData.totalServiceCost.toLocaleString()}</span>
                    <span className="text-gray-600"> ({costData.serviceCount} records)</span>
                  </div>
                )}
                {costData.costPerMile && (
                  <div className="text-xs">
                    <span className="text-gray-500">📍 Per mile </span>
                    <span className="text-white font-medium">${costData.costPerMile.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Cost breakdown by category */}
              {costData.byCategory.length > 0 && (
                <div className="border-t border-gray-800 px-4 py-3">
                  <div className="text-xs text-gray-500 font-semibold mb-2">{t("maintenanceByCategory")}</div>
                  <div className="space-y-1.5">
                    {costData.byCategory.map(({ cat, total }) => {
                      const catLabels: Record<string, string> = {
                        oil_change: "🛢 Oil Change", tire_rotation: "🔄 Tire Rotation",
                        brakes: "🛑 Brakes", tires: "🔵 Tires", alignment: "📐 Alignment",
                        detailing: "✨ Detailing", inspection: "🔍 Inspection",
                        parts: "🔩 Parts", maintenance: "🔧 Maintenance",
                        modifications: "⚡ Modifications", other: "📦 Other",
                      };
                      const label = catLabels[cat] ?? cat;
                      const base = costData.totalServiceCost + costData.jobReceiptTotal;
                      const pct = base > 0 ? Math.round((total / base) * 100) : 0;
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <div className="text-xs text-gray-400 w-28 truncate">{label}</div>
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs text-gray-300 font-mono w-16 text-right">${total.toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Warranty summary card → /warranty */}
        {warranties.length > 0 && (
          <Link href={`/cars/${car.id}/warranty`} className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Warranty</div>
                <div className="text-sm font-semibold text-white">{warranties.filter((w) => { const e = w.warrantyEnd ? new Date(w.warrantyEnd).getTime() : null; return !e || e > Date.now(); }).length} active item{warranties.length !== 1 ? "s" : ""}</div>
                {warranties.some((w) => { const e = w.warrantyEnd ? new Date(w.warrantyEnd).getTime() : null; return e && e > Date.now() && e <= Date.now() + 30*24*60*60*1000; }) && (
                  <div className="text-xs text-amber-400 mt-0.5">⚠ Some expiring soon</div>
                )}
              </div>
              <span className="text-gray-600 group-hover:text-gray-400 text-sm">→</span>
            </div>
          </Link>
        )}

        {/* Maintenance Forecast */}
        <div id="forecast" />
        <MaintenanceForecast carId={car.id} carName={`${car.year} ${car.make} ${car.model}`} carMileage={car.mileage} />




        {/* Gallery */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base">{`📷 ${t("gallery")}`}</h2>
            <Link href={`/cars/${car.id}/gallery`} className="text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg">{t("viewAll")}</Link>
          </div>
          <CarGallery carId={car.id} photos={photos} />
        </section>

        {/* Service History preview */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base">{`🛠 ${t("serviceHistory")}`}</h2>
            <Link href={`/cars/${car.id}/service-history`}
              className="text-xs bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg">
              {t("viewAll")}
            </Link>
          </div>
          {recentService.length === 0 ? (
            <div className="text-center py-4 space-y-1">
              <p className="text-xs text-gray-600">No service records yet.</p>
              {canWrite && <Link href={`/cars/${car.id}/service-history`} className="text-xs text-amber-400 underline">{`+ ${t("addManualEntry")}`}</Link>}
            </div>
          ) : (
            <div className="space-y-2">
              {recentService.map((r) => (
                <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-white">{r.title}</div>
                    <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                      <span>📅 {new Date(r.serviceDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                      {r.mileage && <span>📍 {r.mileage.toLocaleString()} mi</span>}
                    </div>
                  </div>
                </div>
              ))}
              {recentService.length >= 3 && (
                <Link href={`/cars/${car.id}/service-history`} className="block text-center text-xs text-gray-500 py-1 active:text-gray-300">
                  {t("fullHistory")}
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Jobs */}
        <section id="active-jobs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base">{`🔧 ${t("jobs")}`}</h2>
            <Link href={`/jobs/new?carId=${car.id}`}
              className="text-xs bg-amber-500 text-gray-950 font-semibold px-3 py-1.5 rounded-lg">
              {`+ ${t("new")}`}
            </Link>
          </div>
          <div className="space-y-2">
            {projects.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">No projects yet</p>
            ) : projects.map((p) => (
              <Link key={p.id} href={`/job/${p.id}`}>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="font-medium text-sm">{p.title}</div>
                    <div className="text-sm font-bold flex-shrink-0">{p.pct}%</div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${p.pct === 100 ? "bg-emerald-500" : "bg-amber-400"}`}
                      style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Public Profile Card */}
        {canWrite && (
          <PublicCarSection
            carId={car.id}
            initialIsPublic={initialIsPublic ?? false}
            initialNotes={initialPublicNotes ?? ""}
            carYear={car.year}
            carMake={car.make}
            carModel={car.model}
            hasBlurb={!!blurb}
            onPublicToggle={(isPublic) => { if (isPublic) generateBlurb(); }}
          />
        )}

        {/* Vehicle History Blurb (moved to bottom) */}
        <VehicleBlurbPanel
          carId={car.id}
          carLabel={`${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`}
          blurb={blurb}
          generatedAt={blurbGeneratedAt}
          generating={blurbGenerating}
          onSave={(updated) => { setBlurb(updated); setBlurbGeneratedAt(new Date().toISOString()); }}
        />
      </div>
    </div>
  );
}

function PublicCarSection({ carId, initialIsPublic, initialNotes, carYear, carMake, carModel, hasBlurb, onPublicToggle }: {
  carId: string;
  initialIsPublic: boolean;
  initialNotes: string;
  carYear: number;
  carMake: string;
  carModel: string;
  hasBlurb: boolean;
  onPublicToggle: (isPublic: boolean) => void;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (newPublic?: boolean) => {
    setSaving(true);
    await fetch(`/api/cars/${carId}/public`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: newPublic ?? isPublic, publicNotes: notes }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleToggle = () => {
    const next = !isPublic;
    setIsPublic(next);
    save(next);
    // Auto-generate blurb when making public for the first time
    if (next && !hasBlurb) {
      onPublicToggle(true);
    }
  };

  return (
    <section className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white text-sm">Car Show Card</h3>
          <p className="text-xs text-gray-500 mt-0.5">Public page + QR code for shows &amp; sharing</p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? "bg-amber-500" : "bg-gray-700"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-5" : ""}`} />
        </button>
      </div>

      {isPublic && (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Tell the story of your ${carYear} ${carMake} ${carModel} — mods, history, build notes…`}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60 resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => save()}
              disabled={saving}
              className="flex-1 py-2 rounded-xl bg-amber-500 text-black font-semibold text-sm disabled:opacity-40 hover:bg-amber-400 transition"
            >
              {saved ? "✓ Saved" : saving ? "Saving…" : "Save"}
            </button>
            <a
              href={`/api/cars/${carId}/show-qr`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:border-gray-500 transition text-center"
            >
              🖨️ Print QR
            </a>
          </div>
        </>
      )}
    </section>
  );
}
