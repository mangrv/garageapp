"use client";

import { useState } from "react";
import { useApp } from "@/app/providers/AppProviders";
import { useT } from "@/app/hooks/useT";
import { useRouter } from "next/navigation";
import {
  Moon, Sun, Key, Cpu, Home, LogOut, Shield, Brain,
  ChevronLeft, Check, AlertCircle, ArrowLeft, Download, Lock
} from "lucide-react";
import Glyph from "@/app/components/Glyph";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  name: string;
  displayName: string;
  email: string;
  aiModel: string;
  aiApiKeySet: boolean;
  aiApiKeyMasked: string | null;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60 transition-colors";

const sectionCls = "bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden";
const sectionHeaderCls = "px-5 py-4 border-b border-gray-800";
const sectionBodyCls = "px-5 py-4 space-y-4";

// ── Model catalog (for custom key users) ─────────────────────────────────────

const CUSTOM_MODELS = [
  { id: "qwen3.5:27b-q4_K_M", label: "Qwen 3.5 27B", sublabel: "Ollama local · Server default", provider: "ollama" },
] as const;

type CustomModelId = (typeof CUSTOM_MODELS)[number]["id"];

// ── Section: AI Model ─────────────────────────────────────────────────────────

function AppearanceSection() {
  const { theme, toggleTheme, lang, setLang } = useApp();
  const t = useT();

  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <h2 className="font-semibold text-white text-sm">Appearance</h2>
      </div>
      <div className={sectionBodyCls}>
        <div>
          <p className="text-xs text-gray-400 font-medium mb-2">Theme</p>
          <div className="flex gap-2">
            <button
              onClick={() => theme !== "dark" && toggleTheme()}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400"
              }`}
            >
              <Moon size={15} /> Dark
            </button>
            <button
              onClick={() => theme !== "light" && toggleTheme()}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                theme === "light" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400"
              }`}
            >
              <Sun size={15} /> Light
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium mb-2">Language</p>
          <div className="flex gap-2">
            <button
              onClick={() => setLang("en")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                lang === "en" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLang("es")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                lang === "es" ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-800 border-gray-700 text-gray-400"
              }`}
            >
              Español
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIModelSection({
  initialModel,
  initialKeySet,
  initialKeyMasked,
}: {
  initialModel: string;
  initialKeySet: boolean;
  initialKeyMasked: string | null;
}) {
  const usingDefault = initialModel === "default" && !initialKeySet;
  const [useCustomKey, setUseCustomKey] = useState(initialKeySet || initialModel !== "default");
  const [selectedModel, setSelectedModel] = useState<CustomModelId>(
    (CUSTOM_MODELS.find((m) => m.id === initialModel)?.id ?? "qwen3.5:27b-q4_K_M") as CustomModelId
  );
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keySet, setKeySet] = useState(initialKeySet);
  const [keyMasked, setKeyMasked] = useState(initialKeyMasked);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const selectedProvider = CUSTOM_MODELS.find((m) => m.id === selectedModel)?.provider ?? "ollama";
  const selectedNeedsKey = selectedProvider !== "ollama";

  // Auto-detect provider from key prefix

  async function saveCustom() {
    if (selectedNeedsKey && !keySet && !apiKeyInput.trim()) {
      setMsg({ text: "Enter your API key first", type: "err" });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, any> = { aiModel: selectedModel };
      if (selectedProvider === "ollama") body.clearApiKey = true;
      else if (apiKeyInput.trim()) body.aiApiKey = apiKeyInput.trim();
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      if (selectedProvider === "ollama") {
        setKeySet(false);
        setKeyMasked(null);
        setApiKeyInput("");
      } else if (apiKeyInput.trim()) {
        setKeySet(true);
        setKeyMasked("••••••••••••" + apiKeyInput.trim().slice(-4));
        setApiKeyInput("");
      }
      setMsg({ text: selectedProvider === "ollama" ? "Saved — using local Ollama" : "Saved — using your custom key", type: "ok" });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg({ text: "Failed to save", type: "err" });
    } finally {
      setSaving(false);
    }
  }

  async function revertToDefault() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearApiKey: true, aiModel: "default" }),
      });
      setKeySet(false);
      setKeyMasked(null);
      setApiKeyInput("");
      setUseCustomKey(false);
      setMsg({ text: "Switched back to GarageMeet AI", type: "ok" });
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <h2 className="font-semibold text-white text-sm">AI Model</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          GarageMeet AI is routed through the server-configured local Ollama provider.
        </p>
      </div>
      <div className={sectionBodyCls}>

        {/* Default tile — always visible */}
        <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors ${
          !useCustomKey
            ? "bg-amber-500/10 border-amber-500/50"
            : "bg-gray-800 border-gray-700"
        }`}>
          <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-gray-800 border border-gray-700 text-gray-400">
            <Home size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-semibold ${!useCustomKey ? "text-amber-400" : "text-gray-300"}`}>
              GarageMeet AI
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Server default · Included · No key needed</div>
          </div>
          {!useCustomKey && (
            <span className="flex items-center gap-1 text-amber-400 text-xs font-semibold flex-shrink-0">
              <Check size={14} /> Active
            </span>
          )}
          {useCustomKey && (
            <button
              onClick={revertToDefault}
              disabled={saving}
              className="text-xs text-gray-400 border border-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
            >
              Use this
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600">local provider</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Custom key section */}
        {!useCustomKey ? (
          <button
            onClick={() => setUseCustomKey(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-700 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
          >
            <Key size={15} className="flex-shrink-0" /> Choose local AI provider
          </button>
        ) : (
          <div className="space-y-3">
            {/* Key input / status */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-300">Your API Key</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Uses server-configured Ollama endpoint
                  </p>
                </div>
                {keySet && (
                  <button
                    onClick={revertToDefault}
                    disabled={saving}
                    className="text-xs text-red-400 border border-red-700/40 px-2.5 py-1.5 rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="No API key needed"
                disabled={!selectedNeedsKey}
                className={`${inputCls} ${!selectedNeedsKey ? "opacity-60" : ""}`}
                autoComplete="off"
              />
              <p className="text-[11px] text-gray-600">
                <Shield size={12} className="flex-shrink-0 mt-0.5" /> Local OpenAI-compatible endpoint · Server configured
              </p>
            </div>

            {/* Model picker */}
            <div>
              <p className="text-xs text-gray-400 font-medium mb-2">Model</p>
              <div className="grid grid-cols-1 gap-2">
                {CUSTOM_MODELS.map((model) => {
                  const active = selectedModel === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id as CustomModelId)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                        active
                          ? "bg-amber-500/10 border-amber-500/50 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                      }`}
                    >
                      <span className="w-6 flex-shrink-0 flex items-center justify-center text-gray-400">
                        <Cpu size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${active ? "text-amber-400" : "text-gray-200"}`}>
                          {model.label}
                        </div>
                        <div className="text-xs text-gray-500">{model.sublabel}</div>
                      </div>
                      {active && <Check size={15} className="text-amber-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save */}
            <button
              onClick={saveCustom}
              disabled={saving || (selectedNeedsKey && !keySet && !apiKeyInput.trim())}
              className="w-full py-3 rounded-xl bg-amber-500 text-on-accent font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
            >
              {saving ? "Saving…" : "Save Custom AI Settings"}
            </button>

            {msg && (
              <p className={`text-xs text-center ${msg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                {msg.text}
              </p>
            )}
          </div>
        )}

        {useCustomKey && (keySet || selectedProvider === "ollama") && !msg && (
          <div className="flex items-center gap-2 bg-blue-900/20 border border-blue-700/30 rounded-xl px-3 py-2.5">
            <span className="text-blue-400 text-sm"><Glyph e="🔑" /></span>
            <p className="text-xs text-blue-300">
              {selectedProvider === "ollama" ? "Using local Ollama" : "Using your custom key"} · {CUSTOM_MODELS.find(m => m.id === selectedModel)?.label ?? selectedModel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section: Account ────────────────────────────────────────────────────────

function AccountSection({ name, email, displayName: initialDisplayName }: { name: string; email: string; displayName: string }) {
  const { lang } = useApp();
  const t = useT();
  const [currentPw, setCurrentPw] = useState("");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 8) { setMsg({ text: "Password must be at least 8 characters", type: "err" }); return; }
    if (newPw !== confirmPw) { setMsg({ text: "Passwords don't match", type: "err" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw || undefined, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ text: data.error ?? "Failed", type: "err" }); return; }
      setMsg({ text: "Password updated", type: "ok" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch {
      setMsg({ text: "Network error", type: "err" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <h2 className="font-semibold text-white text-sm">Account</h2>
      </div>
      <div className={sectionBodyCls}>
        {/* Identity */}
        <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm flex-shrink-0">
            {(name || email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            {name && <div className="text-sm font-semibold text-white truncate">{name}</div>}
            <div className="text-xs text-gray-400 truncate">{email}</div>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 font-medium mb-2">Display Name</p>
          <div className="flex gap-2">
            <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="How your name appears in feed" className={inputCls} />
            <button type="button" className="px-3 rounded-xl bg-gray-700 text-xs" onClick={async()=>{await fetch('/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName})}); setMsg({text:"Display name saved",type:'ok'});}}>Save</button>
          </div>
        </div>

        {/* Change password */}
        <div>
          <p className="text-xs text-gray-400 font-medium mb-2">Change Password</p>
          <form onSubmit={handleSave} className="space-y-2">
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="Current password (leave blank if Google sign-in)"
              className={inputCls}
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password (min. 8 characters)"
              className={inputCls}
              required
            />
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
              className={inputCls}
              required
            />
            {msg && (
              <p className={`text-xs ${msg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                {msg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-gray-700 text-white font-semibold text-sm disabled:opacity-40 hover:bg-gray-600 transition-colors"
            >
              {saving ? "Saving…" : "Update Password"}
            </button>
          </form>
        </div>

        {/* Sign out */}
        <a
          href="/api/auth/logout"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-900/20 border border-red-800/40 text-red-400 text-sm font-medium hover:bg-red-900/30 transition-colors"
        >
          Sign Out
        </a>
      </div>
    </div>
  );
}

// ── Section: Public Profile ───────────────────────────────────────────────────

function PublicProfileSection({ initialUsername, initialBio, initialPublic }: {
  initialUsername: string;
  initialBio: string;
  initialPublic: boolean;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), publicBio: bio.trim(), isPublic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setMsg({ type: "ok", text: "Profile saved!" });
    } catch (e) {
      setMsg({ type: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <h2 className="font-semibold text-white text-sm">Public Profile</h2>
        <p className="text-xs text-gray-500 mt-0.5">Your shareable garage page and car show cards</p>
      </div>
      <div className={sectionBodyCls}>
        {/* Public toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">Enable public profile</p>
            <p className="text-xs text-gray-500 mt-0.5">Anyone with your link can view your garage</p>
          </div>
          <button
            onClick={() => setIsPublic(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? "bg-amber-500" : "bg-gray-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#ffffff] shadow transition-transform ${isPublic ? "translate-x-5" : ""}`} />
          </button>
        </div>

        {/* Username */}
        <div>
          <label className="text-xs text-gray-400 font-medium block mb-1.5">Username (URL slug)</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm flex-shrink-0">garagemeet.com/u/</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="yourname"
              maxLength={30}
              className={inputCls}
            />
          </div>
          {username && isPublic && (
            <a
              href={`/u/${username}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-amber-500 hover:underline mt-1 block"
            >
              {baseUrl}/u/{username} ↗
            </a>
          )}
        </div>

        {/* Bio */}
        <div>
          <label className="text-xs text-gray-400 font-medium block mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Car enthusiast, weekend wrench-turner…"
            rows={2}
            maxLength={160}
            className={`${inputCls} resize-none`}
          />
        </div>

        {msg && (
          <p className={`text-xs ${msg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-amber-500 text-on-accent font-semibold text-sm disabled:opacity-40 hover:bg-amber-400 transition-colors"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </div>
    </div>
  );
}

function DataBackupSection() {
  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <h2 className="font-semibold text-white text-sm">Data & Backup</h2>
        <p className="text-xs text-gray-500 mt-0.5">Export a copy of your garage records for safekeeping.</p>
      </div>
      <div className={sectionBodyCls}>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs text-amber-200">Current export scope: database records only. Uploaded photos, documents, and receipt files are not included in this export yet.</p>
        </div>
        <a href="/api/export/garage" className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-on-accent hover:bg-amber-400 transition-colors">
          <Download size={16} />
          Export garage data
        </a>
      </div>
    </div>
  );
}

function PrivacySharingSection() {
  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <h2 className="font-semibold text-white text-sm">Privacy & Sharing</h2>
        <p className="text-xs text-gray-500 mt-0.5">Social sharing is opt-in. Private garage records stay private by default.</p>
      </div>
      <div className={sectionBodyCls}>
        <div className="flex gap-3 rounded-xl bg-gray-800 px-4 py-3">
          <Lock size={16} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Private by default</p>
            <p className="text-xs text-gray-500">VINs, plates, addresses, costs, warranty documents, receipts, and private notes are not published to Social unless a sharing flow explicitly allows it.</p>
          </div>
        </div>
        <div className="flex gap-3 rounded-xl bg-gray-800 px-4 py-3">
          <Shield size={16} className="mt-0.5 flex-shrink-0 text-emerald-400" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Post audience controls</p>
            <p className="text-xs text-gray-500">Published project posts should show an audience state such as Public, Friends, or Private/Draft as Social privacy controls mature.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export default function SettingsClient({
  name, displayName, email, aiModel, aiApiKeySet, aiApiKeyMasked,
  username, publicBio, isPublic,
}: Props & { username: string; publicBio: string; isPublic: boolean }) {
  return (
    <div className="min-h-screen bg-gray-950 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-4 pt-3 pb-3">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="flex-shrink-0 text-xl font-light text-gray-400 active:text-white w-8 h-8 flex items-center justify-center rounded-xl active:bg-gray-800 transition-colors"
          >
            ‹
          </a>
          <div>
            <h1 className="font-bold text-base text-white">Settings</h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        <PublicProfileSection
          initialUsername={username}
          initialBio={publicBio}
          initialPublic={isPublic}
        />
        <AppearanceSection />
        <DataBackupSection />
        <PrivacySharingSection />
        <AIModelSection
          initialModel={aiModel}
          initialKeySet={aiApiKeySet}
          initialKeyMasked={aiApiKeyMasked}
        />
        <AccountSection name={name} email={email} displayName={displayName} />
      </div>
    </div>
  );
}
