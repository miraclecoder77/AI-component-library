"use client";

import { ttftGrade } from "@/lib/ai/types";
import type { StreamMeta } from "@/hooks/useStreamController";
import styles from "./StreamStats.module.css";

export interface StreamStatsProps {
  meta: StreamMeta | null;
  totalMs: number | null;
}

/**
 * The machine-readable strip: model, time to first token, total duration, and
 * whether this response came from the live API or a recording.
 *
 * TTFT gets its own colour grade because it is the number that actually
 * predicts whether an interface feels fast. Total duration is reported too,
 * but deliberately without a grade -- treating it as the headline metric is
 * the mistake this whole project argues against.
 */
export function StreamStats({ meta, totalMs }: StreamStatsProps) {
  if (!meta) return null;

  const grade = ttftGrade(meta.ttftMs);

  return (
    <div className={styles.strip}>
      <span className={styles.model} title="Model">
        {meta.model}
      </span>

      <span className={styles.metric}>
        <abbr className={styles.label} title="Time to first token">
          TTFT
        </abbr>
        <span className={styles.value} data-grade={grade}>
          {meta.ttftMs}ms
        </span>
      </span>

      {totalMs !== null && (
        <span className={styles.metric}>
          <span className={styles.label}>total</span>
          <span className={styles.value}>{formatDuration(totalMs)}</span>
        </span>
      )}

      {meta.mode === "recorded" && <ModeBadge />}
    </div>
  );
}

/**
 * Says plainly that this is a replay.
 *
 * Gemini's free tier allows roughly ten requests a minute, so exhaustion is
 * routine rather than exceptional. Hiding the fallback would make the site
 * look more capable than it is; showing it demonstrates that the degradation
 * path was designed rather than discovered.
 */
export function ModeBadge() {
  return (
    <span className={styles.recorded}>
      <span className={styles.dot} aria-hidden="true" />
      recorded response
      <span className="srOnly">
        {" "}
        — the live API quota was reached, so a previously captured response is
        being replayed
      </span>
    </span>
  );
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
