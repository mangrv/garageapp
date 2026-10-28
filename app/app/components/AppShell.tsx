"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings, ShieldCheck, LogOut, UserPlus, ChevronLeft, ChevronRight,
  House, FolderKanban, Users, Receipt, Plus, X,
} from "lucide-react";
import { useApp } from "@/app/providers/AppProviders";
import { useGuest } from "@/app/providers/GuestProvider";
import { useT } from "@/app/hooks/useT";
import Logo, { LogoTile } from "@/app/components/brand/Logo";
import Avatar from "@/app/components/Avatar";

interface NavItem {
  href: string;
  label: string;
  labelEs: string;
  Icon: React.FC<{ size?: number; className?: string; strokeWidth?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "My Garage", labelEs: "Mi garaje", Icon: House },
  { href: "/projects", label: "Projects", labelEs: "Proyectos", Icon: FolderKanban },
  { href: "/receipts", label: "Receipts", labelEs: "Recibos", Icon: Receipt },
  { href: "/social", label: "Social", labelEs: "Social", Icon: Users },
  { href: "/settings", label: "Settings", labelEs: "Ajustes", Icon: Settings },
];

const ADMIN_ITEM: NavItem = { href: "/admin", label: "Admin", labelEs: "Admin", Icon: ShieldCheck };

interface Props {
  isAdmin?: boolean;
  inboxCount?: number;
  hasApiKey?: boolean;
  userName?: string | null;
  userId?: string | null;
  children: React.ReactNode;
}

