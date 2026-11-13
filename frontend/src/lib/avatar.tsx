// Boss AI avatar engine — SVG avatar builder + presets.
// The built-in "Boss Classic" preset is the shipped PNG (boss-ai-avatar-v1).
// Custom presets are rendered live from these options. No video, no real faces.

import { BOSS_CLASSIC_DATA_URL } from "../assets/bossClassic";

export type Expression = "smirk" | "neutral" | "serious" | "grin";
export type Headwear = "flat cap" | "none" | "beanie" | "crown" | "headset" | "helmet";
export type Outfit = "suit" | "jacket" | "hoodie" | "armor" | "robe";
export type Accessory = "gold chain" | "none" | "sunglasses" | "earrings" | "badge";
export type Background = "nebula" | "plain dark" | "grid" | "planet" | "stars";

export type AvatarOptions = {
  skin: string;
  eyeColor: string;
  eyeGlow: boolean;
  expression: Expression;
  headwear: Headwear;
  headwearTrim: string;
  outfit: Outfit;
  outfitTrim: string;
  outfitAccent: string;
  accessory: Accessory;
  background: Background;
};

export const SKINS = [
  { name: "Charcoal", value: "#6b7280" },
  { name: "Grey", value: "#8a8f98" },
  { name: "Light grey", value: "#a8adb5" },
  { name: "Mint tint", value: "#7ef0c1" },
  { name: "Lilac tint", value: "#b79bff" },
  { name: "Pale", value: "#c9ced6" },
];

export const EYE_COLORS = [
  { name: "Green", value: "#39ff6a" },
  { name: "Cyan", value: "#22d3ee" },
  { name: "Purple", value: "#a78bfa" },
  { name: "Red", value: "#f87171" },
];

export const TRIM_COLORS = ["#39ff6a", "#22d3ee", "#a78bfa", "#f87171", "#d4af37", "#f8fafc"];

export const EXPRESSIONS: Expression[] = ["smirk", "neutral", "serious", "grin"];
export const HEADWEAR: Headwear[] = ["flat cap", "none", "beanie", "crown", "headset", "helmet"];
export const OUTFITS: Outfit[] = ["suit", "jacket", "hoodie", "armor", "robe"];
export const ACCESSORIES: Accessory[] = ["gold chain", "none", "sunglasses", "earrings", "badge"];
export const BACKGROUNDS: Background[] = ["nebula", "plain dark", "grid", "planet", "stars"];

export const DEFAULT_OPTIONS: AvatarOptions = {
  skin: "#8a8f98",
  eyeColor: "#39ff6a",
  eyeGlow: true,
  expression: "smirk",
  headwear: "flat cap",
  headwearTrim: "#39ff6a",
  outfit: "suit",
  outfitTrim: "#39ff6a",
  outfitAccent: "#d4af37",
  accessory: "gold chain",
  background: "nebula",
};

export type Preset = {
  id: string;
  name: string;
  options?: AvatarOptions;
  image?: string;
  builtIn?: boolean;
};

export const BOSS_CLASSIC_PRESET: Preset = {
  id: "boss-classic",
  name: "Boss Classic",
  image: BOSS_CLASSIC_DATA_URL,
  builtIn: true,
};

const PRESETS_KEY = "bossai.presets.v1";
const DEFAULT_PRESET_KEY = "bossai.defaultPreset";

export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [BOSS_CLASSIC_PRESET];
    const list = JSON.parse(raw) as Preset[];
    if (!list.some((p) => p.id === "boss-classic")) {
      list.unshift(BOSS_CLASSIC_PRESET);
    }
    return list;
  } catch {
    return [BOSS_CLASSIC_PRESET];
  }
}

