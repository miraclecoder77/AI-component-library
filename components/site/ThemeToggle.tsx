"use client";

import { useSyncExternalStore } from "react";
import styles from "./ThemeToggle.module.css";

type Theme = "light" | "dark" | "system";

/**
 * Runs before first paint to apply the stored theme.
 *
 * Inlined in the document head. Without it the page renders in the system
 * theme and then corrects itself once React hydrates, which is visible as a
 * flash -- and is worse on a dark-first design, where the flash is white.
 */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
    }
  } catch (e) {}
})();
`;

const ORDER: Theme[] = ["system", "light", "dark"];
const CHANGE_EVENT = "themechange";

/**
 * The document element is the source of truth for the current theme -- the
 * inline script above has already written it before React runs. Subscribing
 * to it rather than keeping a second copy in state means there is no window
 * where the two disagree, and no effect that corrects one from the other.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];

    if (next === "system") {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem("theme");
    } else {
      document.documentElement.dataset.theme = next;
      localStorage.setItem("theme", next);
    }

    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={cycle}
      aria-label={`Theme: ${theme}. Change theme.`}
    >
      <span aria-hidden="true">{ICONS[theme]}</span>
      <span className={styles.text}>{theme}</span>
    </button>
  );
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function getSnapshot(): Theme {
  const applied = document.documentElement.dataset.theme;
  return applied === "light" || applied === "dark" ? applied : "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

const ICONS: Record<Theme, string> = {
  system: "◐",
  light: "○",
  dark: "●",
};
