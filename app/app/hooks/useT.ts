"use client";

import { useApp } from "@/app/providers/AppProviders";
import { t as translate, TranslationKey } from "@/lib/i18n";

/**
 * Returns a translation function bound to the current language.
 * Usage:
 *   const t = useT();
 *   <button>{t("save")}</button>  // "Save" in EN, "Guardar" in ES
 *
 * For dynamic strings not in the key map, use DT component instead.
 */
export function useT() {
  const { lang } = useApp();
  return (key: TranslationKey) => translate(key, lang);
}
