import Link from "next/link";
import Logo from "@/app/components/brand/Logo";

export default function PublicFooter() {
  return (
    <footer className="border-t border-gray-700 px-5 py-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5 text-sm text-gray-500">
        <Logo size={26} />
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/login" className="hover:text-white">Sign in</Link>
          <Link href="/register" className="hover:text-white">Create account</Link>
          <Link href="/guest" className="hover:text-white">Try as guest</Link>
        </nav>
        <p>© {new Date().getFullYear()} GarageMeet<span aria-hidden="true"> · </span>Built by <a href="https://iglesiastech.com/" data-company-credit className="hover:text-white">Iglesias Tech LLC</a></p>
      </div>
    </footer>
  );
}