function storePresets(list: Preset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

export function savePreset(name: string, options: AvatarOptions): Preset {
  const list = loadPresets();
  const preset: Preset = {
    id: `preset-${Date.now()}`,
    name: name.trim() || "My Boss",
    options: { ...options },
  };
  list.push(preset);
  storePresets(list);
  return preset;
}

export function renamePreset(id: string, name: string) {
  const list = loadPresets().map((p) =>
    p.id === id ? { ...p, name: name.trim() || p.name } : p,
  );
  storePresets(list);
}

export function deletePreset(id: string): boolean {
  const list = loadPresets();
  const target = list.find((p) => p.id === id);
  if (!target || target.builtIn) return false;
  storePresets(list.filter((p) => p.id !== id));
  if (getDefaultPresetId() === id) setDefaultPresetId("boss-classic");
  return true;
}

export function getDefaultPresetId(): string {
  return localStorage.getItem(DEFAULT_PRESET_KEY) || "boss-classic";
}

export function setDefaultPresetId(id: string) {
  localStorage.setItem(DEFAULT_PRESET_KEY, id);
}

export function getDefaultPreset(): Preset {
  const list = loadPresets();
  return list.find((p) => p.id === getDefaultPresetId()) || BOSS_CLASSIC_PRESET;
}

// ---------------------------------------------------------------- SVG avatar
function BackgroundLayer({ bg }: { bg: Background }) {
  const stars = [
    [18, 26], [42, 14], [70, 34], [96, 12], [130, 30], [160, 16], [188, 30],
    [214, 14], [30, 60], [210, 58], [14, 96], [226, 92], [52, 120], [192, 118],
  ];
  return (
    <g>
      <rect width="240" height="240" fill="#070a12" />
      {bg === "nebula" && (
        <g>
          <ellipse cx="60" cy="60" rx="80" ry="55" fill="#5b21b6" opacity="0.55" />
          <ellipse cx="190" cy="90" rx="75" ry="60" fill="#065f46" opacity="0.55" />
          <ellipse cx="130" cy="200" rx="90" ry="50" fill="#1e1b4b" opacity="0.6" />
        </g>
      )}
      {bg === "grid" && (
        <g stroke="#22d3ee" strokeWidth="1" opacity="0.25">
          {[40, 80, 120, 160, 200].map((x) => (
            <line key={x} x1={x} y1="0" x2={x} y2="240" />
          ))}
          {[40, 80, 120, 160, 200].map((y) => (
            <line key={y} x1="0" y1={y} x2="240" y2={y} />
          ))}
        </g>
      )}
      {bg === "planet" && (
        <g>
          <circle cx="188" cy="52" r="26" fill="#7c3aed" opacity="0.85" />
          <ellipse cx="188" cy="52" rx="40" ry="8" fill="none" stroke="#39ff6a" strokeWidth="2" transform="rotate(-18 188 52)" />
        </g>
      )}
      {(bg === "nebula" || bg === "stars" || bg === "planet") &&
        stars.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.1} fill="#e2e8f0" opacity="0.85" />
        ))}
    </g>
  );
}

function Mouth({ expression }: { expression: Expression }) {
  const dark = "#14171d";
  if (expression === "smirk") {
    return <path d="M102 144 Q120 152 138 140" stroke={dark} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  }
  if (expression === "neutral") {
    return <line x1="106" y1="144" x2="134" y2="144" stroke={dark} strokeWidth="3.5" strokeLinecap="round" />;
  }
  if (expression === "serious") {
    return <path d="M104 148 Q120 140 136 148" stroke={dark} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  }
  return (
    <g>
      <path d="M102 140 Q120 162 138 140 Q120 148 102 140 Z" fill={dark} />
      <path d="M104 141 Q120 148 136 141" stroke="#f8fafc" strokeWidth="2" fill="none" />
    </g>
  );
}

function HeadwearLayer({ headwear, trim, skin }: { headwear: Headwear; trim: string; skin: string }) {
  if (headwear === "none") return null;
  if (headwear === "flat cap") {
    return (
      <g>
        <path d="M62 96 Q120 30 178 96 Q120 72 62 96 Z" fill="#0d1117" stroke={trim} strokeWidth="2.5" />
        <ellipse cx="120" cy="94" rx="60" ry="9" fill="#0d1117" stroke={trim} strokeWidth="2" />
      </g>
    );
  }
  if (headwear === "beanie") {
    return (
      <g>
        <path d="M66 100 Q66 44 120 44 Q174 44 174 100 L174 92 L66 92 Z" fill="#1f2937" stroke={trim} strokeWidth="2.5" />
        <rect x="64" y="86" width="112" height="16" rx="8" fill="#111827" stroke={trim} strokeWidth="2" />
        <circle cx="120" cy="42" r="9" fill={trim} />
      </g>
    );
  }
  if (headwear === "crown") {
    return (
      <polygon
        points="78,88 88,52 104,76 120,46 136,76 152,52 162,88"
        fill="#d4af37"
        stroke="#f5d76e"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    );
  }
  if (headwear === "headset") {
    return (
      <g>
        <path d="M66 118 Q66 46 120 46 Q174 46 174 118" fill="none" stroke="#1f2937" strokeWidth="7" strokeLinecap="round" />
        <rect x="58" y="108" width="16" height="28" rx="8" fill="#111827" stroke={trim} strokeWidth="2" />
        <rect x="166" y="108" width="16" height="28" rx="8" fill="#111827" stroke={trim} strokeWidth="2" />
      </g>
    );
  }
  // helmet
  return (
    <g>
      <circle cx="120" cy="104" r="66" fill="none" stroke={skin} strokeWidth="10" opacity="0.9" />
      <circle cx="120" cy="104" r="66" fill="none" stroke={trim} strokeWidth="2" />
      <rect x="88" y="52" width="64" height="10" rx="5" fill={trim} opacity="0.8" />
    </g>
  );
}

