"use client";

import { useState } from "react";
import { useApp } from "@/app/providers/AppProviders";
import { Cpu, Droplets, Zap, Thermometer, CircleDot, Wrench, Battery, Wind, Copy, Check, RefreshCw, Pencil, Save, X, Search, AlertTriangle, CheckCircle, BookOpen, Sparkles, ExternalLink } from "lucide-react";
import Glyph from "@/app/components/Glyph";

type Specs = Record<string, string | null>;
type VinEnrichment = {
  engine: string | null;
  displacement: string | null;
  drivetrain: string | null;
  bodyStyle: string | null;
  plant: string | null;
  fuelType: string | null;
  doors: number | null;
  series: string | null;
  trim: string | null;
  hasOpenRecalls: boolean;
  recallCount: number;
  enrichedAt: string | null;
  blurb: string | null;
  blurbGeneratedAt: string | null;
};

const SECTIONS = [
  {
    key: "engine",
    icon: Cpu,
    label: "Engine & Oil",
    labelEs: "Motor y Aceite",
    fields: [
      { key: "engineOilType",      label: "Oil Type",             labelEs: "Tipo de aceite" },
      { key: "engineOilCapacity",  label: "Oil Capacity",         labelEs: "Capacidad de aceite" },
      { key: "oilDrainPlugTorque", label: "Drain Plug Torque",    labelEs: "Torque tapón de drenaje" },
      { key: "oilChangeInterval",  label: "Change Interval",      labelEs: "Intervalo de cambio" },
      { key: "timingBeltOrChain",  label: "Timing Belt/Chain",    labelEs: "Correa/cadena de distribución" },
      { key: "airFilterInterval",  label: "Air Filter Interval",  labelEs: "Intervalo filtro de aire" },
    ],
  },
  {
    key: "transmission",
    icon: Wrench,
    label: "Transmission",
    labelEs: "Transmisión",
    fields: [
      { key: "transmissionFluid",    label: "Fluid Type",     labelEs: "Tipo de fluido" },
      { key: "transmissionCapacity", label: "Capacity",       labelEs: "Capacidad" },
      { key: "transmissionService",  label: "Service Interval", labelEs: "Intervalo de servicio" },
    ],
  },
  {
    key: "ignition",
    icon: Zap,
    label: "Ignition",
    labelEs: "Encendido",
    fields: [
      { key: "sparkPlugBrand",      label: "Spark Plug",          labelEs: "Bujía" },
      { key: "sparkPlugGap",        label: "Plug Gap",            labelEs: "Separación de bujía" },
      { key: "firingOrder",         label: "Firing Order",        labelEs: "Orden de encendido" },
      { key: "ignitionCoilTorque",  label: "Coil Bolt Torque",    labelEs: "Torque bobina" },
    ],
  },
  {
    key: "cooling",
    icon: Thermometer,
    label: "Cooling System",
    labelEs: "Sistema de Enfriamiento",
    fields: [
      { key: "coolantType",        label: "Coolant Type",        labelEs: "Tipo de refrigerante" },
      { key: "coolantCapacity",    label: "System Capacity",     labelEs: "Capacidad del sistema" },
      { key: "thermostatTemp",     label: "Thermostat Temp",     labelEs: "Temperatura del termostato" },
      { key: "coolantPressureCap", label: "Pressure Cap",        labelEs: "Tapa de presión" },
    ],
  },
  {
    key: "brakes",
    icon: CircleDot,
    label: "Brakes",
    labelEs: "Frenos",
    fields: [
      { key: "brakeFluidType",          label: "Brake Fluid",              labelEs: "Fluido de frenos" },
      { key: "frontBrakeMinThick",      label: "Front Pad Min",            labelEs: "Min pastilla delantera" },
      { key: "rearBrakeMinThick",       label: "Rear Pad Min",             labelEs: "Min pastilla trasera" },
      { key: "frontRotorMinThick",      label: "Front Rotor Min",          labelEs: "Min disco delantero" },
      { key: "rearRotorMinThick",       label: "Rear Rotor Min",           labelEs: "Min disco trasero" },
      { key: "caliperBoltTorqueFront",  label: "Front Caliper Torque",     labelEs: "Torque pinza delantera" },
      { key: "caliperBoltTorqueRear",   label: "Rear Caliper Torque",      labelEs: "Torque pinza trasera" },
    ],
  },
  {
    key: "wheels",
    icon: CircleDot,
    label: "Wheels & Tires",
    labelEs: "Ruedas y Neumáticos",
    fields: [
      { key: "lugNutTorque",      label: "Lug Nut Torque",   labelEs: "Torque tuercas de rueda" },
      { key: "wheelSize",         label: "Wheel Size",       labelEs: "Tamaño de aro" },
      { key: "tireSize",          label: "Tire Size",        labelEs: "Tamaño de neumático" },
      { key: "coldTirePressure",  label: "Tire Pressure",    labelEs: "Presión de neumáticos" },
    ],
  },
  {
    key: "fluids",
    icon: Droplets,
    label: "Other Fluids",
    labelEs: "Otros Fluidos",
    fields: [
      { key: "powerSteeringFluid", label: "Power Steering",  labelEs: "Dirección asistida" },
      { key: "acRefrigerant",      label: "A/C Refrigerant", labelEs: "Refrigerante A/C" },
      { key: "diffFluid",          label: "Differential",    labelEs: "Diferencial" },
    ],
  },
  {
    key: "electrical",
    icon: Battery,
    label: "Electrical",
    labelEs: "Eléctrico",
    fields: [
      { key: "batterySpec", label: "Battery", labelEs: "Batería" },
    ],
  },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="ml-1 text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

function SimpleMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("## ")) {
          return <h3 key={index} className="text-sm font-bold text-white pt-3 first:pt-0">{trimmed.slice(3)}</h3>;
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return <p key={index} className="text-sm text-gray-300 leading-relaxed pl-3">- {trimmed.slice(2)}</p>;
        }
        return <p key={index} className="text-sm text-gray-300 leading-relaxed">{trimmed}</p>;
      })}
    </div>
  );
}

