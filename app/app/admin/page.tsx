"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Invite = {
  id: string;
  token: string;
  email: string | null;
  usedById: string | null;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
  createdBy: { name: string | null; email: string };
};

type Connection = {
  id: string;
  status: string;
  accessLevel: string;
  requester: { id: string; name: string | null; email: string };
  addressee: { id: string; name: string | null; email: string };
};

export default function AdminPage() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [accessLevel, setAccessLevel] = useState<"view" | "full">("full");
  const [generating, startTransition] = useTransition();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  async function loadInvites() {
    const res = await fetch("/api/admin/invites");
    if (res.status === 403) { router.push("/"); return; }
    const data = await res.json();
    if (data.invites) setInvites(data.invites);
    setLoading(false);
  }

  async function loadConnections() {
    const res = await fetch("/api/connections");
    const data = await res.json().catch(() => ({}));
    if (data.connections) setConnections(data.connections);
  }

  async function setConnectionAccess(id: string, accessLevel: "view" | "full") {
    await fetch(`/api/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessLevel }),
    });
    await loadConnections();
  }

  async function removeConnection(id: string) {
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    await loadConnections();
  }

  useEffect(() => { loadInvites(); loadConnections(); }, []);

  const handleGenerate = () => {
    startTransition(async () => {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput || null, accessLevel }),
      });
      if (!res.ok) { setError("Failed to generate invite"); return; }
      const data = await res.json();
      setGeneratedUrl(data.url);
      setEmailInput("");
      await loadInvites();
    });
  };

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
      await loadInvites();
    });
  };

  const BASE = typeof window !== "undefined" ? window.location.origin : "https://garage.jorgeiglesias.com";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/dashboard" className="text-gray-500 text-lg">←</a>
        <h1 className="text-xl font-bold">🔐 Admin Panel</h1>
      </div>

      {/* Generate invite */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 space-y-3">
        <div className="text-sm font-bold text-white">Generate Invite Link</div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Restrict to email (optional)</label>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="user@example.com or leave blank"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2">Garage access level</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAccessLevel("view")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                accessLevel === "view"
                  ? "bg-sky-600 border-sky-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-400"
              }`}
            >
              👁 View only
            </button>
            <button
              type="button"
              onClick={() => setAccessLevel("full")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                accessLevel === "full"
                  ? "bg-amber-500 border-amber-400 text-gray-950"
                  : "bg-gray-800 border-gray-700 text-gray-400"
              }`}
            >
              🔧 Full access
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {accessLevel === "full"
              ? "Can add service records, jobs, and receipts to your garage."
              : "Can view your cars and service history, but cannot make changes."}
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-amber-500 text-gray-950 font-bold py-2.5 rounded-xl text-sm disabled:opacity-40"
        >
          {generating ? "Generating…" : "✉️ Generate Invite Link"}
        </button>

        {generatedUrl && (
          <div className="bg-gray-800 border border-emerald-700 rounded-xl p-3 space-y-2">
            <div className="text-xs text-gray-400">Invite link (expires in 7 days):</div>
            <div className="font-mono text-xs text-emerald-300 break-all">{generatedUrl}</div>
            <button
              onClick={() => handleCopy(generatedUrl)}
              className="text-xs bg-emerald-700 text-white px-3 py-1.5 rounded-lg"
            >
              {copied ? "✓ Copied!" : "📋 Copy link"}
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Invites list */}
      <div className="space-y-3">
        <div className="text-sm font-bold text-white">All Invites</div>
        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        {!loading && invites.length === 0 && (
          <p className="text-gray-600 text-sm">No invites yet.</p>
        )}
        {invites.map((inv) => {
          const used = !!inv.usedById;
          const expired = !used && new Date(inv.expiresAt) < new Date();
          const url = `${BASE}/register/${inv.token}`;

          return (
            <div key={inv.id} className={`bg-gray-900 border rounded-xl p-4 space-y-2 ${used ? "border-gray-700 opacity-60" : expired ? "border-red-900" : "border-gray-700"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${used ? "bg-emerald-800 text-emerald-200" : expired ? "bg-red-900 text-red-300" : "bg-blue-900 text-blue-200"}`}>
                    {used ? "Used" : expired ? "Expired" : "Active"}
                  </span>
                  {inv.email && <span className="text-xs text-gray-400">→ {inv.email}</span>}
                </div>
                {!used && (
                  <button onClick={() => handleRevoke(inv.id)} className="text-xs text-red-500 hover:text-red-400">Revoke</button>
                )}
              </div>
              <div className="font-mono text-xs text-gray-500 break-all">{url}</div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Expires: {new Date(inv.expiresAt).toLocaleDateString()}</span>
                <button onClick={() => handleCopy(url)} className="text-xs text-gray-400 hover:text-gray-300">📋 Copy</button>
              </div>
              {inv.usedAt && (
                <div className="text-xs text-gray-600">Used: {new Date(inv.usedAt).toLocaleDateString()}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Connections manager */}
      <div className="space-y-3 mt-8">
        <div className="text-sm font-bold text-white">🤝 Connections & Access</div>
        {connections.length === 0 && (
          <p className="text-gray-600 text-sm">No connections yet.</p>
        )}
        {connections.map((conn) => (
          <div key={conn.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium text-white">
                  {conn.requester.name ?? conn.requester.email}
                  <span className="text-gray-500 mx-1.5">→</span>
                  {conn.addressee.name ?? conn.addressee.email}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{conn.addressee.email}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                conn.status === "accepted"
                  ? conn.accessLevel === "full" ? "bg-amber-900/50 text-amber-300" : "bg-sky-900/50 text-sky-300"
                  : "bg-gray-800 text-gray-400"
              }`}>
                {conn.accessLevel === "full" ? "🔧 Full" : "👁 View"}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConnectionAccess(conn.id, "view")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  conn.accessLevel === "view"
                    ? "bg-sky-600 border-sky-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-400"
                }`}
              >
                👁 View only
              </button>
              <button
                onClick={() => setConnectionAccess(conn.id, "full")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  conn.accessLevel === "full"
                    ? "bg-amber-500 border-amber-400 text-gray-950"
                    : "bg-gray-800 border-gray-700 text-gray-400"
                }`}
              >
                🔧 Full access
              </button>
              <button
                onClick={() => removeConnection(conn.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 border border-gray-700 text-red-400 hover:bg-red-900/30 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
