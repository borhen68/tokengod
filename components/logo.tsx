import { Crown, Waves } from "lucide-react";
import Link from "next/link";

import styles from "./logo.module.css";

export function Logo() {
  return (
    <Link className={styles.brand} href="/" aria-label="TokenGod home">
      <span className={styles.mark} aria-hidden="true">
        <Crown className={styles.crown} size={16} strokeWidth={2.8} />
        <Waves className={styles.waves} size={23} strokeWidth={2.7} />
      </span>
      <span className={styles.word}>Token<span>God</span></span>
    </Link>
  );
}
