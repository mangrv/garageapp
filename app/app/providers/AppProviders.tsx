"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Lang } from "@/lib/i18n";

// ── Theme ─────────────────────────────────────────────────────────────────────

type Theme = "dark" | "light";

interface AppContextValue {
  theme: Theme;
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const AppContext = createContext<AppContextValue>({
  theme: "light",
  toggleTheme: () => {},
  lang: "en",
  setLang: () => {},
});

export function useApp() {
  return useContext(AppContext);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("garage-theme") as Theme) || "light";
    const savedLang = (localStorage.getItem("garage-lang") as Lang) || "en";
    setTheme(savedTheme);
    setLangState(savedLang);
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.documentElement.setAttribute("lang", savedLang);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("garage-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("garage-lang", l);
    document.cookie = `garage-lang=${l}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.setAttribute("lang", l);
  };

  return (
    <AppContext.Provider value={{ theme, toggleTheme, lang, setLang }}>
      {children}
    </AppContext.Provider>
  );
}