export default function AppShell({ isAdmin, inboxCount = 0, hasApiKey = false, userName, userId, children }: Props) {
  const pathname = usePathname();
  const { lang } = useApp();
  const { isGuest } = useGuest();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const HIDE_ON = ["/login", "/register", "/guest", "/share", "/u/"];
  const hide = pathname === "/" || HIDE_ON.some(p => pathname.startsWith(p));

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (base === "/") return pathname === "/";
    return pathname.startsWith(base);
  };

  const allItems: NavItem[] = [...NAV_ITEMS, ...(isAdmin ? [ADMIN_ITEM] : [])];
  const displayName = mounted && isGuest ? "Guest" : userName || "Account";

  const linkCls = (href: string, mini?: boolean) => {
    const active = isActive(href);
    const base = `flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] font-medium transition-colors relative ${mini ? "justify-center" : ""}`;
    return active ? `${base} bg-sidebar-active text-sidebar-active` : `${base} text-sidebar hover:bg-sidebar-accent`;
  };

  const SidebarContent = ({ mini }: { mini?: boolean }) => (
    <div className="flex flex-col h-full select-none">
      <div className={`flex items-center h-16 px-5 flex-shrink-0 ${mini ? "justify-center px-0" : ""}`}>
        <Link href="/dashboard" aria-label="GarageMeet home">
          {mini ? <LogoTile size={34} /> : <Logo size={30} />}
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {allItems.map(({ href, label, labelEs, Icon }) => {
          const text = lang === "es" ? labelEs : label;
          const badge = href === "/receipts" ? inboxCount : 0;
          return (
            <Link key={href} href={href} className={linkCls(href, mini)} title={mini ? text : undefined}>
              <Icon size={19} strokeWidth={isActive(href) ? 2.2 : 1.9} className="flex-shrink-0" />
              {!mini && <span className="flex-1">{text}</span>}
              {badge > 0 && !mini && (
                <span className="bg-amber-500 text-on-accent text-[11px] font-semibold rounded-full px-1.5 leading-5 min-w-[20px] text-center tabular">{badge}</span>
              )}
              {badge > 0 && mini && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-500" />}
              {!hasApiKey && href === "/settings" && !mini && (
                <span className="text-[11px] font-semibold text-amber-400">Set up AI</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-shrink-0 border-t border-sidebar-border p-3">
        {mounted && isGuest ? (
          <a href="/login?register=1" className={`flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] font-semibold text-amber-400 hover:bg-sidebar-accent ${mini ? "justify-center" : ""}`}
            title={mini ? "Register" : undefined}>
            <UserPlus size={19} className="flex-shrink-0" />
            {!mini && <span>{t("register") ?? "Register"}</span>}
          </a>
        ) : (
          <div className={`flex items-center gap-3 ${mini ? "flex-col" : ""}`}>
            <Link href="/settings" className="flex items-center gap-3 min-w-0 flex-1" title={mini ? displayName : undefined}>
              <Avatar name={displayName} seed={userId} size={36} />
              {!mini && (
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-sidebar-logo truncate">{displayName}</span>
                  <span className="block text-xs text-sidebar-muted">{isAdmin ? "Admin" : "Member"}</span>
                </span>
              )}
            </Link>
            <a href="/api/auth/logout" aria-label={t("logOut") ?? "Log out"} title={t("logOut") ?? "Log out"}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-sidebar-muted hover:text-red-500 hover:bg-sidebar-accent transition-colors">
              <LogOut size={18} />
            </a>
          </div>
        )}
      </div>
    </div>
  );

  if (hide) return <>{children}</>;

  const tab = (href: string, label: string, Icon: NavItem["Icon"], badge = 0) => {
    const active = isActive(href);
    return (
      <Link href={href} className={`relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 text-[11px] ${active ? "text-amber-500 font-semibold" : "text-gray-500 font-medium"}`}>
        <Icon size={22} strokeWidth={active ? 2.2 : 1.9} />
        {label}
        {badge > 0 && (
          <span className="absolute top-1 left-1/2 ml-2 bg-amber-500 text-on-accent text-[10px] font-semibold rounded-full px-1 leading-4 min-w-[16px] text-center tabular">{badge}</span>
        )}
      </Link>
    );
  };
  const es = lang === "es";

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>

      {/* Desktop sidebar (lg+) */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-sidebar border-r border-sidebar-border transition-[width] duration-200 relative ${collapsed ? "w-[76px]" : "w-64"}`}
        style={{ position: "sticky", top: 0, height: "100vh" }}>
        <SidebarContent mini={collapsed} />
        <button onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[4.5rem] w-6 h-6 bg-sidebar border border-sidebar-border rounded-full flex items-center justify-center text-sidebar-muted hover:text-sidebar transition-colors shadow-card z-10">
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Tablet sidebar (md, icon-only) */}
      <aside className="hidden md:flex lg:hidden flex-col flex-shrink-0 w-[76px] bg-sidebar border-r border-sidebar-border"
        style={{ position: "sticky", top: 0, height: "100vh" }}>
        <SidebarContent mini />
      </aside>

      {/* Mobile drawer (account + everything) */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed right-0 top-0 bottom-0 z-50 w-72 bg-sidebar border-l border-sidebar-border md:hidden flex flex-col shadow-2xl overflow-y-auto">
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu"
              className="absolute right-3 top-3 w-10 h-10 flex items-center justify-center rounded-xl text-sidebar-muted hover:bg-sidebar-accent">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between h-14 border-b border-sidebar-border bg-sidebar px-4 flex-shrink-0">
          <Link href="/dashboard" aria-label="GarageMeet home"><Logo size={28} /></Link>
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded-xl">
            <Avatar name={displayName} seed={userId} size={34} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        {/* Mobile tab bar */}
        <nav aria-label="Primary" className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-[68px] bg-sidebar border-t border-sidebar-border flex items-stretch px-1 pb-[env(safe-area-inset-bottom)]">
          {tab("/dashboard", es ? "Garaje" : "Garage", House)}
          {tab("/projects", es ? "Proyectos" : "Projects", FolderKanban)}
          <div className="flex-1 flex items-center justify-center">
            <Link href="/cars/new" aria-label={es ? "Agregar vehículo" : "Add vehicle"}
              className="w-12 h-12 rounded-full bg-amber-500 text-on-accent flex items-center justify-center shadow-card active:scale-95 transition-transform">
              <Plus size={24} strokeWidth={2.4} />
            </Link>
          </div>
          {tab("/social", "Social", Users)}
          {tab("/receipts", es ? "Recibos" : "Receipts", Receipt, inboxCount)}
        </nav>
      </div>
    </div>
  );
}
