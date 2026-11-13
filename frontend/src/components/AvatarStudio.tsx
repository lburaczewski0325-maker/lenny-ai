import { useState } from "react";
import {
  ACCESSORIES,
  BACKGROUNDS,
  DEFAULT_OPTIONS,
  EYE_COLORS,
  EXPRESSIONS,
  HEADWEAR,
  OUTFITS,
  SKINS,
  TRIM_COLORS,
  AvatarImage,
  AvatarSVG,
  deletePreset,
  getDefaultPresetId,
  loadPresets,
  renamePreset,
  savePreset,
  setDefaultPresetId,
  type AvatarOptions,
  type Preset,
} from "../lib/avatar";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{title}</label>
      <div className="chip-row">{children}</div>
    </div>
  );
}

export function AvatarStudio({ onDone }: { onDone: () => void }) {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [defaultId, setDefaultId] = useState<string>(() => getDefaultPresetId());
  const [draft, setDraft] = useState<AvatarOptions>(() => {
    const d = presets.find((p) => p.id === getDefaultPresetId());
    return d?.options ? { ...d.options } : { ...DEFAULT_OPTIONS };
  });
  const [draftName, setDraftName] = useState("");
  const [selectedId, setSelectedId] = useState<string>(() => getDefaultPresetId());
  const [note, setNote] = useState("");

  const set = <K extends keyof AvatarOptions>(key: K, value: AvatarOptions[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function refresh() {
    setPresets(loadPresets());
    setDefaultId(getDefaultPresetId());
  }

  function applyPreset(p: Preset) {
    setSelectedId(p.id);
    if (p.options) setDraft({ ...p.options });
    else setDraft({ ...DEFAULT_OPTIONS });
    setDefaultPresetId(p.id);
    refresh();
    setNote(`"${p.name}" is now your Boss everywhere in the app.`);
  }

  function saveDraft() {
    const name = draftName.trim() || "My Boss";
    const p = savePreset(name, draft);
    setDraftName("");
    refresh();
    setSelectedId(p.id);
    setNote(`Saved preset "${p.name}". Tap it in the row to make it your default.`);
  }

  function useDraftAsDefault() {
    const p = savePreset(draftName.trim() || "My Boss", draft);
    setDefaultPresetId(p.id);
    setDraftName("");
    refresh();
    setSelectedId(p.id);
    setNote(`"${p.name}" saved and set as your Boss everywhere.`);
  }

  const selected = presets.find((p) => p.id === selectedId);

  return (
    <div>
      <div className="card">
        <h2>Avatar studio</h2>
        <p>Build your Boss. Every change previews live — what you see is what shows up in chat.</p>
        <div className="preview-row">
          <div>
            <AvatarSVG options={draft} size={200} />
            <div className="cap">Full size</div>
          </div>
          <div>
            <AvatarSVG options={draft} size={56} />
            <div className="cap">Chat size</div>
          </div>
        </div>
        <Section title="Skin">
          {SKINS.map((s) => (
            <button
              key={s.value}
              className={`chip swatch${draft.skin === s.value ? " active" : ""}`}
              style={{ background: s.value }}
              title={s.name}
              onClick={() => set("skin", s.value)}
            />
          ))}
        </Section>
        <Section title="Eye color + glow">
          {EYE_COLORS.map((c) => (
            <button
              key={c.value}
              className={`chip swatch${draft.eyeColor === c.value ? " active" : ""}`}
              style={{ background: c.value }}
              title={c.name}
              onClick={() => set("eyeColor", c.value)}
            />
          ))}
          <button className={`chip${draft.eyeGlow ? " active" : ""}`} onClick={() => set("eyeGlow", !draft.eyeGlow)}>
            ✨ Glow {draft.eyeGlow ? "on" : "off"}
          </button>
        </Section>
        <Section title="Expression">
          {EXPRESSIONS.map((e) => (
            <button key={e} className={`chip${draft.expression === e ? " active" : ""}`} onClick={() => set("expression", e)}>
              {e}
            </button>
          ))}
        </Section>
        <Section title="Headwear">
          {HEADWEAR.map((h) => (
            <button key={h} className={`chip${draft.headwear === h ? " active" : ""}`} onClick={() => set("headwear", h)}>
              {h}
            </button>
          ))}
        </Section>
        {draft.headwear !== "none" && draft.headwear !== "crown" && (
          <Section title="Headwear trim">
            {TRIM_COLORS.map((c) => (
              <button
                key={c}
                className={`chip swatch${draft.headwearTrim === c ? " active" : ""}`}
                style={{ background: c }}
                onClick={() => set("headwearTrim", c)}
              />
            ))}
          </Section>
        )}
        <Section title="Outfit">
          {OUTFITS.map((o) => (
            <button key={o} className={`chip${draft.outfit === o ? " active" : ""}`} onClick={() => set("outfit", o)}>
              {o}
            </button>
          ))}
        </Section>
        <Section title="Outfit trim">
          {TRIM_COLORS.map((c) => (
            <button
              key={c}
              className={`chip swatch${draft.outfitTrim === c ? " active" : ""}`}
              style={{ background: c }}
              onClick={() => set("outfitTrim", c)}
            />
          ))}
        </Section>
        <Section title="Accent">
          {TRIM_COLORS.map((c) => (
            <button
              key={c}
              className={`chip swatch${draft.outfitAccent === c ? " active" : ""}`}
              style={{ background: c }}
              onClick={() => set("outfitAccent", c)}
            />
          ))}
        </Section>
        <Section title="Accessory">
          {ACCESSORIES.map((a) => (
            <button key={a} className={`chip${draft.accessory === a ? " active" : ""}`} onClick={() => set("accessory", a)}>
              {a}
            </button>
          ))}
        </Section>
        <Section title="Background">
          {BACKGROUNDS.map((b) => (
            <button key={b} className={`chip${draft.background === b ? " active" : ""}`} onClick={() => set("background", b)}>
              {b}
            </button>
          ))}
        </Section>
        <div className="field">
          <label>Save this look as a preset</label>
          <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="e.g. Night Shift" />
        </div>
        <div className="btn-row">
          <button className="btn" onClick={saveDraft}>Save preset</button>
          <button className="btn secondary" onClick={useDraftAsDefault}>Save + make it my Boss</button>
        </div>
        {note && <p style={{ marginTop: 8 }}>{note}</p>}
      </div>

      <div className="card">
        <h2>Your presets</h2>
        <p>Tap one to make it your Boss everywhere. Boss Classic can be restored, never deleted.</p>
        <div className="preset-row">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`preset${defaultId === p.id ? " active" : ""}`}
              onClick={() => applyPreset(p)}
            >
              <AvatarImage preset={p} size={64} />
              <span className="pname">{p.name}</span>
              {defaultId === p.id && <span className="pname" style={{ color: "var(--neon)" }}>● default</span>}
            </button>
          ))}
        </div>
        {selected && !selected.builtIn && (
          <div className="btn-row">
            <button
              className="btn secondary"
              onClick={() => {
                const name = prompt("Rename preset", selected.name);
                if (name) {
                  renamePreset(selected.id, name);
                  refresh();
                }
              }}
            >
              Rename
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (deletePreset(selected.id)) {
                  refresh();
                  setSelectedId("boss-classic");
                  setNote("Preset deleted. Boss Classic is your Boss again.");
                }
              }}
            >
              Delete preset
            </button>
          </div>
        )}
        <div className="btn-row">
          <button
            className="btn secondary"
            onClick={() => {
              setDefaultPresetId("boss-classic");
              refresh();
              setSelectedId("boss-classic");
              setDraft({ ...DEFAULT_OPTIONS });
              setNote("Boss Classic restored as your Boss.");
            }}
          >
            Restore Boss Classic
          </button>
          <button className="btn" onClick={onDone}>Done</button>
        </div>
      </div>
    </div>
  );
}
