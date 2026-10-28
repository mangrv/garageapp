"use client";

import { useState, useRef } from "react";

const ASSET_TYPES = [
  { value: "vehicle",      label: "Vehicle" },
  { value: "trailer",      label: "Trailer" },
  { value: "riding_mower", label: "Riding mower" },
  { value: "equipment",    label: "Equipment" },
  { value: "bicycle",      label: "Bicycle" },
];

const BIKE_TYPES = [
  { value: "road",       label: "Road" },
  { value: "mountain",   label: "Mountain (MTB)" },
  { value: "gravel",     label: "Gravel / Adventure" },
  { value: "hybrid",     label: "Hybrid / Commuter" },
  { value: "bmx",        label: "BMX" },
  { value: "electric",   label: "Electric (e-bike)" },
  { value: "cruiser",    label: "Cruiser / Beach" },
  { value: "kids",       label: "Kids / Youth" },
  { value: "other",      label: "Other" },
];

const RELATIONSHIP_OPTIONS = [
  { value: "owned", label: "I own this" },
  { value: "family", label: "Family/household vehicle" },
  { value: "friend_customer", label: "Friend/customer vehicle" },
  { value: "other", label: "Other managed asset" },
];

const WHEEL_SIZES = [
  { value: "700c",   label: "700c (road / gravel)" },
  { value: "29",     label: '29" (MTB)' },
  { value: "27.5",   label: '27.5" / 650b (MTB)' },
  { value: "26",     label: '26" (MTB / cruiser)' },
  { value: "24",     label: '24" (youth)' },
  { value: "20",     label: '20" (BMX / kids)' },
  { value: "16",     label: '16" (kids)' },
  { value: "12",     label: '12" (toddler)' },
  { value: "other",  label: "Other / custom" },
];

export interface CarFormDefaults {
  assetType?: string;
  relationshipToUser?: string;
  managedOwnerName?: string;
  managedOwnerContact?: string;
  managedOwnerNotes?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  color?: string;
  mileage?: number;
  vin?: string;
  transmission?: string;
  notes?: string;
  bikeType?: string;
  frameSize?: string;
  wheelSize?: string;
}

interface CarFormProps {
  action: (formData: FormData) => Promise<void>;
  title: string;
  backHref: string;
  submitLabel: string;
  defaults?: CarFormDefaults;
}

const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white";
const labelCls = "block text-xs text-gray-400 mb-1";

