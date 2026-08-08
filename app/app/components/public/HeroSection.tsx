import Link from "next/link";

export default function HeroSection({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="relative px-5 pt-16 pb-20 text-center overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full">
          🏎️ Online Car Meets · Private Garage Records
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
          GarageMeet
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
          Track every vehicle you own, log repairs and service history, scan receipts, protect documents, and share selected projects with your community.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href={signedIn ? "/dashboard" : "/register"} className="inline-flex items-center justify-center gap-2 bg-amber-500 text-gray-950 font-bold px-8 py-4 rounded-2xl text-base hover:bg-amber-400 active:scale-95 transition-all shadow-lg shadow-amber-500/20">
            {signedIn ? "Go to Dashboard" : "Start Your Garage"}
            <span>→</span>
          </Link>
          <Link href={signedIn ? "/social" : "/login"} className="inline-flex items-center justify-center gap-2 bg-gray-800 text-gray-300 font-semibold px-8 py-4 rounded-2xl text-base hover:bg-gray-700 transition-colors border border-gray-700">
            {signedIn ? "Open Social" : "Sign In"}
          </Link>
        </div>
        <p className="text-xs text-gray-600">Free account · Guest mode available · Works on any device</p>
      </div>
    </section>
  );
}
