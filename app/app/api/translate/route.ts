import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { randomUUID } from "crypto";

import { callGarageAIText } from "@/lib/ai-provider";

const LANG_NAMES: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  pt: "Portuguese",
};

function makeHash(text: string, lang: string) {
  return createHash("sha256").update(`${text}||${lang}`).digest("hex");
}

async function ollamaTranslate(texts: string[], lang: string): Promise<string[]> {
  const langName = LANG_NAMES[lang] ?? lang;
  const prompt = `You are a professional translator for a car maintenance mobile app.
Translate the following JSON array of English strings to ${langName}.
Rules:
- Keep car make/model names in English (Ford, Honda, Jeep, etc.)
- Keep emojis exactly as-is
- Keep numbers exactly as-is
- Translate automotive terms naturally
- Keep translations concise — this is a mobile UI
- Return ONLY a valid JSON array with exactly ${texts.length} elements, no explanations, no markdown

Input: ${JSON.stringify(texts)}`;

  const content = await callGarageAIText({ prompt, temperature: 0.1, maxTokens: 2048, signal: AbortSignal.timeout(60_000) });

  // Extract JSON array
  const match = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) ||
                content.match(/(\[[\s\S]*\])/);
  if (!match) throw new Error("No JSON array in response");
  const arr = JSON.parse(match[1]);
  if (!Array.isArray(arr) || arr.length !== texts.length) throw new Error("Bad response length");
  return arr.map(String);
}

export async function POST(req: NextRequest) {
  const { texts, lang } = await req.json();
  if (!Array.isArray(texts) || !lang || lang === "en") {
    return NextResponse.json({ translations: texts });
  }

  // Check cache for each text
  const hashes = texts.map((t: string) => makeHash(t, lang));
  const cached = await (prisma as any).translationCache.findMany({
    where: { hash: { in: hashes } },
  });
  const cacheMap = new Map(cached.map((c: any) => [c.hash, c.translated]));

  const uncachedIndexes: number[] = [];
  const uncachedTexts: string[] = [];
  texts.forEach((text: string, i: number) => {
    if (!cacheMap.has(hashes[i])) {
      uncachedIndexes.push(i);
      uncachedTexts.push(text);
    }
  });

  // Translate uncached texts
  if (uncachedTexts.length > 0) {
    try {
      const translations = await ollamaTranslate(uncachedTexts, lang);
      // Store in cache — upsert each (SQLite Prisma doesn't support createMany skipDuplicates)
      await Promise.all(
        uncachedTexts.map((original: string, i: number) =>
          (prisma as any).translationCache.upsert({
            where: { hash: makeHash(original, lang) },
            create: {
              id: randomUUID(),
              hash: makeHash(original, lang),
              original,
              lang,
              translated: translations[i],
            },
            update: { translated: translations[i] },
          })
        )
      );
      // Add to cacheMap
      uncachedIndexes.forEach((origIdx: number, i: number) => {
        cacheMap.set(hashes[origIdx], translations[i]);
      });
    } catch (e) {
      console.error("Translation error:", e);
      // Fall back to originals for uncached
      uncachedIndexes.forEach((i: number) => cacheMap.set(hashes[i], texts[i]));
    }
  }

  const translations = texts.map((t: string, i: number) => cacheMap.get(hashes[i]) ?? t);
  return NextResponse.json({ translations });
}
