"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { StreamError } from "@/hooks/useStreamController";
import styles from "./ErrorState.module.css";

export interface ErrorStateProps {
  error: StreamError;
  onRetry?: () => void;
  /** Rendered under the message. Used to suggest a different input. */
  children?: React.ReactNode;
}

/**
 * Failure, rendered as something the user can act on.
 *
 * The three failures that actually happen in AI products each want a
 * different response, and collapsing them into one generic message throws
 * that away:
 *
 *   rate_limit  a countdown, then retry -- the same input will work shortly
 *   timeout     retry now, since it is usually transient
 *   empty       rephrase, because retrying identical input reproduces it
 *   aborted     nothing; the user chose this
 *
 * The block is `role="alert"` so it is announced immediately, unlike the
 * polite region used for streaming text.
 */
export function ErrorState({ error, onRetry, children }: ErrorStateProps) {
  const countdown = useCountdown(error.retryAfterS);
  const waiting = countdown > 0;

  return (
    <div className={styles.block} role="alert" data-code={error.code}>
      <div className={styles.header}>
        <span className={styles.icon} aria-hidden="true" />
        <span className={styles.title}>{titleFor(error)}</span>
      </div>

      <p className={styles.message}>{error.message}</p>

      {children}

      {error.retryable && onRetry && (
        <div className={styles.actions}>
          <Button size="sm" variant="outline" onClick={onRetry} disabled={waiting}>
            {waiting ? `Retry in ${countdown}s` : "Try again"}
          </Button>
          {error.code === "rate_limit" && (
            <span className={styles.hint}>
              Free-tier limits are shared across everyone using this site.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function titleFor(error: StreamError): string {
  switch (error.code) {
    case "rate_limit":
      return "Rate limited";
    case "timeout":
      return "Timed out";
    case "empty":
      return "Empty response";
    case "aborted":
      return "Stopped";
    default:
      return "Something went wrong";
  }
}

/** Ticks a retry-after value down to zero. */
function useCountdown(seconds: number | undefined): number {
  const target = seconds ?? 0;
  const [remaining, setRemaining] = useState(target);
  const [previousTarget, setPreviousTarget] = useState(target);

  // Restart when a new retry-after arrives. Adjusting state during render is
  // React's documented answer to "reset state when a prop changes" -- an
  // effect would render the stale count once before correcting it, which on
  // a countdown is a visible flicker.
  if (target !== previousTarget) {
    setPreviousTarget(target);
    setRemaining(target);
  }

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return remaining;
}
