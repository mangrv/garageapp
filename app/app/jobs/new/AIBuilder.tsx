"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Glyph from "@/app/components/Glyph";

// ── Types ────────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };

type AITask = {
  title: string;
  warning: string | null;
  tip: string | null;
  torqueValue: number | null;
  torqueUnit: string | null;
};

type AIPhase = {
  emoji: string;
  title: string;
  toolsJson: string[];
  tasks: AITask[];
};

type AIJob = {
  title: string;
  notes: string;
  toolsJson: string[];
  phases: AIPhase[];
};

// ── Voice hook ───────────────────────────────────────────────────────────────

function useVoice(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).mozSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    try {
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e: any) => {
        let t = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) t += e.results[i][0].transcript;
        }
        if (t) onTranscript(t);
      };
      rec.onend = () => setListening(false);
      rec.onerror = (e: any) => {
        setListening(false);
        if (e.error === "not-allowed") setVoiceError("Mic denied — check browser settings");
      };
      recognitionRef.current = rec;
      setSupported(true);
    } catch { setSupported(false); }
  }, [onTranscript]);

  const toggle = useCallback(async () => {
    if (!recognitionRef.current) return;
    setVoiceError(null);
    if (listening) { recognitionRef.current.stop(); setListening(false); }
    else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current.start();
        setListening(true);
      } catch { setVoiceError("Mic access denied"); }
    }
  }, [listening]);

  return { listening, supported, toggle, voiceError };
}

// ── Job preview ──────────────────────────────────────────────────────────

