import Link from "next/link";
import Logo from "@/app/components/brand/Logo";

export default function PublicHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-gray-700/70 px-5">
      <div className="max-w-6xl mx-auto h-16 flex items-center justify-between gap-4">
        <Link href="/" aria-label="GarageMeet home" className="shrink-0"><Logo size={28} /></Link>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className="h-11 inline-flex items-center text-[15px] font-semibold bg-amber-500 text-on-accent px-5 rounded-full hover:bg-amber-600 transition-colors">
              Open my garage
            </Link>
          ) : (
            <>
              <Link href="/login" className="h-11 inline-flex items-center whitespace-nowrap text-[15px] font-semibold text-gray-300 hover:text-white px-3 sm:px-4 rounded-full hover:bg-gray-800 transition-colors">
                Sign in
              </Link>
              <Link href="/register" className="h-11 inline-flex items-center whitespace-nowrap text-[15px] font-semibold bg-amber-500 text-on-accent px-4 sm:px-5 rounded-full hover:bg-amber-600 transition-colors">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
