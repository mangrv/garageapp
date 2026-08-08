"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RegisterOpenForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const googleHref = `/api/auth/google/start?returnTo=/onboarding`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    startTransition(async () => {
      const res = await fetch("/api/auth/register-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed."); return; }
      router.push(data.redirect ?? "/onboarding");
    });
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm";
  const labelCls = "block text-xs text-gray-400 mb-1";

  return (
    <div className="space-y-4">
      {/* Google */}
      <a href={googleHref}
        className="flex items-center justify-center gap-3 w-full bg-white text-gray-900 font-semibold py-3 rounded-xl text-sm hover:bg-gray-100 transition-colors">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </a>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-800" />
        <span className="text-xs text-gray-600">or with email</span>
        <div className="flex-1 h-px bg-gray-800" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelCls}>Your name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Jorge Iglesias" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Password (min 8 chars)</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Confirm password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••" required className={inputCls} />
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300">{error}</div>
        )}

        <button type="submit" disabled={pending}
          className="w-full bg-amber-500 text-gray-950 font-bold py-3 rounded-xl text-sm disabled:opacity-40 active:scale-95 transition-transform">
          {pending ? "Creating account…" : "Create Free Account →"}
        </button>
      </form>
    </div>
  );
}
