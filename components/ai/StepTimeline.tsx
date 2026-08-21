"use client";

import type { StepState } from "@/hooks/useStreamController";
import styles from "./StepTimeline.module.css";

export interface StepTimelineProps {
  steps: StepState[];
}

/**
 * The agent's plan, and where it has got to.
 *
 * The whole plan is rendered as soon as it is known -- including steps that
 * have not started. That is the point: a spinner communicates "something is
 * happening" and nothing else, while four visible steps with one active
 * communicates how much is left. An unbounded wait becomes a bounded one
 * without the operation getting any faster.
 *
 * The list is a polite live region so screen reader users get the same
 * progress information, announced per transition rather than per token.
 */
export function StepTimeline({ steps }: StepTimelineProps) {
  if (steps.length === 0) return null;

  const done = steps.filter((step) => step.status === "done").length;

  return (
    <section className={styles.wrapper} aria-label="Agent progress">
      <div className={styles.head}>
        <span className={styles.heading}>Plan</span>
        <span className={styles.count}>
          {done} of {steps.length}
        </span>
      </div>

      <ol className={styles.list} aria-live="polite">
        {steps.map((step) => (
          <li key={step.id} className={styles.step} data-status={step.status}>
            <span className={styles.marker} aria-hidden="true">
              <span className={styles.dot} />
            </span>

            <span className={styles.label}>{step.label}</span>

            <span className="srOnly">{statusLabel(step.status)}</span>

            {step.status === "active" && (
              <span className={styles.working} aria-hidden="true">
                working
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function statusLabel(status: StepState["status"]): string {
  switch (status) {
    case "pending":
      return "not started";
    case "active":
      return "in progress";
    case "done":
      return "complete";
    case "error":
      return "failed";
  }
}
