"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings, ShieldCheck, LogOut, UserPlus, ChevronLeft, ChevronRight, Menu,
  Gauge, FolderKanban, Users,
} from "lucide-react";
import { useApp } from "@/app/providers/AppProviders";
import { useGuest } from "@/app/providers/GuestProvider";
import { useT } from "@/app/hooks/useT";

interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  color: string | null;
  assetType: string;
}

interface NavItem {
  href: string;
  label: string;
  labelEs: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "My Garage", labelEs: "Mi garaje", Icon: Gauge },
  { href: "/projects", label: "Projects", labelEs: "Proyectos", Icon: FolderKanban },
  { href: "/social", label: "Social", labelEs: "Social", Icon: Users },
  { href: "/settings", label: "Settings", labelEs: "Ajustes", Icon: Settings },
];

const ADMIN_ITEM: NavItem = { href: "/admin", label: "Admin", labelEs: "Admin", Icon: ShieldCheck };

interface Props {
  isAdmin?: boolean;
  inboxCount?: number;
  hasApiKey?: boolean;
  children: React.ReactNode;
}

export default function AppShell({ isAdmin, inboxCount = 0, hasApiKey = false, children }: Props) {
  const pathname = usePathname();
  const { lang } = useApp();
  const { isGuest } = useGuest();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const HIDE_ON = ["/login", "/register", "/guest", "/share", "/u/"];
  const hide = pathname === "/" || HIDE_ON.some(p => pathname.startsWith(p));

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/") return pathname === "/";
    if (href.startsWith("/api")) return false;
    return pathname.startsWith(base);
  };

  const allItems: NavItem[] = [...NAV_ITEMS, ...(isAdmin ? [ADMIN_ITEM] : [])];

  const linkCls = (href: string, mini?: boolean) => {
    const active = isActive(href);
    const base = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${mini ? "justify-center" : ""}`;
    if (active) return `${base} bg-sidebar-active text-sidebar-active`;
    return `${base} text-sidebar hover:bg-sidebar-accent`;
  };

  const SidebarContent = ({ mini }: { mini?: boolean }) => (
    <div className="flex flex-col h-full select-none">
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-sidebar-border px-5 flex-shrink-0 ${mini ? "justify-center px-0" : ""}`}>
        <Link href="/" className="text-sidebar-logo font-bold tracking-tight text-base">
          {mini ? "MG" : "GarageMeet"}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {/* Global nav */}
        {allItems.map(({ href, label, labelEs, Icon }) => {
          const text = lang === "es" ? labelEs : label;
          const badge = 0;
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={linkCls(href, mini)} title={mini ? text : undefined}>
              <Icon size={17} className="flex-shrink-0 opacity-75" />
              {!mini && <span className="flex-1">{text}</span>}
              {badge > 0 && !mini && (
                <span className="bg-amber-500 text-[#ffffff] text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-4 min-w-[18px] text-center">
                  {badge}
                </span>
              )}
              {badge > 0 && mini && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500" />}
              {/* Settings: show dot if no API key configured */}
              {!hasApiKey && href === "/settings" && !mini && (
                <span className="text-[10px] text-amber-400 font-medium">⚙️ Setup AI</span>
              )}
              {!hasApiKey && href === "/settings" && mini && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="flex-shrink-0 border-t border-sidebar-border p-2 space-y-0.5">
        {mounted && isGuest ? (
          <a href="/login?register=1"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-amber-400 hover:text-amber-300 hover:bg-sidebar-accent ${mini ? "justify-center" : ""}`}
            title={mini ? "Register" : undefined}>
            <UserPlus size={17} className="flex-shrink-0" />
            {!mini && <span>{t("register") ?? "Register"}</span>}
          </a>
        ) : (
          <a href="/api/auth/logout"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-sidebar-muted hover:text-red-500 hover:bg-sidebar-accent ${mini ? "justify-center" : ""}`}
            title={mini ? "Log out" : undefined}>
            <LogOut size={17} className="flex-shrink-0" />
            {!mini && <span>{t("logOut")}</span>}
          </a>
        )}
      </div>
    </div>
  );

  if (hide) return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>

      {/* Desktop sidebar (lg+) */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-sidebar border-r border-sidebar-border transition-[width] duration-200 relative ${collapsed ? "w-16" : "w-56"}`}
        style={{ position: "sticky", top: 0, height: "100vh" }}>
        <SidebarContent mini={collapsed} />
        <button onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-sidebar border border-sidebar-border rounded-full flex items-center justify-center text-sidebar-muted hover:text-sidebar transition-colors shadow-sm z-10">
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      </aside>

      {/* Tablet sidebar (md, icon-only) */}
      <aside className="hidden md:flex lg:hidden flex-col flex-shrink-0 w-16 bg-sidebar border-r border-sidebar-border"
        style={{ position: "sticky", top: 0, height: "100vh" }}>
        <SidebarContent mini />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-sidebar border-r border-sidebar-border md:hidden flex flex-col shadow-2xl overflow-y-auto">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center h-14 border-b border-sidebar-border bg-sidebar px-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-sidebar-muted hover:text-sidebar mr-3 p-1">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sidebar-logo text-sm">GarageMeet</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
