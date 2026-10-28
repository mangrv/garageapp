"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { MessageCircle, X, Send, Mic, Volume2, VolumeX, Trash2, Bot } from "lucide-react";
import { usePathname } from "next/navigation";
import { useApp } from "@/app/providers/AppProviders";
import { useT } from "@/app/hooks/useT";
import { trackMatomoEvent } from "@/app/lib/matomo";
import Glyph from "@/app/components/Glyph";

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string; actionResult?: string };

type ActionResult = { ok: boolean; label?: string; jobId?: string; carId?: string; phasesAdded?: number; tasksAdded?: number };

// ── Voice hook ─────────────────────────────────────────────────────────────────

function useVoice(onTranscript: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null); // null = not yet checked
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition ||
      (window as any).msSpeechRecognition;

    if (!SR) {
      setSupported(false);
      return;
    }

    try {
      const r = new SR();
      r.continuous = false;
      r.interimResults = true;
      r.lang = "en-US";
      r.onresult = (e: any) => {
        // Use the most recent final result
        let transcript = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) transcript += e.results[i][0].transcript;
        }
        if (transcript) onTranscript(transcript);
      };
      r.onend = () => setListening(false);
      r.onerror = (e: any) => {
        setListening(false);
        if (e.error === "not-allowed") setError("Microphone permission denied. Check browser settings.");
        else if (e.error === "no-speech") setError(null); // user just didn't speak
        else setError(`Voice error: ${e.error}`);
      };
      recRef.current = r;
      setSupported(true);
    } catch {
      setSupported(false);
    }
  }, [onTranscript]);

  const toggle = useCallback(async () => {
    if (!recRef.current) return;
    setError(null);
    if (listening) {
      recRef.current.stop();
      setListening(false);
    } else {
      // Request mic permission explicitly first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recRef.current.start();
        setListening(true);
      } catch {
        setError("Microphone access denied. Allow mic in browser settings.");
      }
    }
  }, [listening]);

  return { listening, supported, toggle, error };
}

// ── TTS hook ──────────────────────────────────────────────────────────────────

