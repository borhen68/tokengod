import { Droplets, Flame } from "lucide-react";
import type { CSSProperties } from "react";

import { formatMoney, pressureLabel } from "@/lib/format";

export function FloodTank({
  spend,
  level = 76,
}: {
  spend: number;
  level?: number;
}) {
  const safeLevel = Math.min(92, Math.max(spend > 0 ? 10 : 4, level));

  return (
    <aside
      className="token-reactor"
      aria-label={`${formatMoney(spend)} in AI spend; ${pressureLabel(safeLevel)} at ${safeLevel}% waterline`}
    >
      <div className="reactor-heading">
        <div>
          <span><Flame size={14} /> HIGHEST 90-DAY AI SPEND</span>
          <strong>{formatMoney(spend, true)}</strong>
        </div>
      </div>
      <div
        className="reactor-tank"
        style={{ "--reactor-level": `${safeLevel}%` } as CSSProperties}
        aria-hidden="true"
      >
        <div className="reactor-water" />
      </div>
      <div className="reactor-level">
        <span><Droplets size={14} /> RELATIVE WATERLINE</span>
        <strong>{safeLevel}%</strong>
      </div>
      <p>AI spend raises the waterline across the current leaderboard.</p>
    </aside>
  );
}
