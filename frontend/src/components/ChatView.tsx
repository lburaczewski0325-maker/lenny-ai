import { useEffect, useRef, useState } from "react";
import {
  chatWithOwnKeys,
  serverChat,
  validateGeminiKey,
  type ChatMessage,
  type OwnKeys,
} from "../lib/api";
import { isLenny, type Session } from "../lib/auth";

export function KeySetupCard({ onSaved }: { onSaved: (key: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [manual, setManual] = useState("");

  async function pasteKey(key: string) {
    const k = key.trim();
    if (!k.startsWith("AIza")) {
      setNote("That doesn't look like a Google API key — it should start with AIza. Copy it again from AI Studio.");
      return;
    }
    setBusy(true);
    setNote("Checking the key…");
    const ok = await validateGeminiKey(k);
    setBusy(false);
    if (ok) {
      onSaved(k);
      setNote("Key saved on this device. You're chatting on your own free quota.");
    } else {
      setNote("Google didn't accept that key. Double-check you copied the whole thing.");
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setNote("Clipboard was empty — tap Copy in AI Studio first, then come back.");
        return;
      }
      await pasteKey(text);
    } catch {
      setNote("This browser blocked clipboard access — paste the key in the box below instead.");
    }
  }

  return (
    <div className="card">
      <h2>Your free key — one tap</h2>
      <p>
        Boss AI runs on <b>your</b> free Google quota, so nobody shares anyone else's. It takes three taps:
        get the key, copy it, paste it here. The key stays on this device only.
      </p>
      <div className="btn-row">
        <button
          className="btn"
          onClick={() => window.open("https://aistudio.google.com/apikey", "_blank")}
        >
          1 · Get your free key
        </button>
        <button className="btn secondary" onClick={pasteFromClipboard} disabled={busy}>
          2 · Paste my key
        </button>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Or paste it here manually</label>
        <input
          type="password"
          placeholder="AIza…"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
      </div>
      <button className="btn secondary" disabled={busy || !manual.trim()} onClick={() => pasteKey(manual)}>
        Save key
      </button>
      {note && <p style={{ marginTop: 8 }}>{note}</p>}
    </div>
  );
}

type Msg = ChatMessage & { provider?: string; model?: string; fallback?: boolean; error?: boolean };

const SUGGESTIONS = [
  "Explain black holes like I'm 12",
  "Give me a 3-step plan to change a flat tire",
  "Write a quick alien joke",
  "What can Boss AI do?",
];

const CHAT_STORE = "bossai.chat.v1";

export function ChatView({
  session,
  keys,
  onKeysSaved,
}: {
  session: Session | null;
  keys: OwnKeys;
  onKeysSaved: (key: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAT_STORE) || "[]") as Msg[];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showKeyCard, setShowKeyCard] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasOwnKey = !!(keys.gemini || keys.groq || keys.openrouter);
  const canChat = hasOwnKey || isLenny(session);

  useEffect(() => {
    localStorage.setItem(CHAT_STORE, JSON.stringify(messages.slice(-50)));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      let result;
      if (hasOwnKey) {
        result = await chatWithOwnKeys(keys, next);
      } else if (isLenny(session) && session) {
        result = await serverChat(next, session.idToken);
      } else {
        setShowKeyCard(true);
        setMessages([
          ...next,
          {
            role: "assistant",
            content:
              "I need a key before I can answer — add your free Google key below, or sign in as Lenny. It takes about a minute.",
            error: true,
          },
        ]);
        setBusy(false);
        return;
      }
      setMessages([
        ...next,
        {
          role: "assistant",
          content: result.reply,
          provider: result.provider,
          model: result.model,
          fallback: result.fallback,
        },
      ]);
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Couldn't get an answer: ${e instanceof Error ? e.message : String(e)} Try again — the fallback chain retries the next provider automatically.`,
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {showKeyCard && !hasOwnKey && !isLenny(session) && (
        <KeySetupCard
          onSaved={(k) => {
            onKeysSaved(k);
            setShowKeyCard(false);
          }}
        />
      )}
      {messages.length === 0 && (
        <div className="empty">
          <p style={{ fontSize: 17, color: "var(--text)" }}>👽 Yo. I'm Boss AI.</p>
          <p>Ask me anything — I'll explain it plain, detailed, and straight. If one brain is busy, I fall back to the next automatically.</p>
          <div className="chip-row" style={{ justifyContent: "center", marginTop: 12 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
          {!canChat && (
            <p style={{ marginTop: 14 }}>
              <button className="btn secondary" onClick={() => setShowKeyCard(true)}>
                Set up my free key
              </button>
            </p>
          )}
        </div>
      )}
      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.error ? " error" : ""}`}>
            {m.content}
            {m.role === "assistant" && m.provider && (
              <span className="meta">
                answered by {m.provider} · {m.model}
              </span>
            )}
            {m.role === "assistant" && m.fallback && (
              <span className="fallback-note">
                ⚡ First choice was busy — fell back automatically, no dead end.
              </span>
            )}
          </div>
        ))}
        {busy && <div className="spinner">Boss is thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Boss AI anything…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="btn" disabled={busy || !input.trim()} onClick={() => send(input)}>
          Send
        </button>
      </div>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button
          className="btn secondary"
          onClick={() => {
            setMessages([]);
            localStorage.removeItem(CHAT_STORE);
          }}
        >
          Clear chat
        </button>
      </div>
    </div>
  );
}