function ProjectPreview({ project }: { project: AIJob }) {
  const totalTasks = project.phases.reduce((s, p) => s + p.tasks.length, 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="font-bold text-white text-base"><Glyph e="🔧" /> {project.title}</h3>
        {project.notes && <p className="text-xs text-gray-400 mt-1">{project.notes}</p>}
        <div className="flex gap-3 mt-2 text-xs text-gray-500">
          <span>{project.phases.length} phases</span>
          <span>{totalTasks} tasks</span>
        </div>
      </div>

      {/* Job tools */}
      {project.toolsJson?.length > 0 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
          <div className="text-xs font-semibold text-gray-400 mb-2"><Glyph e="🧰" /> Tools needed</div>
          <div className="flex flex-wrap gap-1.5">
            {project.toolsJson.map((tool, i) => (
              <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{tool}</span>
            ))}
          </div>
        </div>
      )}

      {/* Phases */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {project.phases.map((phase, pi) => (
          <div key={pi} className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700/60">
              <span className="text-sm font-medium text-white">
                <Glyph e={phase.emoji} /> {phase.title}
              </span>
              <span className="text-xs text-gray-500">{phase.tasks.length} tasks</span>
            </div>
            {phase.toolsJson?.length > 0 && (
              <div className="px-3 py-1.5 flex flex-wrap gap-1 border-b border-gray-700/40">
                {phase.toolsJson.map((tool, ti) => (
                  <span key={ti} className="text-xs bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded">{tool}</span>
                ))}
              </div>
            )}
            <div className="divide-y divide-gray-700/40">
              {phase.tasks.map((task, ti) => (
                <div key={ti} className="px-3 py-1.5">
                  <p className="text-xs text-gray-300">{task.title}</p>
                  {task.torqueValue && (
                    <span className="inline-block mt-0.5 text-xs text-gray-400 bg-gray-700/50 border border-gray-600/50 rounded px-1.5 py-0.5 font-mono">
                      <Glyph e="🔧" /> {task.torqueValue} {task.torqueUnit}
                    </span>
                  )}
                  {task.warning && (
                    <p className="text-xs text-amber-400 mt-0.5"><Glyph e="⚠" /> {task.warning}</p>
                  )}
                  {task.tip && (
                    <p className="text-xs text-sky-400 mt-0.5"><Glyph e="💡" /> {task.tip}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AIBuilder({
  cars,
  selectedCarId,
}: {
  cars: { id: string; year: number; make: string; model: string; trim: string | null }[];
  selectedCarId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedJob, setGeneratedJob] = useState<AIJob | null>(null);
  const [creating, setCreating] = useState(false);
  const [carId, setCarId] = useState(selectedCarId ?? "");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const carLabel = cars.find((c) => c.id === carId)
    ? `${cars.find((c) => c.id === carId)!.year} ${cars.find((c) => c.id === carId)!.make} ${cars.find((c) => c.id === carId)!.model}`
    : undefined;

  const { listening, supported: voiceSupported, toggle: toggleVoice, voiceError } = useVoice((transcript) => {
    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "What are we working on? Tell me the job and your car (year/make/model) and I'll build the project plan.",
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Try to parse JSON from AI response
  function tryParseJob(text: string): AIJob | null {
    try {
      const match = text.match(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      if (parsed.ready && parsed.project) return parsed.project as AIJob;
      return null;
    } catch {
      return null;
    }
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setGeneratedJob(null);

    let fullText = "";

    try {
      const res = await fetch("/api/jobs/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          carLabel,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullText += chunk;
        assistantMsg += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: assistantMsg };
          return updated;
        });
      }

      // Check if response contains a project JSON
      const project = tryParseJob(fullText);
      if (project) {
        setGeneratedJob(project);
        // Replace last message with just the preamble text (before the JSON)
        const preamble = fullText.replace(/\{[\s\S]*"ready"\s*:\s*true[\s\S]*\}/, "").trim();
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: preamble || "Job plan ready! Review below and click **Create Job** when you're happy.",
          };
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  async function createJob() {
    if (!generatedJob || creating) return;
    setCreating(true);

    try {
      const res = await fetch("/api/jobs/ai-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: generatedJob, carId: carId || null }),
      });
      const data = await res.json();
      if (data.jobId) {
        window.location.href = `/job/${data.jobId}`;
      }
    } catch {
      setCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    setMessages([]);
    setGeneratedJob(null);
    setInput("");
    setOpen(false);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-3.5 rounded-xl text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
      >
        <Glyph e="✨" /> Build with AI
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex flex-col h-full max-w-lg mx-auto w-full bg-gray-950">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <h2 className="font-bold text-white"><Glyph e="✨" /> AI Job Builder</h2>
                <p className="text-xs text-gray-500">Car maintenance only</p>
              </div>
              <button onClick={reset} className="text-gray-400 text-xl px-2"><Glyph e="✕" /></button>
            </div>

            {/* Car selector */}
            {cars.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2">
                <span className="text-xs text-gray-500 flex-shrink-0"><Glyph e="🚗" /> For:</span>
                <select
                  value={carId}
                  onChange={(e) => setCarId(e.target.value)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="">No specific car</option>
                  {cars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.year} {c.make} {c.model}{c.trim ? ` ${c.trim}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-on-accent rounded-br-sm"
                        : "bg-gray-800 text-gray-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.content || <span className="opacity-40">▋</span>}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2">
                    <span className="text-gray-400 text-sm">▋</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Generated project preview */}
            {generatedJob && (
              <div className="px-4 pb-2 border-t border-gray-800 pt-3 max-h-72 overflow-y-auto">
                <ProjectPreview project={generatedJob} />
                <button
                  onClick={createJob}
                  disabled={creating}
                  className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-on-accent font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {creating ? "Creating project…" : <>{"✅ Create this project →"}</>}
                </button>
                <button
                  onClick={() => setGeneratedJob(null)}
                  className="w-full mt-2 text-xs text-gray-500 underline"
                >
                  Not right — let me refine it
                </button>
              </div>
            )}

            {/* Input area */}
            {!generatedJob && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-800">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe the job… (Enter to send)"
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
                        ? "bg-gray-800 text-gray-600 opacity-40 cursor-not-allowed"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                    title={
                      voiceSupported === false
                        ? "Voice requires Chrome or Safari"
                        : listening ? "Stop recording" : "Tap to speak"
                    }
                  >
                    <Glyph e="🎙" />
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={loading || !input.trim()}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-on-accent rounded-xl flex-shrink-0 disabled:opacity-40 transition-colors"
                  >
                    ↑
                  </button>
                </div>
                {listening && (
                  <p className="text-xs text-red-400 mt-1 text-center"><Glyph e="🔴" /> Listening… speak now</p>
                )}
                <p className="text-xs text-gray-600 mt-1 text-center">
                  Car maintenance only · Shift+Enter for new line
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