export default function SpecsClient({
  carId,
  carName,
  vin,
  initialEnrichment,
  initialSpecs,
}: {
  carId: string;
  carName: string;
  vin: string | null;
  initialEnrichment: VinEnrichment | null;
  initialSpecs: Specs | null;
}) {
  const { lang } = useApp();
  const [specs, setSpecs] = useState<Specs | null>(initialSpecs);
  const [enrichment, setEnrichment] = useState<VinEnrichment | null>(initialEnrichment);
  const [scanningVin, setScanningVin] = useState(false);
  const [generatingOverview, setGeneratingOverview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Specs>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const es = lang === "es";
  const vinFacts = [
    enrichment?.engine && { label: es ? "Motor" : "Engine", value: enrichment.engine },
    enrichment?.drivetrain && { label: es ? "Tracción" : "Drivetrain", value: enrichment.drivetrain },
    enrichment?.bodyStyle && { label: es ? "Carrocería" : "Body", value: enrichment.bodyStyle },
    enrichment?.fuelType && { label: es ? "Combustible" : "Fuel", value: enrichment.fuelType },
    enrichment?.trim && { label: "Trim", value: enrichment.trim },
    enrichment?.plant && { label: es ? "Planta" : "Plant", value: enrichment.plant },
  ].filter(Boolean) as { label: string; value: string }[];

  const scanVin = async (refresh = false) => {
    setScanningVin(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${carId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "VIN scan failed");
      if (data.enrichment) {
        setEnrichment((prev) => ({
          ...data.enrichment,
          blurb: prev?.blurb ?? null,
          blurbGeneratedAt: prev?.blurbGeneratedAt ?? null,
        }));
      }
    } catch (e: any) {
      setError(e.message ?? "VIN scan failed");
    } finally {
      setScanningVin(false);
    }
  };

  const generateOverview = async (refresh = false) => {
    setGeneratingOverview(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${carId}/blurb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Overview generation failed");
      setEnrichment((prev) => ({
        ...(prev ?? {
          engine: null,
          displacement: null,
          drivetrain: null,
          bodyStyle: null,
          plant: null,
          fuelType: null,
          doors: null,
          series: null,
          trim: null,
          hasOpenRecalls: false,
          recallCount: 0,
          enrichedAt: null,
        }),
        blurb: data.blurb,
        blurbGeneratedAt: data.blurbGeneratedAt,
      }));
    } catch (e: any) {
      setError(e.message ?? "Overview generation failed");
    } finally {
      setGeneratingOverview(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/cars/${carId}/specs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSpecs(data.specs);
    } catch (e: any) {
      setError(e.message ?? "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const startEdit = (sectionKey: string, fields: { key: string }[]) => {
    const vals: Specs = {};
    fields.forEach(f => { vals[f.key] = specs?.[f.key] ?? ""; });
    setEditValues(vals);
    setEditSection(sectionKey);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/cars/${carId}/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: editValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSpecs(prev => ({ ...(prev ?? {}), ...data.specs }));
      setEditSection(null);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const hasAnyData = specs && Object.values(specs).some(v => v && v !== "null");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Wind size={18} className="text-gray-400" />
            {es ? "Especificaciones" : "Vehicle Specs"}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{carName}</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-on-accent hover:bg-amber-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={generating ? "animate-spin" : ""} />
          {generating ? (es ? "Generando…" : "Generating…") : hasAnyData ? (es ? "Regenerar" : "Regenerate") : (es ? "Generar con IA" : "Generate with AI")}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-800">
          <div className="min-w-0">
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <Search size={15} className="text-gray-400" />
              {es ? "Escaneo VIN" : "VIN Scan"}
            </h2>
            {vin ? (
              <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">{vin}</p>
            ) : (
              <p className="text-xs text-amber-400 mt-0.5">
                {es ? "Agrega un VIN al vehículo para activar el escaneo" : "Add a VIN to this vehicle to enable scanning"}
              </p>
            )}
          </div>
          <button
            onClick={() => scanVin(!!enrichment?.enrichedAt)}
            disabled={scanningVin || !vin}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw size={13} className={scanningVin ? "animate-spin" : ""} />
            {scanningVin ? (es ? "Escaneando…" : "Scanning…") : enrichment?.enrichedAt ? (es ? "Actualizar" : "Refresh") : (es ? "Escanear" : "Scan")}
          </button>
        </div>

        {enrichment ? (
          <div className="px-4 py-3 space-y-3">
            {vinFacts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                {vinFacts.map(({ label, value }) => (
                  <div key={label} className="min-w-0">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</div>
                    <div className="text-sm text-gray-200 font-medium truncate">{value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-gray-800 pt-3">
              <div className="flex items-center gap-2 min-w-0">
                {enrichment.hasOpenRecalls ? (
                  <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
                ) : (
                  <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                )}
                <p className="text-xs text-gray-300">
                  {enrichment.hasOpenRecalls
                    ? es ? `${enrichment.recallCount} recall abierto` : `${enrichment.recallCount} open recall${enrichment.recallCount === 1 ? "" : "s"}`
                    : es ? "No se encontraron recalls abiertos" : "No open recalls found"}
                </p>
              </div>
              {enrichment.enrichedAt && (
                <p className="text-[11px] text-gray-700 flex-shrink-0">
                  NHTSA · {new Date(enrichment.enrichedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 py-5 text-sm text-gray-500">
            {vin
              ? es
                ? "Escanea el VIN para traer datos de NHTSA antes de generar especificaciones."
                : "Scan the VIN to pull NHTSA vehicle data before generating specs."
              : es
                ? "Sin VIN guardado para este vehículo."
                : "No VIN is saved for this vehicle."}
          </div>
        )}
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-sm text-white flex items-center gap-2">
              <BookOpen size={15} className="text-amber-400" />
              {es ? "Resumen del vehículo" : "Vehicle Overview"}
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              {enrichment?.blurbGeneratedAt
                ? `${es ? "Guardado" : "Saved"} ${new Date(enrichment.blurbGeneratedAt).toLocaleDateString()}`
                : es ? "Se guarda en la base de datos" : "Saved to the database once generated"}
            </p>
          </div>
          <button
            onClick={() => generateOverview(!!enrichment?.blurb)}
            disabled={generatingOverview}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-800 border border-gray-700 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            {generatingOverview ? <Sparkles size={13} className="animate-pulse" /> : <RefreshCw size={13} />}
            {generatingOverview
              ? es ? "Escribiendo…" : "Writing…"
              : enrichment?.blurb ? es ? "Actualizar" : "Refresh" : es ? "Crear" : "Generate"}
          </button>
        </div>

        {generatingOverview && (
          <div className="px-4 py-5 space-y-3">
            {[85, 65, 92, 50].map((w, i) => (
              <div key={i} className="h-3 bg-gray-800 rounded animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {!generatingOverview && enrichment?.blurb && (
          <div className="px-4 py-4">
            <SimpleMarkdown text={enrichment.blurb} />
            <div className="mt-4 border-t border-gray-800 pt-3 flex flex-wrap gap-3 text-xs">
              <a href="https://vpic.nhtsa.dot.gov/api/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300">
                NHTSA vPIC <ExternalLink size={11} />
              </a>
              <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300">
                NHTSA recalls <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}

        {!generatingOverview && !enrichment?.blurb && (
          <div className="px-4 py-5 text-sm text-gray-500">
            {es
              ? "Crea un resumen rico con los datos guardados del vehículo y el VIN."
              : "Generate a rich saved summary using the vehicle record and stored VIN data."}
          </div>
        )}
      </section>

      {/* Empty state */}
      {!hasAnyData && !generating && (
        <div className="text-center py-16 space-y-4">
          <Wind size={48} className="mx-auto text-gray-700" />
          <div>
            <p className="text-sm text-gray-400 font-medium">
              {es ? "Sin especificaciones aún" : "No specs yet"}
            </p>
            <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto">
              {es
                ? `Toca "Generar con IA" para obtener las especificaciones de fábrica del ${carName}, incluyendo fluidos, ignición, frenos y torques.`
                : `Tap "Generate with AI" to fetch factory specs for your ${carName} — fluids, ignition, brakes, torque specs and more.`}
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-on-accent font-bold text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={generating ? "animate-spin" : ""} />
            {es ? "Generar con IA" : "Generate with AI"}
          </button>
          <p className="text-xs text-gray-700">
            {es ? "Generado por IA — verifica con tu manual del propietario" : "AI-generated — verify with your owner's manual"}
          </p>
        </div>
      )}

      {/* Generating skeleton */}
      {generating && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="h-4 bg-gray-800 rounded w-1/3" />
              <div className="h-3 bg-gray-800 rounded w-3/4" />
              <div className="h-3 bg-gray-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Specs sections */}
      {hasAnyData && !generating && (
        <>
          <p className="text-xs text-gray-600 flex items-center gap-1">
            <Glyph e="⚠" /> {es ? "Generado por IA — verifica con tu manual del propietario" : "AI-generated — verify with your owner's manual"}
          </p>

          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const visibleFields = section.fields.filter(f => specs?.[f.key]);
            if (visibleFields.length === 0) return null;
            const isEditing = editSection === section.key;

            return (
              <div key={section.key} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <div className="flex items-center gap-2 font-semibold text-sm text-white">
                    <Icon size={15} className="text-amber-400" />
                    {es ? section.labelEs : section.label}
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 text-xs bg-amber-500 text-on-accent font-semibold px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                        <Save size={11} />{saving ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar" : "Save")}
                      </button>
                      <button onClick={() => setEditSection(null)} className="flex items-center gap-1 text-xs bg-gray-800 text-gray-300 px-2.5 py-1.5 rounded-lg">
                        <X size={11} />{es ? "Cancelar" : "Cancel"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(section.key, section.fields)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                      <Pencil size={11} />{es ? "Editar" : "Edit"}
                    </button>
                  )}
                </div>

                {/* Fields */}
                <div className="divide-y divide-gray-800">
                  {section.fields.map(field => {
                    const value = specs?.[field.key];
                    if (!isEditing && !value) return null;

                    return (
                      <div key={field.key} className="px-4 py-2.5 flex items-start justify-between gap-3">
                        <span className="text-xs text-gray-500 flex-shrink-0 w-40">
                          {es ? field.labelEs : field.label}
                        </span>
                        {isEditing ? (
                          <input
                            value={editValues[field.key] ?? ""}
                            onChange={e => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white min-w-0"
                          />
                        ) : (
                          <div className="flex items-start gap-1 flex-1 min-w-0 justify-end">
                            <span className="text-xs text-gray-200 text-right leading-relaxed">{value}</span>
                            {value && <CopyButton value={value} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          {specs?.notes && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-400 mb-1"><Glyph e="📝" /> {es ? "Notas" : "Notes"}</p>
              <p className="text-xs text-gray-300 leading-relaxed">{specs.notes}</p>
            </div>
          )}

          <p className="text-xs text-gray-700 text-center">
            {specs?.generatedAt ? (es ? `Generado el ` : `Generated `) + new Date(specs.generatedAt).toLocaleDateString() : ""}
          </p>
        </>
      )}
    </div>
  );
}