export function AvatarSVG({ options, size = 240 }: { options: AvatarOptions; size?: number }) {
  const { skin, eyeColor, eyeGlow, expression, headwear, headwearTrim, outfit, outfitTrim, outfitAccent, accessory, background } = options;
  const outfitFill = outfit === "armor" ? "#475569" : outfit === "hoodie" ? "#1e293b" : outfit === "robe" ? "#312e81" : "#0d1117";
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" role="img" aria-label="Boss AI avatar preview">
      <defs>
        <filter id="eyeGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <BackgroundLayer bg={background} />
      {/* shoulders / outfit */}
      <path d="M18 240 L42 188 Q120 162 198 188 L222 240 Z" fill={outfitFill} stroke={outfitTrim} strokeWidth="2.5" />
      {outfit === "hoodie" && (
        <g>
          <path d="M84 178 Q120 158 156 178 L150 196 Q120 182 90 196 Z" fill="#0f172a" stroke={outfitTrim} strokeWidth="2" />
          <line x1="110" y1="196" x2="108" y2="222" stroke={outfitTrim} strokeWidth="2.5" />
          <line x1="130" y1="196" x2="132" y2="222" stroke={outfitTrim} strokeWidth="2.5" />
        </g>
      )}
      {outfit === "suit" || outfit === "jacket" ? (
        <g>
          <path d="M120 176 L96 240 L144 240 Z" fill="#f8fafc" opacity="0.92" />
          <path d="M120 176 L104 200 L120 240 L136 200 Z" fill={outfitAccent} />
          <path d="M84 186 L120 210 L102 240" fill="none" stroke={outfitTrim} strokeWidth="2" />
          <path d="M156 186 L120 210 L138 240" fill="none" stroke={outfitTrim} strokeWidth="2" />
        </g>
      ) : null}
      {outfit === "armor" && (
        <g>
          <rect x="52" y="188" width="34" height="12" rx="6" fill="#64748b" stroke={outfitTrim} strokeWidth="1.5" />
          <rect x="154" y="188" width="34" height="12" rx="6" fill="#64748b" stroke={outfitTrim} strokeWidth="1.5" />
          <circle cx="120" cy="212" r="9" fill={outfitAccent} stroke={outfitTrim} strokeWidth="1.5" />
        </g>
      )}
      {outfit === "robe" && (
        <path d="M96 190 Q120 178 144 190 L140 240 L100 240 Z" fill="none" stroke={outfitTrim} strokeWidth="2" />
      )}
      {/* head */}
      <ellipse cx="120" cy="106" rx="54" ry="60" fill={skin} stroke="#00000055" strokeWidth="2" />
      {/* eyes */}
      <g filter={eyeGlow ? "url(#eyeGlow)" : undefined}>
        <ellipse cx="96" cy="102" rx="15" ry="23" fill={eyeColor} transform="rotate(-16 96 102)" />
        <ellipse cx="144" cy="102" rx="15" ry="23" fill={eyeColor} transform="rotate(16 144 102)" />
      </g>
      <ellipse cx="97" cy="106" rx="6" ry="11" fill="#062b12" transform="rotate(-16 97 106)" />
      <ellipse cx="143" cy="106" rx="6" ry="11" fill="#062b12" transform="rotate(16 143 106)" />
      {/* nose + mouth */}
      <circle cx="114" cy="126" r="1.6" fill="#00000044" />
      <circle cx="126" cy="126" r="1.6" fill="#00000044" />
      <Mouth expression={expression} />
      {/* headwear + accessories */}
      <HeadwearLayer headwear={headwear} trim={headwearTrim} skin={skin} />
      {accessory === "gold chain" && (
        <g>
          <path d="M82 196 Q120 216 158 196" fill="none" stroke="#d4af37" strokeWidth="4" />
          <circle cx="120" cy="210" r="5" fill="#d4af37" stroke="#f5d76e" strokeWidth="1.5" />
        </g>
      )}
      {accessory === "sunglasses" && (
        <g>
          <rect x="76" y="90" width="34" height="20" rx="9" fill="#0f172a" stroke={outfitTrim} strokeWidth="1.5" />
          <rect x="130" y="90" width="34" height="20" rx="9" fill="#0f172a" stroke={outfitTrim} strokeWidth="1.5" />
          <line x1="110" y1="98" x2="130" y2="98" stroke="#0f172a" strokeWidth="3" />
        </g>
      )}
      {accessory === "earrings" && (
        <g fill="#d4af37">
          <circle cx="66" cy="122" r="4" />
          <circle cx="174" cy="122" r="4" />
        </g>
      )}
      {accessory === "badge" && (
        <g>
          <circle cx="168" cy="212" r="10" fill={outfitAccent} stroke="#f8fafc" strokeWidth="1.5" />
          <text x="168" y="216" textAnchor="middle" fontSize="11" fill="#0f172a" fontWeight="bold">B</text>
        </g>
      )}
    </svg>
  );
}

export function AvatarImage({ preset, size = 64 }: { preset: Preset; size?: number }) {
  if (preset.image) {
    return (
      <img
        src={preset.image}
        alt={preset.name}
        width={size}
        height={size}
        style={{ borderRadius: size >= 120 ? 18 : "50%", objectFit: "cover", display: "block" }}
      />
    );
  }
  return <AvatarSVG options={preset.options || DEFAULT_OPTIONS} size={size} />;
}
