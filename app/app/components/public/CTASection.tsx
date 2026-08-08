import Link from "next/link";

export default function CTASection({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="px-5 py-20">
      <div className="max-w-2xl mx-auto bg-gradient-to-br from-amber-950/60 to-gray-900 border border-amber-500/20 rounded-3xl p-8 sm:p-10 text-center space-y-5">
        <div className="text-5xl">🤝</div>
        <h2 className="text-2xl sm:text-3xl font-bold">The Meet in GarageMeet</h2>
        <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
          Share public project highlights, keep receipts and private records locked down, and connect with the people who help keep your vehicles moving.
        </p>
        <Link href={signedIn ? "/dashboard" : "/register"} className="inline-flex items-center gap-2 bg-amber-500 text-gray-950 font-bold px-8 py-3.5 rounded-2xl text-sm hover:bg-amber-400 active:scale-95 transition-all">
          {signedIn ? "Return to Dashboard" : "Create Your Garage"}
        </Link>
      </div>
    </section>
  );
}
