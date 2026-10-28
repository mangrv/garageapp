"use client";

import { useGuest } from "@/app/providers/GuestProvider";
import { useApp } from "@/app/providers/AppProviders";
import { usePathname } from "next/navigation";
import Glyph from "@/app/components/Glyph";

const HIDE_ON = ["/login", "/register", "/guest"];

export default function GuestBanner() {
  const { isGuest, draft } = useGuest();
  const { lang } = useApp();
  const pathname = usePathname();

  // Don't show on auth/invite pages
  if (!isGuest) return null;
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  // If user reaches a page that requires auth (not /guest, /login, /register)
  // and draft is empty, they're logged in → clear guest mode silently
  // (handled in GuestImportBridge, but belt-and-suspenders here)

  if (!isGuest) return null;

  const items = [
    draft.cars.length && `${draft.cars.length} ${lang === "es" ? "auto(s)" : "car(s)"}`,
    draft.serviceRecords.length && `${draft.serviceRecords.length} ${lang === "es" ? "servicio(s)" : "service record(s)"}`,
    draft.jobs.length && `${draft.jobs.length} ${lang === "es" ? "trabajo(s)" : "job(s)"}`,
  ].filter(Boolean).join(" · ") || (lang === "es" ? "sin datos aún" : "no data yet");

  return (
    <div className="sticky top-0 z-50 bg-amber-500 text-on-accent text-xs font-semibold px-4 py-2 flex items-center justify-between">
      <span>
        {lang === "es" ? <>{"🔒 Modo Invitado — "}</> : <>{"🔒 Guest Mode — "}</>}
        {lang === "es" ? "Los datos no se guardan. " : "Data not saved. "}
        <span className="opacity-80">{items}</span>
      </span>
      <div className="flex gap-3">
        <a href="/login" className="underline">
          {lang === "es" ? "Iniciar sesión" : "Sign in"}
        </a>
        <a href="/login?register=1" className="underline">
          {lang === "es" ? "Crear cuenta" : "Register"}
        </a>
      </div>
    </div>
  );
}
