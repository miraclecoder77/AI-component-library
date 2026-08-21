"use client";

import { useSyncExternalStore } from "react";

/**
 * Tracks `prefers-reduced-motion`.
 *
 * The CSS token layer already collapses every duration to 0ms for these
 * users. This hook exists for the motion CSS cannot reach -- chiefly the
 * JavaScript-driven token reveal, which has to be switched off rather than
 * merely sped up.
 *
 * `useSyncExternalStore` rather than useState plus an effect: a media query
 * is exactly the external mutable source this API exists for, and it gives a
 * defined server snapshot instead of rendering the wrong value and then
 * correcting it.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * The server cannot know the preference, so it assumes motion is allowed and
 * the first client render corrects it. Assuming the opposite would suppress
 * animation for everyone on the first frame.
 */
function getServerSnapshot(): boolean {
  return false;
}
