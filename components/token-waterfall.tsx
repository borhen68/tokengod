import { Cpu, Droplets, Flame } from "lucide-react";

import { formatMoney } from "@/lib/format";

export function TokenWaterfall({ spend }: { spend: number }) {
  return (
    <aside
      className="token-waterfall"
      aria-label={`${formatMoney(spend)} is the highest listed AI spend on the leaderboard`}
    >
      <header className="token-waterfall-head">
        <span><Flame size={13} /> LIVE AI BURN</span>
        <strong>{spend > 0 ? formatMoney(spend, true) : "$0"}</strong>
        <small>highest listed spend</small>
      </header>

      <div className="token-waterfall-visual" aria-hidden="true">
        <span className="flow-label token-label">TOKENS IN</span>
        <div className="token-rain">
          <i>01</i>
          <i>AI</i>
          <i>10</i>
        </div>

        <div className="cooling-orbit"><i /><i /><i /></div>
        <div className="compute-core">
          <Cpu size={23} />
          <b>MODEL</b>
          <small>COMPUTE</small>
        </div>

        <div className="cooling-water">
          <i /><i />
          <span>COOLING WATER</span>
        </div>
      </div>

      <footer><Droplets size={13} /> More tokens create more cooling pressure.</footer>
    </aside>
  );
}
