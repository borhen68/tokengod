import styles from "./token-waterfall.module.css";

export function TokenWaterfall() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.atmosphere} aria-hidden="true">
        <span className={styles.rainOne} />
        <span className={styles.rainTwo} />
        <span className={styles.rainThree} />
        <span className={styles.tokenOne}>AI</span>
        <span className={styles.tokenTwo}>01</span>
        <span className={styles.tokenThree}>10</span>
        <div className={styles.halo} />
      </div>
    </div>
  );
}
