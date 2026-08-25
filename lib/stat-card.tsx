import { ImageResponse } from "next/og";

import { formatEfficiency, formatMoney } from "@/lib/format";
import { hasFounderReportedNumbers, listingProofLabel } from "@/lib/proof";
import type { LeaderboardListing } from "@/lib/types";

export const statCardSize = { width: 1200, height: 630 };

export function renderStatCard(
  listing: LeaderboardListing,
  options?: { download?: boolean },
) {
  const level = Math.min(
    88,
    Math.max(16, Math.round(16 + Math.log10(listing.tokensSpentUsd + 1) * 18)),
  );
  const site = new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ).hostname.replace(/^www\./, "");
  const buildLabel = listing.products.length > 1
    ? `${listing.productName.slice(0, 30)} + ${listing.products.length - 1} more`
    : listing.productName.slice(0, 42);
  const apiVerified = listing.aiSpendVerification === "api";
  const reportedNumbers = hasFounderReportedNumbers(listing);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          color: "#f5fbff",
          backgroundColor: "#06131d",
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(39,211,255,.18), transparent 35%), radial-gradient(circle at 70% 90%, rgba(192,255,91,.10), transparent 34%)",
          fontFamily: "Arial, sans-serif",
          padding: "52px 56px",
        }}
      >
        <div style={{ position: "absolute", top: -120, right: 250, width: 340, height: 340, borderRadius: 999, border: "1px solid rgba(110,222,255,.12)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -190, left: -70, width: 420, height: 420, borderRadius: 999, border: "1px solid rgba(110,222,255,.12)", display: "flex" }} />

        <div style={{ width: 790, height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12, background: "#bfff5b" }}>
                {[18, 24, 18].map((width, index) => <span key={index} style={{ width, height: 3, display: "flex", borderRadius: 99, background: "#06131d" }} />)}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", fontSize: 25, fontWeight: 800, letterSpacing: -1 }}>
                TOKEN<span style={{ color: "#66ddff" }}>GOD</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: reportedNumbers ? "#b7c2c8" : "#bfff5b", border: reportedNumbers ? "1px solid rgba(183,194,200,.3)" : "1px solid rgba(191,255,91,.32)", borderRadius: 999, padding: "8px 13px", fontSize: 13, fontWeight: 700, letterSpacing: 1.1 }}>
              {listingProofLabel(listing).toUpperCase()}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 52 }}>
            <div style={{ display: "flex", color: "#8da6b8", fontSize: 24, marginBottom: 9 }}>
              @{listing.xHandle} {apiVerified ? "burned" : "reports spending"}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ color: "#f5fbff", fontSize: 84, lineHeight: 1, fontWeight: 850, letterSpacing: -5 }}>
                {formatMoney(listing.tokensSpentUsd)}
              </span>
              <span style={{ color: "#ff8d74", fontSize: 22, fontWeight: 700 }}>in AI tokens</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 17, color: "#a9bdca", fontSize: 24 }}>
              → built&nbsp;<span style={{ color: "#f5fbff", fontWeight: 800 }}>{buildLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 9, color: "#a9bdca", fontSize: 24 }}>
              → made&nbsp;<span style={{ color: "#bfff5b", fontWeight: 800 }}>{formatMoney(listing.revenueUsd)}</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#66ddff", fontSize: 60, lineHeight: 1, fontWeight: 850, letterSpacing: -3 }}>
                {formatEfficiency(listing.efficiencyScore)}
              </span>
              <span style={{ color: "#8da6b8", fontSize: 17, marginTop: 7 }}>made per $1 spent</span>
            </div>
            <div style={{ color: "#678092", display: "flex", fontSize: 15 }}>respect it or roast it · {site}</div>
          </div>
        </div>

        <div style={{ width: 280, height: "100%", marginLeft: "auto", display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#8da6b8", fontSize: 13, letterSpacing: 1, marginBottom: 10 }}>
            <span>COOLING PANIC</span><span style={{ color: "#66ddff", fontWeight: 800 }}>{level}%</span>
          </div>
          <div style={{ height: 468, width: "100%", border: "2px solid rgba(138,203,225,.38)", borderRadius: 28, display: "flex", position: "relative", overflow: "hidden", background: "rgba(255,255,255,.035)" }}>
            <div style={{ position: "absolute", left: 45, right: 45, top: 76, display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1, 2].map((unit) => (
                <div key={unit} style={{ height: 72, padding: "15px 13px", border: "1px solid rgba(230,245,252,.32)", borderRadius: 10, background: "#101e29", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: unit === 2 ? "#ff7d68" : "#bfff5b", display: "flex" }} />
                  <span style={{ width: 76, height: 5, borderRadius: 99, background: "#516674", display: "flex" }} />
                  <span style={{ width: 23, height: 5, borderRadius: 99, background: "#293a46", display: "flex" }} />
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${level}%`, display: "flex", background: "rgba(40,195,235,.68)", borderTop: "4px solid #71e4ff" }}>
              <span style={{ position: "absolute", top: -15, left: 20, width: 70, height: 28, borderRadius: "50%", borderTop: "4px solid #71e4ff", display: "flex" }} />
              <span style={{ position: "absolute", top: -12, right: 25, width: 90, height: 25, borderRadius: "50%", borderTop: "4px solid #71e4ff", display: "flex" }} />
              <span style={{ position: "absolute", top: 48, right: 56, width: 18, height: 18, borderRadius: 99, border: "3px solid rgba(227,249,255,.75)", display: "flex" }} />
              <span style={{ position: "absolute", top: 118, left: 46, width: 11, height: 11, borderRadius: 99, border: "2px solid rgba(227,249,255,.7)", display: "flex" }} />
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, display: "flex", justifyContent: "center", color: "#e6fbff", fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
              THE TANK IS A METAPHOR
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...statCardSize,
      emoji: "twemoji",
      headers: {
        "Cache-Control": "no-store",
        ...(options?.download
          ? { "Content-Disposition": `attachment; filename="tokengod-${listing.id}.png"` }
          : {}),
      },
    },
  );
}
