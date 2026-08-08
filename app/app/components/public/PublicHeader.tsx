import Link from "next/link";

export default function PublicHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-gray-800/60 px-5 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🏎️</span>
          <span className="font-bold text-base text-white">GarageMeet</span>
        </Link>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard" className="text-sm font-bold bg-amber-500 text-gray-950 px-4 py-2 rounded-xl hover:bg-amber-400 transition-colors active:scale-95">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block text-sm text-gray-400 hover:text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors">
                Sign in
              </Link>
              <Link href="/register" className="text-sm font-bold bg-amber-500 text-gray-950 px-4 py-2 rounded-xl hover:bg-amber-400 transition-colors active:scale-95">
                Get Started Free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
