import { useState } from "react";
import { geminiDirect, serverResearch, type OwnKeys } from "../lib/api";
import { isLenny, type Session } from "../lib/auth";

export function ResearchView({
  session,
  keys,
}: {
  session: Session | null;
  keys: OwnKeys;
}) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<{ title: string; url: string }[]>([]);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lenny = isLenny(session);

  async function run() {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    setSources([]);
    try {
      if (lenny && session) {
        const res = await serverResearch(q, session.idToken);
        setAnswer(res.answer);
        setSources(res.sources);
        setLive(res.live);
      } else if (keys.gemini) {
        const text = await geminiDirect(keys.gemini, [
          {
            role: "user",
            content:
              `Research this question and answer it in plain, detailed language. ` +
              `If you are not sure about a current fact, say so instead of guessing.\n\nQuestion: ${q}`,
          },
        ]);
        setAnswer(text);
        setSources([]);
        setLive(false);
      } else {
        setError("Add your free Gemini key in Settings, or sign in as Lenny, to research.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Deep research</h2>
        <p>
          {lenny
            ? "Live web search (Tavily) + Gemini summary, with sources for every key fact."
            : "Answered from the model's own knowledge. Live web sources need Lenny's Tavily key — sign in as Lenny for the full version."}
        </p>
        <div className="field">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What's the latest on…?"
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
          />
        </div>
        <button className="btn" disabled={busy || !query.trim()} onClick={run}>
          {busy ? "Researching…" : "Research it"}
        </button>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        {answer && (
          <div style={{ marginTop: 12 }}>
            <p style={{ whiteSpace: "pre-wrap", color: "var(--text)", lineHeight: 1.6 }}>{answer}</p>
            {sources.length > 0 && (
              <div>
                <h3>Sources</h3>
                <ul className="source-list">
                  {sources.map((s, i) => (
                    <li key={i}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title || s.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="kv">{live ? "✓ Live sources checked" : "○ No live sources this time"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
