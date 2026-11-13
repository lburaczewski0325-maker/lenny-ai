// Boss AI API layer.
// Two paths, by design:
//  - Lenny (signed in with Google as Lenny): server endpoints on Render,
//    which use Lenny's keys from env vars. Verified server-side.
//  - Everyone else: their OWN free key, called straight from this device.
//    Their key never leaves their phone/computer.

export const API_BASE =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env
    .VITE_API_URL || "https://lenny-ai-ur2d.onrender.com";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatResult = {
  provider: string;
  model: string;
  reply: string;
  fallback: boolean;
  tried?: { provider: string; model: string; ok: boolean; error?: string }[];
};

export type OwnKeys = { gemini?: string; groq?: string; openrouter?: string };

const SYSTEM_PROMPT =
  "You are Boss AI, a straight-talking AI assistant. Explain things in plain, everyday language anyone can follow. Be detailed and accurate: give the full answer, with steps when the user asks how to do something. No fluff, no filler, no repeating the question back. If you are not sure about a fact, say so plainly instead of guessing.";

const GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3-32b"];
const OPENROUTER_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-super-vl:free",
];

async function postJson(url: string, body: unknown, timeoutMs = 90000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg =
        (data as { message?: string }).message ||
        (data as { error?: string }).error ||
        `HTTP ${r.status}`;
      throw new Error(typeof msg === "string" ? msg : `HTTP ${r.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function getConfig(): Promise<{ google_client_id: string | null }> {
  const r = await fetch(`${API_BASE}/api/config`);
  if (!r.ok) throw new Error("config fetch failed");
  return (await r.json()) as { google_client_id: string | null };
}

export async function getStatus(): Promise<{
  providers: Record<string, boolean>;
  version?: string;
}> {
  const r = await fetch(`${API_BASE}/api/status`);
  if (!r.ok) throw new Error("status fetch failed");
  return (await r.json()) as { providers: Record<string, boolean>; version?: string };
}

// ---- Lenny path: server endpoints (server keys, verified by Google token) ----
export async function serverChat(
  messages: ChatMessage[],
  idToken: string,
): Promise<ChatResult> {
  const data = (await postJson(`${API_BASE}/api/chat`, {
    messages: messages.slice(-20),
    id_token: idToken,
  })) as ChatResult;
  return data;
}

export async function serverImage(
  prompt: string,
  idToken: string,
): Promise<{ model: string; image: string }> {
  const data = (await postJson(
    `${API_BASE}/api/image`,
    { prompt, id_token: idToken },
    150000,
  )) as { model: string; image: string };
  return data;
}

export async function serverResearch(
  query: string,
  idToken: string,
): Promise<{ answer: string; sources: { title: string; url: string }[]; live: boolean; provider: string }> {
  const data = (await postJson(
    `${API_BASE}/api/research`,
    { query, id_token: idToken },
    120000,
  )) as { answer: string; sources: { title: string; url: string }[]; live: boolean; provider: string };
  return data;
}

// ---- Everyone-else path: direct provider calls with the user's OWN key ----
function geminiBody(messages: ChatMessage[]) {
  return {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
}

export async function geminiDirect(key: string, messages: ChatMessage[]): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody(messages.slice(-20))),
    },
  );
  if (!r.ok) throw new Error(`Gemini HTTP ${r.status}`);
  const data = (await r.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned an empty reply");
  return text;
}

export async function validateGeminiKey(key: string): Promise<boolean> {
  try {
    await geminiDirect(key, [{ role: "user", content: "Reply with just the word OK." }]);
    return true;
  } catch {
    return false;
  }
}

async function openAiCompatibleDirect(
  url: string,
  key: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(url.includes("openrouter")
        ? { "HTTP-Referer": window.location.origin, "X-Title": "Boss AI" }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.slice(-20),
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });
  if (!r.ok) throw new Error(`${model} HTTP ${r.status}`);
  const data = (await r.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error(`${model} returned an empty reply`);
  return text;
}

/** Per-user fallback chain with the user's OWN keys: Gemini -> Groq -> OpenRouter. */
export async function chatWithOwnKeys(
  keys: OwnKeys,
  messages: ChatMessage[],
): Promise<ChatResult> {
  const tried: ChatResult["tried"] = [];
  if (keys.gemini) {
    try {
      const reply = await geminiDirect(keys.gemini, messages);
      tried.push({ provider: "gemini", model: GEMINI_MODEL, ok: true });
      return { provider: "gemini", model: GEMINI_MODEL, reply, fallback: false, tried };
    } catch (e) {
      tried.push({ provider: "gemini", model: GEMINI_MODEL, ok: false, error: String(e).slice(0, 120) });
    }
  }
  if (keys.groq) {
    for (const model of GROQ_MODELS) {
      try {
        const reply = await openAiCompatibleDirect(
          "https://api.groq.com/openai/v1/chat/completions",
          keys.groq,
          model,
          messages,
        );
        tried.push({ provider: "groq", model, ok: true });
        return { provider: "groq", model, reply, fallback: tried.some((t) => !t.ok), tried };
      } catch (e) {
        tried.push({ provider: "groq", model, ok: false, error: String(e).slice(0, 120) });
      }
    }
  }
  if (keys.openrouter) {
    for (const model of OPENROUTER_MODELS) {
      try {
        const reply = await openAiCompatibleDirect(
          "https://openrouter.ai/api/v1/chat/completions",
          keys.openrouter,
          model,
          messages,
        );
        tried.push({ provider: "openrouter", model, ok: true });
        return { provider: "openrouter", model, reply, fallback: tried.some((t) => !t.ok), tried };
      } catch (e) {
        tried.push({ provider: "openrouter", model, ok: false, error: String(e).slice(0, 120) });
      }
    }
  }
  throw new Error("No working key. Add your free Gemini key in Settings, or sign in as Lenny.");
}
