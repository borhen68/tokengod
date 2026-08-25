import { ImageResponse } from "next/og";

export const alt = "TokenGod — the transparent AI token efficiency leaderboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", padding: "56px 62px", color: "#f7fbfd", background: "#06131d", fontFamily: "Arial, sans-serif" }}>
        <div style={{ position: "absolute", right: -80, top: -100, width: 520, height: 520, borderRadius: 999, border: "70px solid rgba(77,214,248,.12)", display: "flex" }} />
        <div style={{ width: 760, display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 850 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "#bfff5b" }}>
              {[18, 25, 18].map((width, index) => <i key={index} style={{ width, height: 3, display: "flex", borderRadius: 99, background: "#06131d" }} />)}
            </span>
            TOKEN<span style={{ color: "#62ddff", marginLeft: -12 }}>GOD</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 78, fontSize: 74, lineHeight: .98, fontWeight: 850, letterSpacing: -4 }}>
            <span>Who turned the most</span><span style={{ color: "#62ddff" }}>tokens into money?</span>
          </div>
          <div style={{ marginTop: 28, display: "flex", color: "#a9bdca", fontSize: 23 }}>Visible proof labels. Public respect and public roasting.</div>
          <div style={{ marginTop: "auto", display: "flex", gap: 12 }}>
            <span style={{ border: "1px solid rgba(191,255,91,.35)", color: "#bfff5b", borderRadius: 999, padding: "10px 15px", fontSize: 14 }}>90-DAY LABELED</span>
            <span style={{ border: "1px solid rgba(98,221,255,.28)", color: "#92ddef", borderRadius: 999, padding: "10px 15px", fontSize: 14 }}>❤️ RESPECT · 😂 ROAST</span>
          </div>
        </div>
        <div style={{ width: 260, height: 470, alignSelf: "center", marginLeft: "auto", border: "3px solid rgba(148,220,238,.5)", borderRadius: 30, display: "flex", position: "relative", overflow: "hidden", background: "rgba(255,255,255,.03)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "72%", background: "rgba(42,196,236,.72)", borderTop: "5px solid #6de3ff", display: "flex" }} />
          <div style={{ position: "absolute", left: 42, right: 42, top: 70, display: "flex", flexDirection: "column", gap: 13 }}>
            {[0, 1, 2].map((item) => <div key={item} style={{ height: 72, display: "flex", alignItems: "center", padding: 14, gap: 8, borderRadius: 10, border: "1px solid rgba(255,255,255,.38)", background: "#101f2a" }}><span style={{ width: 10, height: 10, borderRadius: 99, background: item === 2 ? "#ff816d" : "#bfff5b", display: "flex" }} /><span style={{ width: 75, height: 5, borderRadius: 99, background: "#657b89", display: "flex" }} /></div>)}
          </div>
          <span style={{ position: "absolute", bottom: 24, left: 38, color: "#e6fbff", fontWeight: 800, fontSize: 14, letterSpacing: 1, display: "flex" }}>COOLING PANIC 72%</span>
        </div>
      </div>
    ),
    size,
  );
}
