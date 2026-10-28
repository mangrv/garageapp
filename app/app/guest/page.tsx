"use client";

import { useEffect, useState } from "react";
import { useGuest } from "@/app/providers/GuestProvider";
import { useApp } from "@/app/providers/AppProviders";
import { GuestCar } from "@/lib/guestDraft";
import Glyph from "@/app/components/Glyph";

export default function GuestPage() {
  const { isGuest, enterGuest, draft, addCar, removeCar, addServiceRecord, removeServiceRecord, addJob, removeJob } = useGuest();
  const { lang } = useApp();
  const [mounted, setMounted] = useState(false);

  // Car form state
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");

  // Service record form state
  const [srCarId, setSrCarId] = useState("");
  const [srTitle, setSrTitle] = useState("");
  const [srDate, setSrDate] = useState(new Date().toISOString().slice(0, 10));
  const [srMileage, setSrMileage] = useState("");

  useEffect(() => {
    setMounted(true);
    if (!isGuest) {
      const token = new URLSearchParams(window.location.search).get("token") ?? undefined;
      enterGuest(token);
    }
  }, []);

  const txt = {
    title: lang === "es" ? "Modo Invitado" : "Guest Mode",
    subtitle: lang === "es" ? "Los datos se guardan localmente hasta que te registres." : "Data saved locally until you register.",
    addCar: lang === "es" ? "Agregar Auto" : "Add Car",
    addService: lang === "es" ? "Agregar Servicio" : "Add Service Record",
    cars: lang === "es" ? "Mis Autos (borrador)" : "My Cars (draft)",
    services: lang === "es" ? "Servicios (borrador)" : "Service Records (draft)",
    register: lang === "es" ? "Crear cuenta e importar" : "Create account & import",
    signIn: lang === "es" ? "Iniciar sesión e importar" : "Sign in & import",
    yearLabel: lang === "es" ? "Año" : "Year",
    makeLabel: lang === "es" ? "Marca" : "Make",
    modelLabel: lang === "es" ? "Modelo" : "Model",
    colorLabel: lang === "es" ? "Color" : "Color",
    noCars: lang === "es" ? "Sin autos aún." : "No cars yet.",
    noServices: lang === "es" ? "Sin servicios aún." : "No service records yet.",
    save: lang === "es" ? "Guardar borrador" : "Save draft",
    mileage: lang === "es" ? "Millaje" : "Mileage",
    date: lang === "es" ? "Fecha" : "Date",
    title2: lang === "es" ? "Título del servicio" : "Service title",
    forCar: lang === "es" ? "Para el auto" : "For car",
    remove: lang === "es" ? "Quitar" : "Remove",
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24">
      {/* Guest banner */}
      <div className="bg-amber-500 text-on-accent text-xs font-semibold px-4 py-2.5 flex items-center justify-between">
        <span><Glyph e="🔒" /> {txt.subtitle}</span>
        <div className="flex gap-3">
          <a href="/login" className="underline">{txt.signIn}</a>
          <a href="/login?register=1" className="underline">{txt.register}</a>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-8 max-w-lg mx-auto">
        <div>
          <h1 className="text-2xl font-bold">{txt.title}</h1>
          <p className="text-sm text-gray-400 mt-1">{txt.subtitle}</p>
        </div>

        {/* Add car */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{txt.addCar}</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">{txt.yearLabel}</label>
                <input value={year} onChange={(e) => setYear(e.target.value)} type="number"
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500">{txt.colorLabel}</label>
                <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Black"
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <input value={make} onChange={(e) => setMake(e.target.value)} placeholder={txt.makeLabel}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={txt.modelLabel}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
            <button
              onClick={() => {
                if (!make.trim() || !model.trim()) return;
                addCar({ assetType: "vehicle", year: parseInt(year) || new Date().getFullYear(), make: make.trim(), model: model.trim(), color: color.trim() || undefined });
                setMake(""); setModel(""); setColor("");
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-on-accent font-semibold text-sm"
            >
              + {txt.addCar}
            </button>
          </div>
        </section>

        {/* Cars list */}
        {draft.cars.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{txt.cars}</h2>
            {draft.cars.map((car) => (
              <div key={car._draftId} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-white"><Glyph e="🚗" /> {car.year} {car.make} {car.model}</div>
                  {car.color && <div className="text-xs text-gray-500"><Glyph e="🎨" /> {car.color}</div>}
                </div>
                <button onClick={() => removeCar(car._draftId)} className="text-xs text-red-400">{txt.remove}</button>
              </div>
            ))}
          </section>
        )}

        {/* Add service record */}
        {draft.cars.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{txt.addService}</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <select value={srCarId} onChange={(e) => setSrCarId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white">
                <option value="">— {txt.forCar} —</option>
                {draft.cars.map((c) => (
                  <option key={c._draftId} value={c._draftId}>{c.year} {c.make} {c.model}</option>
                ))}
              </select>
              <input value={srTitle} onChange={(e) => setSrTitle(e.target.value)} placeholder={txt.title2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={srDate} onChange={(e) => setSrDate(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
                <input type="number" value={srMileage} onChange={(e) => setSrMileage(e.target.value)} placeholder={txt.mileage}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white" />
              </div>
              <button
                onClick={() => {
                  if (!srCarId || !srTitle.trim()) return;
                  addServiceRecord({ _carDraftId: srCarId, title: srTitle.trim(), serviceDate: srDate, mileage: srMileage ? parseInt(srMileage) : undefined });
                  setSrTitle(""); setSrMileage("");
                }}
                className="w-full py-2.5 rounded-xl bg-sky-700 text-on-accent font-semibold text-sm"
              >
                + {txt.addService}
              </button>
            </div>
          </section>
        )}

        {/* Service records list */}
        {draft.serviceRecords.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">{txt.services}</h2>
            {draft.serviceRecords.map((sr) => {
              const car = draft.cars.find((c) => c._draftId === sr._carDraftId);
              return (
                <div key={sr._draftId} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-medium text-white"><Glyph e="🔧" /> {sr.title}</div>
                    <div className="text-xs text-gray-500"><Glyph e="📅" /> {sr.serviceDate} {car ? `· ${car.year} ${car.make} ${car.model}` : ""}</div>
                  </div>
                  <button onClick={() => removeServiceRecord(sr._draftId)} className="text-xs text-red-400">{txt.remove}</button>
                </div>
              );
            })}
          </section>
        )}

        {/* CTA */}
        <div className="bg-gray-900 border border-amber-700/40 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-amber-400 font-semibold">
            {lang === "es" ? "¿Listo para guardar en tu cuenta?" : "Ready to save to your account?"}
          </p>
          <p className="text-xs text-gray-400">
            {lang === "es"
              ? `Tienes ${draft.cars.length} auto(s) y ${draft.serviceRecords.length} servicio(s) en borrador.`
              : `You have ${draft.cars.length} car(s) and ${draft.serviceRecords.length} service record(s) in draft.`}
          </p>
          <div className="flex gap-2">
            <a href="/login?register=1" className="flex-1 py-2.5 rounded-xl bg-amber-500 text-on-accent font-semibold text-sm text-center">{txt.register}</a>
            <a href="/login" className="flex-1 py-2.5 rounded-xl bg-gray-800 text-white text-sm text-center">{txt.signIn}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
