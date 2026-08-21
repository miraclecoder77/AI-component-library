"use client";

import type { ToolState } from "@/hooks/useStreamController";
import styles from "./ToolCallCard.module.css";

export interface ToolCallCardProps {
  tool: ToolState;
}

/**
 * One tool invocation, with its arguments and result.
 *
 * Collapsed by default -- the arguments matter when something goes wrong and
 * are noise when it does not. Rendered as a native `<details>` so keyboard
 * and screen reader behaviour is correct without any JavaScript.
 *
 * The card appears as soon as the call is issued, before the result exists.
 * Waiting for completion would hide the slowest part of the run, which is
 * exactly the part the user is waiting through.
 */
export function ToolCallCard({ tool }: ToolCallCardProps) {
  const pending = tool.result === undefined;

  return (
    <details className={styles.card} data-pending={pending || undefined}>
      <summary className={styles.summary}>
        <span className={styles.name}>
          {tool.name}
          <span className={styles.parens}>()</span>
        </span>

        <span className={styles.status}>
          {pending ? "running" : summarise(tool.result)}
        </span>
      </summary>

      <div className={styles.body}>
        <Field label="Arguments" value={tool.args} />
        {!pending && <Field label="Result" value={tool.result} />}
      </div>
    </details>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      <pre className={styles.code}>
        <code>{JSON.stringify(value, null, 2)}</code>
      </pre>
    </div>
  );
}

/** A one-glance summary so the collapsed card still says something useful. */
function summarise(result: unknown): string {
  if (Array.isArray(result)) {
    return `${result.length} ${result.length === 1 ? "result" : "results"}`;
  }
  if (result === null) return "null";
  if (typeof result === "object") return "object";
  return String(result);
}
