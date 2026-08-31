"use client";

import { Moon, Sun } from "lucide-react";

import styles from "./theme-toggle.module.css";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    localStorage.setItem("tokengod-theme", next);
  }

  return (
    <button className={styles.toggle} type="button" onClick={toggleTheme} aria-label="Toggle color theme" title="Toggle color theme">
      <Moon className={styles.moon} size={15} aria-hidden="true" />
      <Sun className={styles.sun} size={15} aria-hidden="true" />
    </button>
  );
}
