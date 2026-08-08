import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "./components/AppShell";
import { AppProviders } from "./providers/AppProviders";
import { GuestProvider } from "./providers/GuestProvider";
import GuestBanner from "./components/GuestBanner";
import AIAssistant from "./components/AIAssistant";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "GarageMeet",
  description: "Online car meets with friends. Track your garage, share service records, and connect with fellow enthusiasts.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false;
  let inboxCount = 0;
  let hasApiKey = false;
  let vehicles: { id: string; year: number; make: string; model: string; color: string | null; assetType: string }[] = [];
  try {
    const session = await getSession();
    if (session) {
      const [user, cars] = await Promise.all([
        (prisma.user as any).findUnique({
          where: { id: session.userId },
          select: { role: true, aiApiKey: true, aiModel: true },
        }),
        (prisma.car as any).findMany({
          where: { userId: session.userId },
          select: { id: true, year: true, make: true, model: true, color: true, assetType: true },
          orderBy: [{ year: "desc" }, { make: "asc" }],
        }),
      ]);
      isAdmin = (user as any)?.role === "admin";
      hasApiKey = !!(user as any)?.aiApiKey && (user as any)?.aiModel !== "disabled";
      inboxCount = await prisma.receipt.count({
        where: { userId: session.userId, status: "inbox" },
      });
      vehicles = cars;
    }
  } catch {
    // Not authenticated
  }

  return (
    <html lang="en" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('garage-theme') || 'dark';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        `}} />
        <script dangerouslySetInnerHTML={{ __html: `
          var _paq = window._paq = window._paq || [];
          _paq.push(['trackPageView']);
          _paq.push(['enableLinkTracking']);
          (function() {
            var u="https://analytics.jlikr.com/";
            _paq.push(['setTrackerUrl', u+'matomo.php']);
            _paq.push(['setSiteId', '34']);
            var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
            g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
          })();
        `}} />
      </head>
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased overflow-x-hidden">
        <AppProviders>
          <GuestProvider>
            <GuestBanner />
            <AppShell isAdmin={isAdmin} inboxCount={inboxCount} hasApiKey={hasApiKey}>
              {children}
            </AppShell>
            <AIAssistant />
          </GuestProvider>
        </AppProviders>
      </body>
    </html>
  );
}
