"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";
import { CircleCheck } from "lucide-react";
import Logo from "@/app/components/brand/Logo";

export default function LoginClient({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOauthError(params.get("error"));
    setJustRegistered(params.get("registered") === "1");
  }, []);

  const input = "w-full h-12 bg-gray-900 border border-gray-700 rounded-xl px-4 text-[15px] text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-900";

  return (
    <div className="min-h-screen bg-gray-950 lg:grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-brand p-12" style={{ color: "#ffffff" }}>
        <Link href="/" aria-label="GarageMeet home"><Logo size={34} tone="inverse" /></Link>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Every vehicle. Every repair. One garage.</h2>
          <p className="text-lg leading-relaxed" style={{ color: "#d6ddff" }}>Service records, receipts and projects, ready on your phone when you are under the hood.</p>
        </div>
        <p className="text-sm" style={{ color: "#b9c5ff" }}>© {new Date().getFullYear()} GarageMeet</p>
      </aside>

      <main className="flex flex-col items-center justify-center px-6 py-12 min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-5">
            <Link href="/" aria-label="GarageMeet home" className="lg:hidden inline-block"><Logo size={32} /></Link>
            <div>
              <h1 className="text-[28px] font-bold text-white">Welcome back</h1>
              <p className="text-[15px] text-gray-500 mt-1">Sign in to your garage.</p>
            </div>
          </div>

          {justRegistered && (
            <div className="flex items-center gap-2 bg-emerald-900 border border-emerald-700/30 rounded-xl px-4 py-3 text-sm text-emerald-400">
              <CircleCheck size={18} /> Account created. Sign in below to get started.
            </div>
          )}

          <Link
            href={"/api/auth/google/start?returnTo=" + encodeURIComponent(next)}
            className="w-full h-12 inline-flex items-center justify-center gap-3 bg-gray-900 border border-gray-700 text-white font-semibold rounded-xl text-[15px] hover:bg-gray-800 transition-colors shadow-card"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </Link>

          {oauthError && (
            <p className="text-sm text-red-400 text-center -mt-2">Google sign-in failed ({oauthError}). Please try again.</p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700" /></div>
            <div className="relative flex justify-center text-sm text-gray-500">
              <span className="bg-gray-950 px-3">or use email</span>
            </div>
          </div>

          <form action={action} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <label className="block">
              <span className="block text-sm font-medium text-gray-300 mb-1.5">Email</span>
              <input name="email" type="email" autoComplete="email" required className={input} placeholder="you@example.com" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-300 mb-1.5">Password</span>
              <input name="password" type="password" autoComplete="current-password" required className={input} placeholder="Your password" />
            </label>

            <label className="flex items-center gap-2.5 text-sm text-gray-400 select-none">
              <input name="rememberMe" type="checkbox" defaultChecked className="h-4 w-4 rounded accent-[#2446f0]" />
              Keep me signed in for 30 days
            </label>

            {state?.error && <p className="text-sm text-red-400 text-center">{state.error}</p>}

            <button type="submit" disabled={pending}
              className="w-full h-12 bg-amber-500 text-on-accent font-semibold rounded-xl text-[15px] hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-[15px] text-center text-gray-500">
            New to GarageMeet?{" "}
            <Link href="/register" className="text-amber-500 font-semibold hover:underline">Create a free account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
