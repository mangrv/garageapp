"use client";

import { useState, useTransition } from "react";

type Status = "none" | "pending_sent" | "pending_received" | "accepted" | "self";

interface ConnectButtonProps {
  username: string;
  initialStatus: Status;
  isLoggedIn: boolean;
}

export default function ConnectButton({ username, initialStatus, isLoggedIn }: ConnectButtonProps) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <a
        href={`/login`}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-gray-950 font-bold text-sm hover:bg-amber-400 transition-colors"
      >
        🤝 Sign in to Connect
      </a>
    );
  }

  if (status === "self") return null;

  if (status === "accepted") {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-900/50 border border-emerald-700/50 text-emerald-300 text-sm font-semibold">
        ✓ Connected
      </span>
    );
  }

  if (status === "pending_sent") {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-amber-400 text-sm font-medium">
        ⏳ Request sent
      </span>
    );
  }

  if (status === "pending_received") {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-900/30 border border-amber-700/40 text-amber-300 text-sm font-medium">
        🔔 Sent you a request — check <a href="/friends" className="underline">Friends</a>
      </span>
    );
  }

  // status === "none"
  const handleConnect = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/connections/request-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        setStatus("pending_sent");
      } else {
        const d = await res.json().catch(() => ({}));
        if (d.status === "accepted") { setStatus("accepted"); return; }
        if (d.status === "pending") { setStatus("pending_sent"); return; }
        setError(d.error ?? "Failed to send request");
      }
    });
  };

  return (
    <div className="space-y-1">
      <button
        onClick={handleConnect}
        disabled={pending}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-gray-950 font-bold text-sm hover:bg-amber-400 active:scale-95 transition-all disabled:opacity-40"
      >
        {pending ? "Sending…" : "🤝 Connect"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
