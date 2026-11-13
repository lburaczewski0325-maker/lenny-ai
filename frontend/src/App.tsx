import { useEffect, useState } from "react";
import { getConfig, getStatus, type OwnKeys } from "./lib/api";
import { clearSession, isLenny, loadSession, type Session } from "./lib/auth";
import { AvatarImage, getDefaultPreset, setDefaultPresetId } from "./lib/avatar";
import { ChatView } from "./components/ChatView";
import { ImageView } from "./components/ImageView";
import { ResearchView } from "./components/ResearchView";
import { AvatarStudio } from "./components/AvatarStudio";
import { SettingsView, loadKeys, storeKeys } from "./components/SettingsView";
import { FirstLaunch } from "./components/FirstLaunch";

type Mode = "chat" | "image" | "research" | "studio" | "settings";

const ONBOARD_KEY = "bossai.onboarded";

export default function App() {
  const [mode, setMode] = useState<Mode>("chat");
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [keys, setKeys] = useState<OwnKeys>(() => loadKeys());
  const [clientId, setClientId] = useState<string | null>(null);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [onboarded, setOnboarded] = useState<string | null>(() =>
    localStorage.getItem(ONBOARD_KEY),
  );
  const [avatarTick, setAvatarTick] = useState(0);

  useEffect(() => {
    getConfig()
      .then((c) => setClientId(c.google_client_id))
      .catch(() => setClientId(null));
    getStatus()
      .then((s) => {
        setProviders(s.providers || {});
        setBackendUp(true);
      })
      .catch(() => setBackendUp(false));
  }, []);

  function handleSession(s: Session | null) {
    setSession(s);
    if (!s) clearSession();
  }

  function handleKeysSaved(geminiKey: string) {
    const next = { ...keys, gemini: geminiKey };
    setKeys(next);
    storeKeys(next);
  }

  function handleFirstLaunch(choice: "customize" | "keep" | "later") {
    if (choice === "customize") {
      localStorage.setItem(ONBOARD_KEY, "done");
      setOnboarded("done");
      setMode("studio");
    } else if (choice === "keep") {
      setDefaultPresetId("boss-classic");
      localStorage.setItem(ONBOARD_KEY, "done");
      setOnboarded("done");
      setAvatarTick((t) => t + 1);
    } else {
      // Later: keep Boss Classic for now, ask again next launch.
      setDefaultPresetId("boss-classic");
      setAvatarTick((t) => t + 1);
    }
  }

  const preset = getDefaultPreset();
  void avatarTick;

  return (
    <div className="app">
      <header className="header">
        <button
          className="avatar-btn"
          title="Avatar studio"
          onClick={() => setMode("studio")}
        >
          <AvatarImage preset={preset} size={48} />
        </button>
        <div className="titles">
          <h1>BOSS AI</h1>
          <div className="sub">
            {session ? (
              <>👽 {session.name}{isLenny(session) ? " · Lenny mode" : ""}</>
            ) : (
              "Free models fused into one"
            )}
          </div>
        </div>
        <span className={`status-dot${backendUp === false ? " down" : ""}`}>
          <span className="dot" />
          {backendUp === null ? "…" : backendUp ? "Live" : "Backend down"}
        </span>
        <button className="icon-btn" title="Settings" onClick={() => setMode("settings")}>
          ⚙️
        </button>
      </header>

      {!onboarded && (
        <FirstLaunch onChoice={handleFirstLaunch} />
      )}

      {onboarded && (
        <>
          <nav className="tabs">
            <button className={`tab${mode === "chat" ? " active" : ""}`} onClick={() => setMode("chat")}>
              💬 Chat
            </button>
            <button className={`tab${mode === "image" ? " active" : ""}`} onClick={() => setMode("image")}>
              🎨 Images
            </button>
            <button className={`tab${mode === "research" ? " active" : ""}`} onClick={() => setMode("research")}>
              🔍 Research
            </button>
          </nav>

          {mode === "chat" && (
            <ChatView session={session} keys={keys} onKeysSaved={handleKeysSaved} />
          )}
          {mode === "image" && <ImageView session={session} />}
          {mode === "research" && <ResearchView session={session} keys={keys} />}
          {mode === "studio" && (
            <AvatarStudio
              onDone={() => {
                setAvatarTick((t) => t + 1);
                setMode("chat");
              }}
            />
          )}
          {mode === "settings" && (
            <SettingsView
              session={session}
              clientId={clientId}
              keys={keys}
              onSession={handleSession}
              onKeys={(k) => {
                setKeys(k);
                storeKeys(k);
              }}
              onOpenStudio={() => setMode("studio")}
              providers={providers}
            />
          )}
        </>
      )}

      <footer className="footer">
        Boss AI · free models fused into one · your keys stay on your device · no video, by design
      </footer>
    </div>
  );
}
