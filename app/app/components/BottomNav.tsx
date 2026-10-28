"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/app/providers/AppProviders";
import Glyph from "@/app/components/Glyph";

interface Props {
  isAdmin?: boolean;
  inboxCount?: number;
}

export default function BottomNav({ isAdmin }: Props) {
  const pathname = usePathname();
  const { lang } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const HIDE_ON = ["/login", "/register", "/guest", "/share", "/u/"];
  if (pathname === "/" || HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  const active = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));
  const tabCls = (path: string) =>
    `flex flex-col items-center gap-0.5 pt-1.5 pb-1 px-3 min-w-0 flex-1 transition-colors ${
      active(path) ? "text-amber-400" : "text-gray-500 active:text-gray-300"
    }`;
  const label = (en: string, es: string) => lang === "es" ? es : en;

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur border-t border-gray-800 flex items-stretch safe-bottom">
        <a href="/dashboard" className={tabCls("/dashboard")}>
          <span className="text-xl leading-none"><Glyph e="🏠" /></span>
          <span className="text-[10px] font-medium">{label("Garage", "Garaje")}</span>
        </a>
        <a href="/projects" className={tabCls("/projects")}>
          <span className="text-xl leading-none"><Glyph e="🔧" /></span>
          <span className="text-[10px] font-medium">{label("Projects", "Proyectos")}</span>
        </a>
        <a href="/social" className={tabCls("/social")}>
          <span className="text-xl leading-none"><Glyph e="🏁" /></span>
          <span className="text-[10px] font-medium">Social</span>
        </a>
        <a href="/settings" className={tabCls("/settings")}>
          <span className="text-xl leading-none"><Glyph e="⚙" /></span>
          <span className="text-[10px] font-medium">{label("Settings", "Ajustes")}</span>
        </a>
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={`flex flex-col items-center gap-0.5 pt-1.5 pb-1 px-3 min-w-0 flex-1 transition-colors ${moreOpen ? "text-amber-400" : "text-gray-500 active:text-gray-300"}`}
        >
          <span className="text-xl leading-none"><Glyph e="☰" /></span>
          <span className="text-[10px] font-medium">{label("More", "Más")}</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-800 rounded-t-3xl pb-safe">
            <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-4 pb-8 space-y-1">
              {isAdmin && (
                <a href="/admin" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-gray-800 text-white font-medium transition-colors">
                  <span className="text-2xl"><Glyph e="🔐" /></span>
                  <span>Admin</span>
                </a>
              )}
              <a href="/social/posts" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-gray-800 text-white font-medium transition-colors">
                <span className="text-2xl"><Glyph e="🗂" /></span>
                <span>{label("My posts", "Mis publicaciones")}</span>
              </a>
              <a href="/social/saved" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-gray-800 text-white font-medium transition-colors">
                <span className="text-2xl"><Glyph e="🔖" /></span>
                <span>{label("Saved", "Guardado")}</span>
              </a>
              <a href="/friends" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-gray-800 text-white font-medium transition-colors">
                <span className="text-2xl"><Glyph e="👥" /></span>
                <span>{label("Friends", "Amigos")}</span>
              </a>
              <a href="/templates" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-gray-800 text-white font-medium transition-colors">
                <span className="text-2xl"><Glyph e="💾" /></span>
                <span>{label("Templates", "Plantillas")}</span>
              </a>
              <div className="border-t border-gray-800 my-2" />
              <a href="/api/auth/logout" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-red-900/30 text-red-400 font-medium transition-colors">
                <span className="text-2xl">↩</span>
                <span>{label("Log out", "Cerrar sesión")}</span>
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
