import type { Metadata } from "next";
import RegisterOpenForm from "./RegisterOpenForm";

export const metadata: Metadata = {
  title: "Create your free account",
  description: "Start your free GarageMeet garage: log maintenance, scan receipts, track warranties and plan repairs for every vehicle you own.",
  alternates: { canonical: "/register" },
  openGraph: { title: "Create your free account · GarageMeet", url: "/register" },
};
import Link from "next/link";
import Glyph from "@/app/components/Glyph";

export default function OpenRegisterPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="text-5xl"><Glyph e="🏎" /></div>
          <h1 className="text-2xl font-bold">Join GarageMeet</h1>
          <p className="text-sm text-gray-500">Free forever · No credit card</p>
        </div>

        <RegisterOpenForm />

        <p className="text-xs text-center text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-400 hover:underline">Sign in</Link>
        </p>
        <p className="text-xs text-center text-gray-700">
          By signing up you agree to use this responsibly and not be a jerk about it. <Glyph e="🙂" />
        </p>
      </div>
    </div>
  );
}
