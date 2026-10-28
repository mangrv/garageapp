import Link from "next/link";
import { LogoMark } from "@/app/components/brand/Logo";

export default function CTASection({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="px-4 sm:px-5 pb-16">
      <div className="max-w-6xl mx-auto rounded-[28px] px-8 py-12 sm:py-14 text-center space-y-5" style={{ background: "#0e1a2b", color: "#ffffff" }}>
        <LogoMark size={52} color="#7c93ff" className="mx-auto" />
        <h2 className="text-2xl sm:text-4xl font-bold">The meet in GarageMeet</h2>
        <p className="text-base leading-relaxed max-w-lg mx-auto" style={{ color: "#c5ccda" }}>
          Share project highlights publicly, keep receipts and private records locked down, and connect with the people who help keep your vehicles moving.
        </p>
        <Link href={signedIn ? "/dashboard" : "/register"} className="h-12 inline-flex items-center rounded-full px-7 text-base font-semibold bg-brand hover:opacity-90 transition-opacity" style={{ color: "#ffffff" }}>
          {signedIn ? "Open my garage" : "Create your garage"}
        </Link>
      </div>
    </section>
  );
}
