import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AppShell from "./components/AppShell";
import { AppProviders } from "./providers/AppProviders";
import { GuestProvider } from "./providers/GuestProvider";
import GuestBanner from "./components/GuestBanner";
import AIAssistant from "./components/AIAssistant";
import MatomoTracker from "./components/MatomoTracker";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const plex = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/ibm-plex-sans-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-plex",
  display: "swap",
});
const grotesk = localFont({ src: "./fonts/space-grotesk-latin-wght-normal.woff2", weight: "300 700", variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://garagemeet.com"),
  title: { default: "GarageMeet", template: "%s · GarageMeet" },
  description: "Service history, receipts, warranties and projects for every vehicle you own — and a place to share the builds you are proud of.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "GarageMeet", statusBarStyle: "default" },
  openGraph: { siteName: "GarageMeet", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let isAdmin = false;
  let inboxCount = 0;
  let hasApiKey = false;
  let userName: string | null = null;
  let userId: string | null = null;
  let vehicles: { id: string; year: number; make: string; model: string; color: string | null; assetType: string }[] = [];
  try {
    const session = await getSession();
    if (session) {
      userName = session.name || session.email;
      userId = session.userId;
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
    <html lang="en" data-theme="light" className={`${plex.variable} ${grotesk.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('garage-theme') || 'light';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e) {}
        `}} />
        <script dangerouslySetInnerHTML={{ __html: `
          var _paq = window._paq = window._paq || [];
          _paq.push(['disableCookies']);
          (function() {
            var u="https://analytics.jlikr.com/";
            _paq.push(['setTrackerUrl', u+'matomo.php']);
            _paq.push(['setSiteId', '34']);
            var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
            g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
          })();
        `}} />
      </head>
      <body className="bg-gray-950 text-white min-h-screen antialiased overflow-x-hidden">
        <Suspense fallback={null}>
          <MatomoTracker userId={userId} />
        </Suspense>
        <AppProviders>
          <GuestProvider>
            <GuestBanner />
            <AppShell isAdmin={isAdmin} inboxCount={inboxCount} hasApiKey={hasApiKey} userName={userName} userId={userId}>
              {children}
            </AppShell>
            <AIAssistant />
          </GuestProvider>
        </AppProviders>
      </body>
    </html>
  );
}
