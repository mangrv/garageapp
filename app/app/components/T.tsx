"use client";
import { useApp } from "@/app/providers/AppProviders";
import { t, TranslationKey } from "@/lib/i18n";

export function T({ k }: { k: TranslationKey }) {
  const { lang } = useApp();
  return <>{t(k, lang)}</>;
}
