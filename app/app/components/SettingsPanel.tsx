"use client";

import { useState } from "react";
import { useApp } from "@/app/providers/AppProviders";

function SetPasswordForm({ onClose }: { onClose: () => void }) {
  const { lang } = useApp();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isGoogleOnly = !currentPw && true; // user decides by leaving current blank

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPw.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { setError("Passwords don't match"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw || undefined, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setDone(true);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const txt = {
    title: lang === "es" ? "Establecer contraseña" : "Set password",
    subtitle: lang === "es"
      ? "Agrega una contraseña para poder iniciar sesión con tu correo también."
      : "Add a password so you can sign in with your email too.",
    currentPw: lang === "es" ? "Contraseña actual (si tienes una)" : "Current password (if you have one)",
    newPw: lang === "es" ? "Nueva contraseña" : "New password",
    confirmPw: lang === "es" ? "Confirmar contraseña" : "Confirm password",
    save: lang === "es" ? "Guardar contraseña" : "Save password",
    saving: lang === "es" ? "Guardando…" : "Saving…",
    success: lang === "es" ? "✅ Contraseña guardada. Ya puedes iniciar sesión con tu correo." : "✅ Password saved. You can now sign in with your email too.",
    back: lang === "es" ? "← Volver" : "← Back",
  };

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-emerald-300">{txt.success}</p>
        <button onClick={onClose} className="text-xs text-gray-400 underline">{txt.back}</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-gray-400">{txt.subtitle}</p>

      <div>
        <label className="block text-xs text-gray-500 mb-1">{txt.currentPw}</label>
        <input
          type="password"
          value={currentPw}
          onChange={e => setCurrentPw(e.target.value)}
          placeholder="Leave blank if Google sign-in only"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">{txt.newPw}</label>
        <input
          type="password"
          value={newPw}
          onChange={e => setNewPw(e.target.value)}
          placeholder="Min. 8 characters"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">{txt.confirmPw}</label>
        <input
          type="password"
          value={confirmPw}
          onChange={e => setConfirmPw(e.target.value)}
          placeholder="Repeat password"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
          required
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 text-xs py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400"
        >
          {txt.back}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 text-xs py-2 rounded-lg bg-amber-500 text-gray-950 font-bold disabled:opacity-40"
        >
          {saving ? txt.saving : txt.save}
        </button>
      </div>
    </form>
  );
}

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const { theme, toggleTheme, lang, setLang } = useApp();

  return (
    <div className="fixed bottom-6 left-4 z-50">
      {open && (
        <div className="mb-3 bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-2xl w-64 space-y-4">
          {showPwForm ? (
            <SetPasswordForm onClose={() => setShowPwForm(false)} />
          ) : (
            <>
              {/* Theme */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">
                  {lang === "es" ? "Tema" : "Theme"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => theme !== "dark" && toggleTheme()}
                    className={`flex-1 text-xs py-2 rounded-lg font-medium border transition-colors ${
                      theme === "dark"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400"
                    }`}
                  >
                    🌙 {lang === "es" ? "Oscuro" : "Dark"}
                  </button>
                  <button
                    onClick={() => theme !== "light" && toggleTheme()}
                    className={`flex-1 text-xs py-2 rounded-lg font-medium border transition-colors ${
                      theme === "light"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400"
                    }`}
                  >
                    ☀️ {lang === "es" ? "Claro" : "Light"}
                  </button>
                </div>
              </div>

              {/* Language */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">
                  {lang === "es" ? "Idioma" : "Language"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLang("en")}
                    className={`flex-1 text-xs py-2 rounded-lg font-medium border transition-colors ${
                      lang === "en"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400"
                    }`}
                  >
                    🇺🇸 EN
                  </button>
                  <button
                    onClick={() => setLang("es")}
                    className={`flex-1 text-xs py-2 rounded-lg font-medium border transition-colors ${
                      lang === "es"
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-400"
                    }`}
                  >
                    🇪🇸 ES
                  </button>
                </div>
              </div>

              {/* Password */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">
                  {lang === "es" ? "Cuenta" : "Account"}
                </p>
                <button
                  onClick={() => setShowPwForm(true)}
                  className="w-full text-xs py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 font-medium hover:border-amber-500/50 transition-colors"
                >
                  🔑 {lang === "es" ? "Establecer contraseña" : "Set / change password"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => { setOpen(o => !o); if (!open) setShowPwForm(false); }}
        className="bg-gray-800 border border-gray-700 text-gray-400 rounded-full w-12 h-12 flex items-center justify-center shadow-lg text-lg active:scale-95 transition-transform"
        title="Settings"
      >
        {open ? "✕" : "⚙️"}
      </button>
    </div>
  );
}
