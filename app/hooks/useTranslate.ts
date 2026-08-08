"use client";
import { useState, useEffect, useRef } from "react";
import { useApp } from "@/app/providers/AppProviders";

export function useTranslate(texts: string[]): string[] {
  const { lang } = useApp();
  const [translated, setTranslated] = useState<string[]>(texts);
  const keyRef = useRef("");

  useEffect(() => {
    const key = texts.join("||") + lang;
    if (key === keyRef.current) return;
    keyRef.current = key;

    if (lang === "en") {
      setTranslated(texts);
      return;
    }
    const textsToTranslate = texts.filter(t => t.trim());
    if (textsToTranslate.length === 0) return;

    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, lang }),
    })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.translations)) setTranslated(d.translations); })
      .catch(() => {});
  }, [texts.join("||"), lang]);

  return lang === "en" ? texts : translated;
}
