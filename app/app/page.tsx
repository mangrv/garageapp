import type { Metadata } from "next";
import LandingPage from "./LandingPage";

export const metadata: Metadata = {
  title: { absolute: "GarageMeet — Car maintenance log, service history & receipts" },
  description: "Track service history, scan receipts, follow warranties and plan repair projects for every vehicle you own. Free car maintenance log for owners and weekend mechanics.",
  alternates: { canonical: "/" },
  openGraph: { title: "GarageMeet — Car maintenance log, service history & receipts", description: "Track service history, scan receipts, follow warranties and plan repair projects for every vehicle you own. Free car maintenance log for owners and weekend mechanics.", url: "/" },
};

export default function Home() {
  return <LandingPage />;
}
