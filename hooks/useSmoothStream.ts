"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Paces streamed text so it reads as typing rather than stuttering.
 *
 * The problem: network chunks do not arrive evenly. Several tokens land in
 * the same millisecond, then nothing for 300ms. Rendering each chunk on
 * arrival faithfully reproduces that jitter, and it reads as jank even when
 * the stream is objectively fast.
 *
 * The fix: keep the arrived text in a buffer and release characters on
 * animation frames, adjusting the rate to how far behind we are. When the
 * buffer grows, playback speeds up; when it drains, playback slows. The
 * output stays slightly behind the true stream position -- that delay is the
 * price of the smoothing, and it is capped so the lag never becomes visible.
 *
 * Under `prefers-reduced-motion` this is bypassed entirely: text appears the
 * instant it arrives. The information is identical; only the pacing is lost.
 */

interface Options {
  /**
   * Target time to drain the buffer, in ms. Lower feels more responsive and
   * less smooth; higher feels calmer and lags further behind.
   */
  catchUpMs?: number;
  /** Floor on speed so a nearly-drained buffer still advances. */
  minCharsPerSecond?: number;
  /**
   * Once the stream ends, drain this much faster. Without it the tail of a
   * long response crawls after the data has all arrived.
   */
  flushMultiplier?: number;
}

export function useSmoothStream(
  target: string,
  isActive: boolean,
  options: Options = {},
): string {
  const {
    catchUpMs = 320,
    minCharsPerSecond = 30,
    flushMultiplier = 4,
  } = options;

  const reducedMotion = usePrefersReducedMotion();
  const [revealed, setRevealed] = useState(0);

  // The animation loop needs the latest values without being torn down and
  // restarted on every chunk, so they are mirrored into refs. Written in an
  // effect rather than during render: a render can be discarded, and a ref
  // written during one would keep a value that was never committed.
  const targetRef = useRef(target);
  const activeRef = useRef(isActive);

  useEffect(() => {
    targetRef.current = target;
    activeRef.current = isActive;
  });

  useEffect(() => {
    if (reducedMotion) return;

    let frame = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      const elapsed = Math.min(now - previous, 100); // ignore tab-away gaps
      previous = now;

      setRevealed((current) => {
        const length = targetRef.current.length;

        // The target got shorter, so a new run replaced the old text. Reset
        // here rather than in an effect: this is the only place that owns
        // the reveal position, and doing it anywhere else races the loop.
        if (current > length) return 0;

        const behind = length - current;
        if (behind <= 0) return current;

        const multiplier = activeRef.current ? 1 : flushMultiplier;
        const perMs = Math.max(
          minCharsPerSecond / 1000,
          (behind / catchUpMs) * multiplier,
        );

        return Math.min(length, current + Math.max(1, Math.round(perMs * elapsed)));
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, catchUpMs, minCharsPerSecond, flushMultiplier]);

  if (reducedMotion) return target;

  return target.slice(0, revealed);
}
