"use client";

import { useEffect, useState, useTransition } from "react";
import { useT } from "@/app/hooks/useT";

type UserResult = { id: string; name: string | null; email: string };
type Connection = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: string;
  accessLevel: string;
  createdAt: string;
  requester: { id: string; name: string | null; email: string };
  addressee: { id: string; name: string | null; email: string };
  // Server-annotated — always correct, no client-side guessing
  friendId: string;
  friendName: string | null;
  friendEmail: string;
};

const PROMO_MESSAGE = (url: string) =>
  `Hey! Check out this app I built — GarageMeet 🚗🔧\n\nYou can track your vehicles, manage repairs, log service history, and more. Browse as a guest or register free to get the full experience.\n\n👉 ${url}`;

export default function FriendsPage() {
  const t = useT();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  async function loadConnections() {
    const res = await fetch("/api/connections");
    if (!res.ok) return;
    const data = await res.json();
    setConnections(data.connections ?? []);
    setMyId(data.myId ?? null);
    setLoading(false);
  }

  useEffect(() => { loadConnections(); }, []);

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQ)}`);
      const data = await res.json();
      setSearchResults(data.users ?? []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQ]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  const sendRequest = (addresseeId: string) => {
    startTransition(async () => {
      const res = await fetch("/api/connections/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresseeId }),
      });
      if (res.ok) {
        showFlash(t("sent"));
        setSearchQ("");
        setSearchResults([]);
        await loadConnections();
      } else {
        const d = await res.json();
        showFlash(d.error ?? "Failed to send request");
      }
    });
  };

  const updateConnection = (id: string, data: object) => {
    startTransition(async () => {
      await fetch(`/api/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      await loadConnections();
    });
  };

  const deleteConnection = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/connections/${id}`, { method: "DELETE" });
      await loadConnections();
    });
  };

  const handleInvite = async () => {
    setInviteLoading(true);
    try {
      const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      const message = PROMO_MESSAGE(data.url);
      if (navigator.share) {
        try {
          await navigator.share({ text: message, title: "GarageMeet" });
          setInviteCopied(true);
          setTimeout(() => setInviteCopied(false), 3000);
          return;
        } catch { /* fall through to clipboard */ }
      }
      await navigator.clipboard.writeText(message);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    } catch {
      showFlash("Failed to generate invite link");
    } finally {
      setInviteLoading(false);
    }
  };

  const myConnections = connections.filter(
    (c) => c.status === "accepted" && (c.requesterId === myId || c.addresseeId === myId)
  );
  const pendingSent = connections.filter((c) => c.status === "pending" && c.requesterId === myId);
  const pendingReceived = connections.filter((c) => c.status === "pending" && c.addresseeId === myId);

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/dashboard" className="text-gray-500 text-lg">←</a>
        <h1 className="text-xl font-bold">{t("friends")}</h1>
      </div>

      {/* Invite a friend */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white">Invite a Friend</div>
            <div className="text-xs text-gray-500 mt-0.5">Generate a link — they can sign up or browse as a guest</div>
          </div>
          <button
            onClick={handleInvite}
            disabled={inviteLoading}
            className="flex-shrink-0 flex items-center gap-2 bg-amber-500 text-gray-950 font-bold text-sm px-4 py-2.5 rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
          >
            {inviteLoading ? "…" : inviteCopied ? "✅ Copied!" : "📋 Copy Invite"}
          </button>
        </div>
        {inviteCopied && (
          <div className="mt-3 bg-emerald-900/30 border border-emerald-700/40 rounded-xl px-3 py-2 text-xs text-emerald-300">
            Message + link copied! Paste it anywhere — iMessage, WhatsApp, email, etc.
          </div>
        )}
      </div>

      {flash && (
        <div className="mb-4 bg-emerald-900/40 border border-emerald-700 rounded-xl px-4 py-2 text-sm text-emerald-300">
          {flash}
        </div>
      )}

      {/* Search */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 space-y-3">
        <div className="text-sm font-bold text-white">Find Users</div>
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search by name or email…"
          className={inputCls}
        />
        {searching && <p className="text-xs text-gray-500">{t("loading")}</p>}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((u) => {
              const alreadyConnected = connections.some(
                (c) => (c.requesterId === u.id || c.addresseeId === u.id)
              );
              return (
                <div key={u.id} className="flex items-center justify-between bg-gray-800 rounded-xl p-3">
                  <div>
                    <div className="text-sm font-medium">{u.name ?? "Unnamed"}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                  {alreadyConnected ? (
                    <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">{t("accepted")}</span>
                  ) : (
                    <button
                      onClick={() => sendRequest(u.id)}
                      disabled={pending}
                      className="text-xs bg-amber-500 text-gray-950 font-bold px-3 py-1.5 rounded-lg disabled:opacity-40"
                    >
                      + Connect
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending received */}
      {pendingReceived.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="text-sm font-bold text-white">{t("pendingRequests")}</div>
          {pendingReceived.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-amber-800/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-900/40 flex items-center justify-center text-base flex-shrink-0">
                  {(c.requester.name ?? c.requester.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{c.requester.name ?? "Unnamed"}</div>
                  <div className="text-xs text-gray-500 truncate">{c.requester.email}</div>
                </div>
                <span className="flex-shrink-0 text-xs text-amber-400 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded-full ml-auto">Pending</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateConnection(c.id, { status: "accepted" })}
                  disabled={pending}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs py-2 rounded-xl transition-colors disabled:opacity-40"
                >
                  ✓ Accept
                </button>
                <button
                  onClick={() => deleteConnection(c.id)}
                  disabled={pending}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs py-2 rounded-xl transition-colors disabled:opacity-40"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingSent.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="text-sm font-bold text-white">⏳ Sent Requests</div>
          {pendingSent.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-base flex-shrink-0">
                  {(c.addressee.name ?? c.addressee.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{c.addressee.name ?? "Unnamed"}</div>
                  <div className="text-xs text-gray-500 truncate">{c.addressee.email}</div>
                </div>
                <span className="flex-shrink-0 text-xs text-amber-400 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded-full ml-auto">Awaiting</span>
              </div>
              <button
                onClick={() => deleteConnection(c.id)}
                disabled={pending}
                className="w-full border border-red-900/40 text-red-500 hover:bg-red-900/20 text-xs font-medium py-2 rounded-xl transition-colors disabled:opacity-40"
              >
                Cancel Request
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Accepted connections */}
      <div className="space-y-3">
        <div className="text-sm font-bold text-white">✅ My Connections</div>
        {loading && <p className="text-gray-500 text-sm">Loading…</p>}
        {!loading && myConnections.length === 0 && (
          <p className="text-gray-600 text-sm">No connections yet. Search for users above to get started.</p>
        )}
        {myConnections.map((c) => {
          const iAmRequester = c.requesterId === myId;

          return (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              {/* Row 1: Avatar + name/email */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-base flex-shrink-0">
                  {(c.friendName ?? c.friendEmail).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{c.friendName ?? "Unnamed"}</div>
                  <div className="text-xs text-gray-500 truncate">{c.friendEmail}</div>
                </div>
              </div>

              {/* Row 2: Status badge + access selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-700/40 px-2.5 py-1 rounded-full font-medium">
                  ✓ Connected
                </span>
                {iAmRequester ? (
                  <select
                    value={c.accessLevel}
                    onChange={(e) => updateConnection(c.id, { accessLevel: e.target.value })}
                    disabled={pending}
                    className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1 text-gray-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="view">View only</option>
                    <option value="full">Full access</option>
                  </select>
                ) : (
                  <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg capitalize">
                    {c.accessLevel === "full" ? "Full access" : "View only"}
                  </span>
                )}
              </div>

              {/* Row 3: Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`/garage/${c.friendId}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                >
                  🚗 View Garage
                </a>
                <button
                  onClick={() => deleteConnection(c.id)}
                  disabled={pending}
                  className="flex items-center justify-center gap-1 border border-red-900/40 text-red-500 hover:text-red-400 hover:bg-red-900/20 text-xs font-medium px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
