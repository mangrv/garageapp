import Link from "next/link";
import { ArrowRight, Wrench, Receipt, ShieldCheck } from "lucide-react";

export default function HeroSection({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="px-4 sm:px-5 pt-4 sm:pt-6">
      <div className="max-w-6xl mx-auto bg-brand rounded-[28px] px-6 sm:px-12 py-12 sm:py-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div className="space-y-6 text-[#ffffff]">
          <h1 className="text-4xl sm:text-[56px] font-bold leading-[1.05]" style={{ letterSpacing: "-0.035em" }}>
            Know your car like your mechanic does.
          </h1>
          <p className="text-lg leading-relaxed max-w-xl" style={{ color: "#d6ddff" }}>
            Service history, receipts, warranties and repair projects for every vehicle you own — organized, searchable and ready when you sell.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link href={signedIn ? "/dashboard" : "/register"}
              className="h-12 inline-flex items-center justify-center gap-2 rounded-full px-7 text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#ffffff", color: "#1a33b8" }}>
              {signedIn ? "Open my garage" : "Start your garage — free"} <ArrowRight size={18} />
            </Link>
            {!signedIn && (
              <Link href="/login" className="h-12 inline-flex items-center justify-center rounded-full px-7 text-base font-semibold border transition-colors hover:bg-[rgba(255,255,255,0.1)]"
                style={{ borderColor: "rgba(255,255,255,0.4)", color: "#ffffff" }}>
                Sign in
              </Link>
            )}
          </div>
          <p className="text-sm" style={{ color: "#b9c5ff" }}>Free account · Guest mode available · Works on any device</p>
        </div>

        <div aria-hidden="true" className="hidden sm:block">
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "#ffffff", color: "#0e1a2b", boxShadow: "0 30px 60px rgba(8, 20, 90, 0.35)" }}>
            <div className="flex items-center justify-between">
              <span className="font-display font-semibold text-lg">My garage</span>
              <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: "#eef1fe", color: "#1a33b8" }}>Example</span>
            </div>
            {[
              { title: "2019 Toyota Tacoma", meta: "64,210 mi", chip: "Oil change due in 400 mi", tone: ["#fef3c7", "#92400e"], Icon: Wrench },
              { title: "2016 Honda Civic", meta: "Receipt filed today", chip: "Brake pads · $189", tone: ["#e6f4ef", "#047857"], Icon: Receipt },
              { title: "2021 Ford F-150", meta: "Warranty", chip: "Battery covered to 2027", tone: ["#eef1fe", "#1a33b8"], Icon: ShieldCheck },
            ].map(({ title, meta, chip, tone, Icon }) => (
              <div key={title} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "#f3f6fb" }}>
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: tone[0], color: tone[1] }}><Icon size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-semibold text-[15px]">{title}</span>
                  <span className="block text-[13px]" style={{ color: "#576478" }}>{meta}</span>
                </span>
                <span className="text-xs font-semibold rounded-lg px-2 py-1 whitespace-nowrap" style={{ background: tone[0], color: tone[1] }}>{chip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
