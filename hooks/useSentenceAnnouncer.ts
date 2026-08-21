"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Turns a streaming string into screen-reader-appropriate announcements.
 *
 * Putting `aria-live="polite"` on streaming text is the obvious move and it
 * produces unusable output: every token mutates the region, and the screen
 * reader either interrupts itself continuously or reads a stream of
 * fragments. Neither conveys the answer.
 *
 * What works is announcing completed sentences. The visual stream stays
 * `aria-hidden`, and this returns only the text that has reached a sentence
 * boundary, so assistive technology receives coherent units at a human pace.
 * On completion any trailing fragment is released, so nothing is lost.
 */
export function useSentenceAnnouncer(text: string, isActive: boolean): string {
  const [announced, setAnnounced] = useState("");
  const lastBoundary = useRef(0);

  useEffect(() => {
    // A new run resets the cursor.
    if (text.length < lastBoundary.current) {
      lastBoundary.current = 0;
      setAnnounced("");
      return;
    }

    if (isActive) {
      const boundary = lastSentenceEnd(text);
      if (boundary > lastBoundary.current) {
        const chunk = text.slice(lastBoundary.current, boundary).trim();
        lastBoundary.current = boundary;
        if (chunk) setAnnounced(chunk);
      }
      return;
    }

    // Stream finished: release whatever came after the last full sentence.
    const tail = text.slice(lastBoundary.current).trim();
    lastBoundary.current = text.length;
    if (tail) setAnnounced(tail);
  }, [text, isActive]);

  return announced;
}

/**
 * Index just past the last sentence terminator.
 *
 * Requires whitespace or end-of-string after the punctuation so that decimals
 * and abbreviations do not read as sentence ends mid-stream.
 */
function lastSentenceEnd(text: string): number {
  let index = -1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char !== "." && char !== "!" && char !== "?" && char !== "\n") continue;

    const next = text[i + 1];
    if (next === undefined || /\s/.test(next)) index = i + 1;
  }
  return index === -1 ? 0 : index;
}
