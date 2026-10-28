"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Glyph from "@/app/components/Glyph";

const AI_FEATURES = [
  { icon: "📷", label: "Receipt AI Scan", desc: "Snap a receipt and auto-fill service records" },
  { icon: "💬", label: "AI Chat Assistant", desc: "Ask questions about your vehicles & repairs" },
  { icon: "🔍", label: "VIN Decode & Recall Lookup", desc: "Automatic vehicle enrichment from VIN" },
  { icon: "🗓️", label: "Maintenance Suggestions", desc: "AI-powered service interval predictions" },
];

type Provider = "openai" | "anthropic";

export default function OnboardingClient() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [skipping, startSkip] = useTransition();

  const handleSave = () => {
    const key = apiKey.trim();
    if (!key) { setError("Please enter an API key or skip."); return; }
    if (provider === "openai" && !key.startsWith("sk-")) {
      setError("OpenAI keys start with sk-…");
      return;
    }
    setError(null);
    startSave(async () => {
      const res = await fetch("/api/settings/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiModel: provider === "openai" ? "openai" : "anthropic", aiApiKey: key }),
      });
      if (res.ok) {
        router.push("/?welcome=1");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save key.");
      }
    });
  };

  const handleSkip = () => {
    startSkip(async () => {
      // Explicitly mark AI as disabled (no key)
      await fetch("/api/settings/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiModel: "disabled", aiApiKey: null }),
      });
      router.push("/");
    });
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 text-sm font-mono";

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-5xl mb-2"><Glyph e="🏎" /></div>
          <h1 className="text-2xl font-bold">Welcome to GarageMeet!</h1>
          <p className="text-sm text-gray-400">Your account is ready. One last optional step — power up AI features.</p>
        </div>

        {/* What AI unlocks */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">AI features unlock</p>
          <div className="grid grid-cols-2 gap-2">
            {AI_FEATURES.map((f) => (
              <div key={f.label} className="bg-gray-800/60 rounded-xl p-3 space-y-0.5">
                <div className="text-lg"><Glyph e={f.icon} /></div>
                <div className="text-xs font-semibold text-white">{f.label}</div>
                <div className="text-[11px] text-gray-500 leading-snug">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* API key input */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white mb-1">Your own API key</p>
            <p className="text-xs text-gray-500">GarageMeet uses your personal key — we never store it in plaintext on our servers and you control costs directly.</p>
          </div>

          {/* Provider selector */}
          <div className="flex rounded-xl overflow-hidden border border-gray-700">
            <button
              onClick={() => setProvider("openai")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${provider === "openai" ? "bg-amber-500 text-on-accent" : "text-gray-400 hover:text-white"}`}
            >
              OpenAI
            </button>
            <button
              onClick={() => setProvider("anthropic")}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-l border-gray-700 ${provider === "anthropic" ? "bg-amber-500 text-on-accent" : "text-gray-400 hover:text-white"}`}
            >
              Claude (Anthropic)
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {provider === "openai" ? "OpenAI API Key (starts with sk-…)" : "Anthropic API Key (starts with sk-ant-…)"}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === "openai" ? "sk-…" : "sk-ant-…"}
              autoComplete="off"
              className={inputCls}
            />
            <p className="text-[11px] text-gray-600 mt-1.5">
              {provider === "openai"
                ? <>Get yours at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">platform.openai.com</a></>
                : <>Get yours at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">console.anthropic.com</a></>
              }
            </p>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-sm text-red-300">{error}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || skipping}
            className="w-full bg-amber-500 text-on-accent font-bold py-3 rounded-xl text-sm disabled:opacity-40 active:scale-95 transition-transform"
          >
            {saving ? "Saving…" : "Save & Continue →"}
          </button>
        </div>

        {/* Skip */}
        <div className="text-center space-y-1">
          <button
            onClick={handleSkip}
            disabled={saving || skipping}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
          >
            {skipping ? "Skipping…" : "Skip for now — I'll add it later in Settings"}
          </button>
          <p className="text-[11px] text-gray-600">AI features will be disabled until you add a key.</p>
        </div>
      </div>
    </div>
  );
}
