import { useEffect, useRef, useState } from "react";
import { validateGeminiKey, type OwnKeys } from "../lib/api";
import { clearSession, isLenny, renderGoogleButton, type Session } from "../lib/auth";

const KEYS_STORE = "bossai.keys";

export function loadKeys(): OwnKeys {
  try {
    return JSON.parse(localStorage.getItem(KEYS_STORE) || "{}") as OwnKeys;
  } catch {
    return {};
  }
}

export function storeKeys(keys: OwnKeys) {
  localStorage.setItem(KEYS_STORE, JSON.stringify(keys));
}

export function SettingsView({
  session,
  clientId,
  keys,
  onSession,
  onKeys,
  onOpenStudio,
  providers,
}: {
  session: Session | null;
  clientId: string | null;
  keys: OwnKeys;
  onSession: (s: Session | null) => void;
  onKeys: (k: OwnKeys) => void;
  onOpenStudio: () => void;
  providers: Record<string, boolean>;
}) {
  const [gemini, setGemini] = useState(keys.gemini || "");
  const [groq, setGroq] = useState(keys.groq || "");
  const [openrouter, setOpenrouter] = useState(keys.openrouter || "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session && clientId && btnRef.current) {
      // Small delay so the Google script has loaded.
      const t = setTimeout(() => {
        if (btnRef.current) renderGoogleButton(btnRef.current, clientId, onSession);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [session, clientId, onSession]);

  function saveAll() {
    const next: OwnKeys = {};
    if (gemini.trim()) next.gemini = gemini.trim();
    if (groq.trim()) next.groq = groq.trim();
    if (openrouter.trim()) next.openrouter = openrouter.trim();
    onKeys(next);
    storeKeys(next);
    setNote("Keys saved on this device only. They are never sent to Lenny's server.");
  }

  async function testGemini() {
    const k = gemini.trim();
    if (!k) return;
    setBusy(true);
    setNote("Checking the Gemini key…");
    const ok = await validateGeminiKey(k);
    setBusy(false);
    setNote(ok ? "Gemini key works." : "Google didn't accept that key — check the copy.");
  }

  return (
    <div>
      <div className="card">
        <h2>Sign in</h2>
        {session ? (
          <div>
            <p>
              Signed in as <b>{session.name}</b> ({session.email})
              {isLenny(session) ? " — that's Lenny, so the server keys are live." : " — chatting on your own free quota."}
            </p>
            <button
              className="btn secondary"
              onClick={() => {
                clearSession();
                onSession(null);
              }}
            >
              Sign out
            </button>
          </div>
        ) : clientId ? (
          <div>
            <p>Sign in with Google — one account, one set of free quotas. Lenny's keys only serve Lenny.</p>
            <div ref={btnRef} />
            <p style={{ marginTop: 10 }}>
              No Google account? You can skip sign-in and just add your free key below — chat still works on your own quota.
            </p>
          </div>
        ) : (
          <div className="notice">
            Google sign-in isn't set up for this web address yet — the app needs its Google sign-in
            key added for this domain. You can still chat with your own free key below.
          </div>
        )}
      </div>

      <div className="card">
        <h2>My free keys</h2>
        <p>
          Each user brings their own free key — that's how everyone stays on the free tier.
          Keys are stored on this device only, never in the app's code and never on Lenny's server.
        </p>
        <div className="field">
          <label>Gemini key (Google AI Studio — free)</label>
          <input type="password" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder="AIza…" />
        </div>
        <div className="field">
          <label>Groq key (console.groq.com — free, optional fallback)</label>
          <input type="password" value={groq} onChange={(e) => setGroq(e.target.value)} placeholder="gsk_…" />
        </div>
        <div className="field">
          <label>OpenRouter key (openrouter.ai — free, optional fallback)</label>
          <input type="password" value={openrouter} onChange={(e) => setOpenrouter(e.target.value)} placeholder="sk-or-v1-…" />
        </div>
        <div className="btn-row">
          <button className="btn" onClick={saveAll}>Save keys</button>
          <button className="btn secondary" disabled={busy || !gemini.trim()} onClick={testGemini}>
            Test Gemini key
          </button>
          <button
            className="btn danger"
            onClick={() => {
              onKeys({});
              storeKeys({});
              setGemini("");
              setGroq("");
              setOpenrouter("");
              setNote("Keys cleared from this device.");
            }}
          >
            Clear keys
          </button>
        </div>
        {note && <p style={{ marginTop: 8 }}>{note}</p>}
        <p style={{ marginTop: 10 }}>
          Get a free Gemini key:{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Google AI Studio
          </a>{" "}
          → Create API key → Copy → paste it above.
        </p>
      </div>

      <div className="card">
        <h2>Avatar</h2>
        <p>Change your Boss's look, save presets, pick a default.</p>
        <button className="btn secondary" onClick={onOpenStudio}>Open avatar studio</button>
      </div>

      <div className="card">
        <h2>Boss AI status</h2>
        <p className="kv">
          Backend: <b>lenny-ai-ur2d.onrender.com</b>
        </p>
        {Object.entries(providers).map(([name, on]) => (
          <p className="kv" key={name}>
            {name}: <b>{on ? "configured ✓" : "not configured"}</b>
          </p>
        ))}
        <p className="kv">
          Chat chain: <b>Gemini → Groq gpt-oss-120b / Qwen3 → OpenRouter Nemotron (free)</b>
        </p>
        <p className="kv">
          Images: <b>Cloudflare FLUX</b> · Research: <b>Tavily + Gemini</b> · Video: <b>not included</b>
        </p>
      </div>
    </div>
  );
}
