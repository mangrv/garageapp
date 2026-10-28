import { getSession } from "@/lib/session";
import PublicHeader from "./components/public/PublicHeader";
import PublicFooter from "./components/public/PublicFooter";
import HeroSection from "./components/public/HeroSection";
import FeatureGrid from "./components/public/FeatureGrid";
import AboutSection from "./components/public/AboutSection";
import CTASection from "./components/public/CTASection";
import Glyph from "@/app/components/Glyph";

const FEATURES = [
  { icon: "🚗", title: "Garage inventory", desc: "Cars, trucks, bikes, mowers, trailers and equipment in one place, with specs, photos and documents." },
  { icon: "🔧", title: "Repair projects", desc: "Plan jobs in phases and tasks, track parts, photos, notes and costs, and see what needs attention next." },
  { icon: "🛠️", title: "Service history", desc: "Log maintenance by date, mileage, shop and cost, with the receipt attached, so the full story stays findable." },
  { icon: "📷", title: "Receipt scanning", desc: "Snap a receipt and AI reads the details, then file it to the right vehicle, job or service record." },
  { icon: "🛡️", title: "Warranty tracking", desc: "Keep warranty dates next to the parts and services they cover, with reminders before they run out." },
  { icon: "🌐", title: "Share on your terms", desc: "Post the builds you are proud of with clear audience controls. Everything else stays private." },
];

const ASSET_TYPES = [
  { emoji: "🚗", label: "Cars & trucks" },
  { emoji: "🚲", label: "Bicycles" },
  { emoji: "🚚", label: "Trailers" },
  { emoji: "🚜", label: "Riding mowers" },
  { emoji: "🧰", label: "Equipment" },
  { emoji: "🏍️", label: "Motorcycles (soon)" },
];

const STEPS = [
  { n: "1", title: "Add your vehicles", desc: "Enter a VIN or the year, make and model. Specs and recalls fill in automatically." },
  { n: "2", title: "Log as you go", desc: "Record service, scan receipts and plan repair jobs from your phone in the garage." },
  { n: "3", title: "Know what is next", desc: "See upcoming maintenance, open jobs and expiring warranties at a glance." },
];

export default async function LandingPage() {
  const session = await getSession();
  const signedIn = !!session;

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <PublicHeader signedIn={signedIn} />
      <HeroSection signedIn={signedIn} />

      <section className="px-5 py-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm text-gray-500 mb-5 font-medium">Track anything you wrench on</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {ASSET_TYPES.map((a) => (
              <span key={a.label} className="flex items-center gap-2 bg-gray-900 border border-gray-700 px-4 h-11 rounded-full text-sm font-medium text-gray-300 shadow-card">
                <Glyph e={a.emoji} className="text-amber-500" size={18} /> {a.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <FeatureGrid title="Everything your garage needs" subtitle="Useful records first. Community when you choose it." features={FEATURES} />

      <section className="px-5 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center">Up and running in minutes</h2>
          <ol className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-card">
                <span className="font-display w-10 h-10 rounded-xl bg-amber-900 text-amber-500 flex items-center justify-center text-lg font-bold">{s.n}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-[15px] text-gray-500 leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <AboutSection />
      <CTASection signedIn={signedIn} />
      <PublicFooter />
    </div>
  );
}
