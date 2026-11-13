import { useState } from "react";
import { serverImage } from "../lib/api";
import { isLenny, type Session } from "../lib/auth";

export function ImageView({ session }: { session: Session | null }) {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lenny = isLenny(session);

  async function generate() {
    const p = prompt.trim();
    if (!p || busy || !lenny || !session) return;
    setBusy(true);
    setError("");
    setImage("");
    try {
      const res = await serverImage(p, session.idToken);
      setImage(res.image);
      setModel(res.model);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!lenny && (
        <div className="notice">
          Images run on Boss's Cloudflare key, so image generation is Lenny-only right now.
          Sign in as Lenny in Settings to use it.
        </div>
      )}
      <div className="card">
        <h2>Make an image</h2>
        <p>Describe it — Boss draws it with FLUX (free tier, ~57 a day on the shared key).</p>
        <div className="field">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A neon alien boss in a black suit, space background…"
            disabled={!lenny}
            onKeyDown={(e) => {
              if (e.key === "Enter") generate();
            }}
          />
        </div>
        <button className="btn" disabled={busy || !prompt.trim() || !lenny} onClick={generate}>
          {busy ? "Drawing…" : "Generate image"}
        </button>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        {image && (
          <div>
            <img className="gen-image" src={image} alt={prompt} />
            <p className="kv">
              Model: <b>{model}</b>
            </p>
            <a href={image} download="boss-ai-image.png">
              Download image
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
