export type GarageAIMessage = {
  role: "system" | "user" | "assistant";
  content: any;
};

export type GarageAIOptions = {
  system?: string;
  prompt?: string;
  messages?: GarageAIMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export function cleanProviderModel(model: string) {
  return model.startsWith("ollama:") ? model.slice("ollama:".length) : model;
}

export function getGarageAIConfig() {
  const provider = (process.env.GARAGEMEET_AI_PROVIDER || "ollama").toLowerCase();
  const model = cleanProviderModel(process.env.GARAGEMEET_AI_MODEL || "qwen3.5:27b-q4_K_M");
  const baseUrl = provider === "ollama"
    ? process.env.OLLAMA_OPENAI_BASE_URL || "http://192.168.1.199:12881/v1"
    : "https://api.openai.com/v1";
  const apiKey = provider === "ollama"
    ? process.env.OLLAMA_API_KEY || "ollama"
    : process.env.OPENAI_API_KEY || "";

  return { provider, model, baseUrl, apiKey };
}

function normalizeMessages(options: GarageAIOptions): GarageAIMessage[] {
  const messages = options.messages ? [...options.messages] : [];
  if (options.prompt) messages.push({ role: "user", content: options.prompt });
  if (options.system) messages.unshift({ role: "system", content: options.system });
  return messages;
}

export async function callGarageAIText(options: GarageAIOptions): Promise<string> {
  const config = getGarageAIConfig();
  if (!config.apiKey) throw new Error("GarageMeet AI provider is missing an API key");

  const endpoint = (config.baseUrl.endsWith("/") ? config.baseUrl.slice(0, -1) : config.baseUrl) + "/chat/completions";
  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens,
      stream: false,
      messages: normalizeMessages(options),
    }),
    signal: options.signal,
  });

  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) throw new Error(data?.error?.message || `GarageMeet AI error: ${upstream.status}`);
  return data?.choices?.[0]?.message?.content || "";
}

export async function callGarageAIStream(options: GarageAIOptions): Promise<ReadableStream<Uint8Array>> {
  const text = await callGarageAIText(options);
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

export async function callGarageAIVisionText(
  prompt: string,
  mediaType: string,
  base64Data: string,
  options: Omit<GarageAIOptions, "prompt" | "messages"> = {},
) {
  if (mediaType === "application/pdf") {
    throw new Error("Local GarageMeet AI receipt parsing currently supports image receipts. Convert PDF receipts to an image before scanning.");
  }

  return callGarageAIText({
    ...options,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64Data}` } },
        ],
      },
    ],
  });
}

export function parseJsonObjectFromModelText<T = any>(rawText: string): T {
  const text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object in AI response");
  return JSON.parse(match[0]) as T;
}

export function parseJsonArrayFromModelText<T = any>(rawText: string): T[] {
  const text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array in AI response");
  return JSON.parse(match[0]) as T[];
}

export async function callGarageAIJsonObject<T = any>(options: GarageAIOptions): Promise<T> {
  const text = await callGarageAIText({
    ...options,
    system: ["Return only valid JSON. Do not include markdown or extra prose.", options.system].filter(Boolean).join("\n"),
  });
  return parseJsonObjectFromModelText<T>(text);
}

export async function callGarageAIJsonArray<T = any>(options: GarageAIOptions): Promise<T[]> {
  const text = await callGarageAIText({
    ...options,
    system: ["Return only a valid JSON array. Do not include markdown or extra prose.", options.system].filter(Boolean).join("\n"),
  });
  return parseJsonArrayFromModelText<T>(text);
}

export async function callGarageAIVisionJsonObject<T = any>(
  prompt: string,
  mediaType: string,
  base64Data: string,
  options: Omit<GarageAIOptions, "prompt" | "messages"> = {},
): Promise<T> {
  const text = await callGarageAIVisionText(prompt, mediaType, base64Data, {
    ...options,
    system: ["Return only valid JSON. Do not include markdown or extra prose.", options.system].filter(Boolean).join("\n"),
  });
  return parseJsonObjectFromModelText<T>(text);
}
