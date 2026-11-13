import { BOSS_CLASSIC_DATA_URL } from "../assets/bossClassic";

export function FirstLaunch({
  onChoice,
}: {
  onChoice: (choice: "customize" | "keep" | "later") => void;
}) {
  return (
    <div className="card" style={{ textAlign: "center", marginTop: 16 }}>
      <img
        src={BOSS_CLASSIC_DATA_URL}
        alt="Boss Classic — the default Boss AI avatar"
        width={220}
        height={220}
        style={{ borderRadius: 18, border: "2px solid var(--neon)", boxShadow: "0 0 30px rgba(57,255,106,.3)" }}
      />
      <h2 style={{ marginTop: 14 }}>Want to change the avatar details?</h2>
      <p>
        This is Boss Classic — your Boss as he comes. You can restyle him in the avatar studio
        (look, headwear, outfit, background), save your own presets, or keep him exactly like this.
      </p>
      <div className="btn-row" style={{ flexDirection: "column" }}>
        <button className="btn" onClick={() => onChoice("customize")}>
          Customize now
        </button>
        <button className="btn secondary" onClick={() => onChoice("keep")}>
          Keep this one
        </button>
        <button className="btn secondary" onClick={() => onChoice("later")}>
          Later
        </button>
      </div>
      <p style={{ fontSize: 12 }}>“Keep this one” means I won't ask again. “Later” asks again next launch.</p>
    </div>
  );
}
