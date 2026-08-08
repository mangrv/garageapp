"use client";
import { useState, useEffect, useRef, ElementType } from "react";
import { useApp } from "@/app/providers/AppProviders";

interface DTProps {
  text: string;
  className?: string;
  as?: ElementType;
}

export function DT({ text, className, as: Tag = "span" }: DTProps) {
  const { lang } = useApp();
  const [translated, setTranslated] = useState(text);
  const prevLang = useRef(lang);
  const prevText = useRef(text);

  useEffect(() => {
    if (lang === "en") {
      setTranslated(text);
      return;
    }
    if (lang === prevLang.current && text === prevText.current) return;
    prevLang.current = lang;
    prevText.current = text;

    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [text], lang }),
    })
      .then(r => r.json())
      .then(d => { if (d.translations?.[0]) setTranslated(d.translations[0]); })
      .catch(() => {});
  }, [text, lang]);

  return <Tag className={className}>{translated}</Tag>;
}
