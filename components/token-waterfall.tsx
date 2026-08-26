import { Droplets, Flame } from "lucide-react";

import { formatMoney } from "@/lib/format";

import styles from "./token-waterfall.module.css";

export function TokenWaterfall({ spend }: { spend: number }) {
  return (
    <aside
      className={styles.scene}
      aria-label={`${formatMoney(spend)} is the highest listed AI spend on the leaderboard`}
    >
      <div className={styles.atmosphere} aria-hidden="true">
        <span className={styles.rainOne} />
        <span className={styles.rainTwo} />
        <span className={styles.rainThree} />
        <span className={styles.tokenOne}>AI</span>
        <span className={styles.tokenTwo}>01</span>
        <span className={styles.tokenThree}>10</span>
        <div className={styles.halo} />
        <div className={styles.water}>
          <i /><i /><i />
        </div>
      </div>

      <div className={styles.burnReadout}>
        <span><Flame size={13} /> LIVE AI BURN</span>
        <strong>{spend > 0 ? formatMoney(spend, true) : "$0"}</strong>
        <small>highest listed spend</small>
      </div>
      <footer className={styles.caption}>
        <Droplets size={13} /> More tokens create more cooling pressure.
      </footer>
    </aside>
  );
}
