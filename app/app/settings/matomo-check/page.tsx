"use client";

import { useEffect, useState } from "react";
import Glyph from "@/app/components/Glyph";

export default function MatomoCheckPage() {
  const [status, setStatus] = useState<"checking" | "ok" | "missing">("checking");
  const [queueLen, setQueueLen] = useState<number>(0);

  useEffect(() => {
    const w = window as any;
    const q = w._paq;
    if (Array.isArray(q)) {
      setStatus("ok");
      setQueueLen(q.length);
      // send a diagnostic event
      q.push(["trackEvent", "Diagnostics", "Matomo Check", "settings/matomo-check"]);
    } else {
      setStatus("missing");
    }
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <h1 className="text-lg font-bold text-white">Matomo check</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
        <p className="text-sm text-gray-300">
          Status:{" "}
          {status === "checking" && <span className="text-gray-500">Checking…</span>}
          {status === "ok" && <span className="text-emerald-400 font-semibold">Loaded <Glyph e="✅" /></span>}
          {status === "missing" && <span className="text-red-400 font-semibold">Not found <Glyph e="❌" /></span>}
        </p>
        <p className="text-xs text-gray-500">_paq queue length: {queueLen}</p>
      </div>
    </div>
  );
}