export default function CarForm({ action, title, backHref, submitLabel, defaults }: CarFormProps) {
  const [assetType, setAssetType] = useState(defaults?.assetType || "vehicle");
  const [relationshipToUser, setRelationshipToUser] = useState(defaults?.relationshipToUser || "owned");
  const formRef = useRef<HTMLFormElement>(null);

  const isBike     = assetType === "bicycle";
  const isVehicle  = assetType === "vehicle";
  const isTrailer  = assetType === "trailer";
  const isMower    = assetType === "riding_mower";
  const isEquip    = assetType === "equipment";

  // Labels vary by type
  const makeLabel  = isBike ? "Brand *" : "Make *";
  const makePlaceholder = isBike
    ? "Trek, Specialized, Giant…"
    : isEquip ? "DeWalt, Honda, Husqvarna…"
    : isMower ? "John Deere, Husqvarna, Cub Cadet…"
    : "Jeep, Ford, Toyota…";

  const modelPlaceholder = isBike
    ? "Domane, Stumpjumper, Defy…"
    : isEquip ? "EU2200i, 3000 PSI…"
    : isMower ? "X390, TS 248XD…"
    : "Grand Cherokee, Mustang…";

  const trimLabel = isMower || isEquip ? "Engine / Configuration" : "Trim / Engine";
  const trimPlaceholder = isBike ? "" : isMower ? "23 HP Kawasaki, Twin-cylinder…"
    : isEquip ? "2-stroke, Inverter…"
    : "4x4 Limited, GT, 4.6L V8…";

  const showTrim = !isBike && !isTrailer;
  const showMileage = isVehicle || isMower;
  const showTransmission = isVehicle;
  const showBikeFields = isBike;
  const showVin = true; // serial / VIN for all types

  const vinLabel = isBike || isEquip || isMower || isTrailer ? "Serial # (optional)" : "VIN (optional)";
  const vinPlaceholder = isBike ? "SN-XXXXXXXX" : "1FAFP40…";
  const mileageLabel = isMower ? "Current hour reading" : "Current odometer (miles)";
  const mileagePlaceholder = isMower ? "342" : "87000";

  return (
    <div className="min-h-screen bg-gray-950 pb-24">
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 py-4">
        <div className="flex items-center gap-3">
          <a href={backHref} className="text-gray-400 text-sm">← Back</a>
          <h1 className="font-bold text-lg">{title}</h1>
        </div>
      </header>

      <main className="px-4 pt-6">
        <form ref={formRef} action={action} className="space-y-5">
          {/* Hidden field so server action always has assetType */}
          <input type="hidden" name="assetType" value={assetType} />
          <input type="hidden" name="relationshipToUser" value={relationshipToUser} />

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">

            {/* Asset type selector */}
            <div>
              <label className={labelCls}>Asset type</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className={inputCls}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Relationship to this asset</label>
              <select
                value={relationshipToUser}
                onChange={(e) => setRelationshipToUser(e.target.value)}
                className={inputCls}
              >
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {relationshipToUser !== "owned" && (
                <p className="mt-1.5 text-xs text-gray-500">Private by default. Use this for vehicles or assets you maintain but do not personally own.</p>
              )}
            </div>

            {relationshipToUser !== "owned" && (
              <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
                <div>
                  <label className={labelCls}>Owner name</label>
                  <input name="managedOwnerName" defaultValue={defaults?.managedOwnerName || ""} placeholder="Optional" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Owner contact</label>
                  <input name="managedOwnerContact" defaultValue={defaults?.managedOwnerContact || ""} placeholder="Phone, email, or handle" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Permission/context notes</label>
                  <textarea name="managedOwnerNotes" rows={2} defaultValue={defaults?.managedOwnerNotes || ""} placeholder="Brake job for a friend, family vehicle, customer repair…" className={inputCls} />
                </div>
              </div>
            )}

            {/* ── BICYCLE-SPECIFIC FIELDS ── */}
            {showBikeFields && (
              <>
                <div>
                  <label className={labelCls}>Bike type</label>
                  <select name="bikeType" defaultValue={defaults?.bikeType || ""} className={inputCls}>
                    <option value="">Select type…</option>
                    {BIKE_TYPES.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Frame size</label>
                    <input
                      name="frameSize"
                      defaultValue={defaults?.frameSize || ""}
                      placeholder="S, M, L, XL, 54cm…"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Wheel size</label>
                    <select name="wheelSize" defaultValue={defaults?.wheelSize || ""} className={inputCls}>
                      <option value="">Unknown</option>
                      {WHEEL_SIZES.map((w) => (
                        <option key={w.value} value={w.value}>{w.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Year — optional for bikes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Year {isBike ? "(optional)" : "*"}</label>
                <input
                  name="year"
                  type="number"
                  required={!isBike}
                  defaultValue={defaults?.year || ""}
                  placeholder={new Date().getFullYear().toString()}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Color</label>
                <input
                  name="color"
                  defaultValue={defaults?.color || ""}
                  placeholder={isBike ? "Matte black" : "Granite Crystal"}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Make / Brand */}
            <div>
              <label className={labelCls}>{makeLabel}</label>
              <input
                name="make"
                required
                defaultValue={defaults?.make || ""}
                placeholder={makePlaceholder}
                className={inputCls}
              />
            </div>

            {/* Model */}
            <div>
              <label className={labelCls}>Model *</label>
              <input
                name="model"
                required
                defaultValue={defaults?.model || ""}
                placeholder={modelPlaceholder}
                className={inputCls}
              />
            </div>

            {/* Trim / Engine — hidden for bike & trailer */}
            {showTrim && (
              <div>
                <label className={labelCls}>{trimLabel}</label>
                <input
                  name="trim"
                  defaultValue={defaults?.trim || ""}
                  placeholder={trimPlaceholder}
                  className={inputCls}
                />
              </div>
            )}

            {/* Odometer / Hours — vehicle & mower only */}
            {showMileage && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{mileageLabel}</label>
                  <input
                    name="mileage"
                    type="number"
                    defaultValue={defaults?.mileage || ""}
                    placeholder={mileagePlaceholder}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{vinLabel}</label>
                  <input
                    name="vin"
                    defaultValue={defaults?.vin || ""}
                    placeholder={vinPlaceholder}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* VIN / Serial standalone (when mileage row not shown) */}
            {!showMileage && (
              <div>
                <label className={labelCls}>{vinLabel}</label>
                <input
                  name="vin"
                  defaultValue={defaults?.vin || ""}
                  placeholder={vinPlaceholder}
                  className={inputCls}
                />
              </div>
            )}

            {/* Transmission — vehicle only */}
            {showTransmission && (
              <div>
                <label className={labelCls}>Transmission</label>
                <select
                  name="transmission"
                  defaultValue={defaults?.transmission || ""}
                  className={inputCls}
                >
                  <option value="">Unknown / not set</option>
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual (stick shift)</option>
                  <option value="cvt">CVT</option>
                  <option value="dct">DCT / Dual-clutch</option>
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Notes</label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={defaults?.notes || ""}
                placeholder={
                  isBike
                    ? "Upgrades, fit notes, rack/fender setup…"
                    : "Known issues, mods, parts on order…"
                }
                className={inputCls}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-amber-500 text-on-accent font-bold py-3.5 rounded-xl text-base active:scale-95 transition-transform"
          >
            {submitLabel}
          </button>
        </form>
      </main>
    </div>
  );
}
