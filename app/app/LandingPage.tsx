import { getSession } from "@/lib/session";
import PublicHeader from "./components/public/PublicHeader";
import PublicFooter from "./components/public/PublicFooter";
import HeroSection from "./components/public/HeroSection";
import FeatureGrid from "./components/public/FeatureGrid";
import AboutSection from "./components/public/AboutSection";
import CTASection from "./components/public/CTASection";

const FEATURES = [
  { icon: "🚗", title: "Garage Inventory", desc: "Cars, trucks, bikes, mowers, trailers, and equipment in one organized place with specs, photos, and documents." },
  { icon: "🔧", title: "Repair Projects", desc: "Track active jobs, phases, tasks, parts, photos, notes, costs, and what needs attention next." },
  { icon: "🛠️", title: "Service History", desc: "Log maintenance by date, mileage, vendor, cost, and linked receipt so the full story stays findable." },
  { icon: "📷", title: "Receipt Scanning", desc: "Use AI to extract receipt details, then file them to the right vehicle, job, or service record." },
  { icon: "🛡️", title: "Warranty Tracking", desc: "Keep warranty dates and documents close to the parts and service records they belong to." },
  { icon: "🌐", title: "Social Sharing", desc: "Share selected projects with clear audience controls while private garage data stays private." },
];

const ASSET_TYPES = [
  { emoji: "🚗", label: "Cars & Trucks" },
  { emoji: "🚲", label: "Bicycles" },
  { emoji: "🚚", label: "Trailers" },
  { emoji: "🚜", label: "Riding Mowers" },
  { emoji: "🧰", label: "Equipment" },
  { emoji: "🏍️", label: "Motorcycles*" },
];

export default async function LandingPage() {
  const session = await getSession();
  const signedIn = !!session;

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <PublicHeader signedIn={signedIn} />
      <HeroSection signedIn={signedIn} />

      <section className="border-y border-gray-800/60 bg-gray-900/40 py-5 px-5">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-xs text-gray-600 mb-4 uppercase tracking-widest font-medium">Track anything you wrench on</p>
          <div className="flex flex-wrap justify-center gap-3">
            {ASSET_TYPES.map((a) => (
              <span key={a.label} className="flex items-center gap-2 bg-gray-800 border border-gray-700/60 px-3.5 py-2 rounded-xl text-sm font-medium text-gray-300">
                <span className="text-base">{a.emoji}</span> {a.label}
              </span>
            ))}
          </div>
          <p className="text-center text-[11px] text-gray-700 mt-3">* Coming soon</p>
        </div>
      </section>

      <FeatureGrid title="Everything your garage needs" subtitle="Useful records first, community when you choose it" features={FEATURES} />
      <AboutSection />
      <CTASection signedIn={signedIn} />
      <PublicFooter />
    </div>
  );
}