function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(false); // user must opt-in

  const speak = useCallback((text: string) => {
    if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
    // Strip action blocks and markdown before speaking
    const clean = text
      .replace(/<ACTION>[\s\S]*?<\/ACTION>/g, "")
      .replace(/[*_`#]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 1.05;
    utt.pitch = 1;
    utt.lang = "en-US";
    // Pick a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Samantha") || v.name.includes("Alex") ||
      v.name.includes("Google US") || v.name.includes("en-US")
    );
    if (preferred) utt.voice = preferred;
    utt.onstart = () => setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, [enabled]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  const supported = typeof window !== "undefined" && !!window.speechSynthesis;

  return { speak, stop, speaking, enabled, setEnabled, supported };
}

// ── Action parser ──────────────────────────────────────────────────────────────

/** Attempt to repair truncated JSON by closing unclosed strings/arrays/objects. */
function repairJson(partial: string): any | null {
  const s = partial.trimEnd();
  try { return JSON.parse(s); } catch {}

  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") stack.pop();
  }

  let repaired = s;
  // Close any open string
  if (inString) repaired += '"';
  // Remove trailing comma before we close brackets
  repaired = repaired.replace(/,\s*$/, "");
  // Close remaining brackets in reverse
  for (let i = stack.length - 1; i >= 0; i--) repaired += stack[i];

  try { return JSON.parse(repaired); } catch { return null; }
}

function parseAction(text: string): { display: string; action: any | null; truncated: boolean } {
  // Complete action (preferred)
  const completeMatch = text.match(/<ACTION>([\s\S]*?)<\/ACTION>/);
  if (completeMatch) {
    const display = text.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, "").trim();
    try {
      return { display, action: JSON.parse(completeMatch[1]), truncated: false };
    } catch {
      return { display, action: null, truncated: false };
    }
  }

  // Truncated action — try to repair
  const partialMatch = text.match(/<ACTION>([\s\S]*)/);
  if (partialMatch) {
    const display = text.replace(/<ACTION>[\s\S]*/, "").trim();
    const repaired = repairJson(partialMatch[1]);
    return { display, action: repaired, truncated: true };
  }

  return { display: text, action: null, truncated: false };
}

// ── Context fetcher ────────────────────────────────────────────────────────────

async function fetchContext(jobId: string | null, carId: string | null) {
  const params = new URLSearchParams();
  if (jobId) params.set("jobId", jobId);
  if (carId) params.set("carId", carId);
  const qs = params.toString();
  const url = qs ? `/api/ai/context?${qs}` : "/api/ai/context";
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIAssistant() {
  const { lang } = useApp();
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Extract scoped IDs from pathname
  const jobId = pathname.match(/^\/job\/([^/]+)/)?.[1] ?? null;
  const carId = pathname.match(/^\/cars\/([^/]+)/)?.[1] ?? null;

  // Load context whenever jobId changes or panel opens
  useEffect(() => {
    if (!open) return;
    fetchContext(jobId, carId).then(setContext);
  }, [open, jobId, carId]);

  // Load conversation history when panel opens
  useEffect(() => {
    if (!open) return;
    const url = jobId ? `/api/ai/conversation?jobId=${jobId}` : "/api/ai/conversation";
    fetch(url).then((r) => r.json()).then((d) => {
      if (d.messages?.length > 0) {
        setMessages(d.messages);
      } else {
        const ctx = jobId ? "I see you're working on a job. What would you like to do?" : "What are we working on? I can add cars, create jobs, or help you plan any repair.";
        setMessages([{ role: "assistant", content: ctx }]);
      }
    }).catch(() => {});
  }, [open, jobId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Save conversation on messages change
  const saveTimeout = useRef<any>(null);
  useEffect(() => {
    if (messages.length < 2) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const url = jobId ? `/api/ai/conversation?jobId=${jobId}` : "/api/ai/conversation";
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, jobId }),
      });
    }, 1000);
  }, [messages, jobId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  async function executeAction(action: any): Promise<string> {
    const res = await fetch("/api/ai/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data: ActionResult = await res.json();
    if (!data.ok) {
      trackMatomoEvent("AI", "Action Failed", action.type ?? "unknown");
      return "Action failed.";
    }

    trackMatomoEvent("AI", "Action Success", action.type ?? "unknown");
    switch (action.type) {
      case "create_car":
        showToast(`Added ${data.label} to your garage`);
        return `Added **${data.label}** to your garage.`;
      case "create_job":
        showToast("Job created!");
        if (data.jobId) setTimeout(() => { window.location.href = `/job/${data.jobId}`; }, 1500);
        return `Job created! Taking you there now...`;
      case "add_phases":
        showToast(`Added ${data.phasesAdded} phase(s) to the job`);
        fetchContext(jobId, carId).then((c) => { if (c) setContext(c); });
        setTimeout(() => window.location.reload(), 1200);
        return `Added **${data.phasesAdded}** phase(s). Refreshing job...`;
      case "add_tasks":
        showToast(`Added ${data.tasksAdded} task(s)`);
        fetchContext(jobId, carId).then((c) => { if (c) setContext(c); });
        setTimeout(() => window.location.reload(), 1200);
        return `Added **${data.tasksAdded}** task(s). Refreshing...`;
      case "update_tools":
        showToast("Tools updated");
        fetchContext(jobId, carId).then((c) => { if (c) setContext(c); });
        setTimeout(() => window.location.reload(), 1200);
        return `Tools updated. Refreshing...`;
      default:
        return "Done.";
    }
  }

  const { listening, supported: voiceSupported, toggle: toggleVoice, error: voiceError } = useVoice((t) => {
    setInput((prev) => prev ? `${prev} ${t}` : t);
    // Auto-enable TTS when user speaks (makes it feel conversational)
    setTtsEnabled(true);
  });
  const { speak, stop, speaking, enabled: ttsEnabled, setEnabled: setTtsEnabled, supported: ttsSupported } = useTTS();

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    trackMatomoEvent("AI", "Chat Send", jobId ? "job-context" : carId ? "car-context" : "general");

    let fullText = "";
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          context,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullText += chunk;
        assistantText += chunk;
        // While streaming, hide everything from <ACTION> onward so raw JSON never shows
        const visibleText = assistantText.replace(/<ACTION>[\s\S]*/g, "").trim();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: visibleText || "▋" };
          return updated;
        });
      }

      // Parse and execute any action
      const { display, action, truncated } = parseAction(fullText);
      const safeDisplay = display.replace(/<ACTION>[\s\S]*/g, "").trim();

      if (action) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: safeDisplay || "Working on it..." };
          return updated;
        });
        speak(safeDisplay || "Working on it...");
        const result = await executeAction(action);
        const truncatedNote = truncated ? "\n\n_(Response was cut off — some phases/tasks may be missing. Ask me to continue adding the rest.)_" : "";
        const finalContent = (safeDisplay ? safeDisplay + "\n\n" : "") + result + truncatedNote;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: finalContent,
            actionResult: result,
          };
          return updated;
        });
        trackMatomoEvent("AI", "Chat Response", "with-action");
        speak(result);
      } else if (fullText.includes("<ACTION>")) {
        // <ACTION> present but JSON is unrecoverable
        const errorMsg = (safeDisplay ? safeDisplay + "\n\n" : "") + "That response was too long to process. Try asking for fewer phases at a time (e.g. 'add phases 1–3 first').";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: errorMsg };
          return updated;
        });
        trackMatomoEvent("AI", "Chat Response", "truncated-action");
        speak(errorMsg);
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: safeDisplay };
          return updated;
        });
        trackMatomoEvent("AI", "Chat Response", "text-only");
        speak(safeDisplay);
      }
    } catch {
      trackMatomoEvent("AI", "Chat Error", "request-failed");
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Try again." };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  async function clearChat() {
    const url = jobId ? `/api/ai/conversation?jobId=${jobId}` : "/api/ai/conversation";
    await fetch(url, { method: "DELETE" });
    setMessages([{ role: "assistant", content: "Chat cleared. What are we working on?" }]);
  }

  // Don't show on login/register/share pages
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/share")) return null;

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-800 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[84px] md:bottom-6 right-4 z-50 bg-gray-900 text-white rounded-full shadow-xl flex items-center gap-2 pl-3.5 pr-4 py-3 text-sm font-semibold active:scale-95 transition-transform border border-gray-700 hover:bg-gray-800"
        >
          <MessageCircle size={18} className="flex-shrink-0" />
          <span className="text-sm font-bold tracking-wide">{lang === "es" ? "IA" : "AI"}</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-950" style={{ maxWidth: "100vw" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                <Bot size={16} className="text-gray-300" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-white text-sm leading-tight">Garage AI</h2>
                <p className="text-xs text-gray-500 truncate">
                  {context?.job
                    ? context.job.title
                    : context?.focusedCar
                    ? context.focusedCar.label
                    : "General garage chat"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {ttsSupported && (
                <button
                  onClick={() => { if (speaking) { stop(); } else { setTtsEnabled(e => !e); } }}
                  className={`p-2 rounded-lg transition-colors ${ttsEnabled ? speaking ? "text-emerald-400 animate-pulse" : "text-emerald-500 bg-emerald-900/20" : "text-gray-600 hover:text-gray-400"}`}
                  title={ttsEnabled ? speaking ? "Speaking… tap to stop" : "Voice on" : "Voice off"}
                >
                  {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              )}
              <button onClick={clearChat} className="p-2 rounded-lg text-gray-600 hover:text-gray-400 transition-colors" title="Clear chat">
                <Trash2 size={15} />
              </button>
              <button onClick={() => { stop(); setOpen(false); }} className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Context banner */}
          {(context?.job || context?.focusedCar) && (
            <div className="px-4 py-2 bg-gray-800/80 border-b border-gray-700/60">
              {context?.job ? (
                <p className="text-xs text-gray-400">
                  Context: <strong className="text-gray-200">{context.job.title}</strong>
                  {context.job.car && <span className="text-gray-500 ml-1">· {context.job.car}</span>}
                  <span className="text-gray-600 ml-2">· {context.job.phases.length} phases</span>
                </p>
              ) : (
                <p className="text-xs text-gray-400">
                  Context: <strong className="text-gray-200">{context.focusedCar.label}</strong>
                  {context.focusedCar.mileage && (
                    <span className="text-gray-500 ml-1">· {Number(context.focusedCar.mileage).toLocaleString()} mi</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gray-700 text-white rounded-br-sm"
                      : "bg-gray-800 text-gray-200 rounded-bl-sm"
                  }`}
                >
                  {msg.content || <span className="opacity-40 animate-pulse">▋</span>}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <span className="text-gray-400 text-sm animate-pulse">▋</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-6 pt-3 border-t border-gray-800 bg-gray-900">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={context?.job
                  ? "Add spark plugs, adjust torque specs, ask anything…"
                  : context?.focusedCar
                  ? "Ask about this vehicle: maintenance, diagnosis, next services…"
                  : "Add a car, start a job, ask anything car-related…"}
                rows={2}
                disabled={loading}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 resize-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={voiceSupported ? toggleVoice : undefined}
                disabled={voiceSupported === false}
                className={`p-2.5 rounded-xl text-lg flex-shrink-0 transition-colors ${
                  listening
                    ? "bg-red-600 text-on-accent animate-pulse"
                    : voiceSupported === false
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed opacity-40"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
                title={
                  voiceSupported === false
                    ? "Voice not supported — use Chrome or Safari"
                    : voiceSupported === null
                    ? "Loading voice support…"
                    : listening
                    ? "Stop recording"
                    : "Tap to speak"
                }
              >
                <Glyph e="🎙" />
              </button>
              <button
                type="button"
                onClick={send}
                disabled={loading || !input.trim()}
                className="p-2.5 bg-gray-800 border border-gray-600 text-white rounded-xl flex-shrink-0 disabled:opacity-40 hover:bg-gray-700 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
            {listening && <p className="text-xs text-red-400 mt-1 text-center"><Glyph e="🔴" /> Listening… speak now</p>}
            {voiceError && <p className="text-xs text-amber-400 mt-1 text-center"><Glyph e="⚠" /> {voiceError}</p>}
            {voiceSupported === false && (
              <p className="text-xs text-gray-600 mt-1 text-center">
                <Glyph e="🎙" /> Voice requires Chrome or Safari
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1 text-center">Car maintenance only · Enter to send</p>
          </div>
        </div>
      )}
    </>
  );
}
