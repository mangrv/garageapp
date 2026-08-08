"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";

export default function LoginClient({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOauthError(params.get("error"));
    setJustRegistered(params.get("registered") === "1");
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="text-5xl">🔧</div>
          <h1 className="text-2xl font-bold text-white">GarageMeet</h1>
          <p className="text-sm text-gray-500">Sign in to your account</p>
        </div>

        {justRegistered && (
          <div className="bg-emerald-900/40 border border-emerald-700 rounded-xl px-4 py-3 text-sm text-emerald-300 text-center">
            ✅ Account created! Sign in below to get started.
          </div>
        )}

        <Link
          href={"/api/auth/google/start?returnTo=" + encodeURIComponent(next)}
          className="w-full h-11 inline-flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold rounded-xl text-sm active:scale-95 transition-transform"
        >
          <span>🟢</span>
          Continue with Google
        </Link>

        {oauthError && (
          <p className="text-xs text-red-400 text-center -mt-3">
            Google sign-in failed ({oauthError}).
          </p>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center text-xs text-gray-600">
            <span className="bg-gray-950 px-2">or sign in with email</span>
          </div>
        </div>

        {/* Form */}
        <form action={action} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
              placeholder="••••••••"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-400 select-none">
            <input
              name="rememberMe"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
            />
            Remember me for 30 days
          </label>

          {state?.error && (
            <p className="text-sm text-red-400 text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-amber-500 text-gray-950 font-bold py-3 rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-transform mt-2"
          >
            {pending ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500">
          New to GarageMeet?{" "}
          <Link href="/register" className="text-amber-400 font-semibold hover:underline">
            Create a free account →
          </Link>
        </p>
      </div>
    </div>
  );
}
