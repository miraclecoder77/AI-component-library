"use client";

import { useState } from "react";
import { ErrorState } from "@/components/ai/ErrorState";
import { StreamStats } from "@/components/ai/StreamStats";
import { Button } from "@/components/ui/Button";
import { useStreamController } from "@/hooks/useStreamController";
import {
  JOB_POSTING_FIELDS,
  SAMPLE_JOB_POSTING,
  type JobPosting,
} from "@/lib/schemas";
import styles from "./StructuredOutputDemo.module.css";

/**
 * Structured extraction, rendered as it arrives.
 *
 * The demo is arranged so the interesting behaviour is unmissable: the empty
 * form is visible before extraction starts, so fields can be watched settling
 * one at a time rather than appearing all at once at the end.
 */
export function StructuredOutputDemo() {
  const [input, setInput] = useState(SAMPLE_JOB_POSTING);
  const stream = useStreamController("/api/structured");

  const partial = (stream.partial ?? {}) as Partial<JobPosting>;
  const started = stream.status !== "idle";

  function extract() {
    if (stream.isActive) return;
    void stream.start({
      messages: [
        {
          role: "user",
          content: `Extract the job posting details from the text below.\n\n${input}`,
        },
      ],
    });
  }

  const filled = JOB_POSTING_FIELDS.filter(
    (field) => partial[field.key] !== undefined && partial[field.key] !== null,
  ).length;

  return (
    <div className={styles.demo}>
      <div className={styles.grid}>
        <div className={styles.inputSide}>
          <label className={styles.label} htmlFor="posting">
            Unstructured input
          </label>
          <textarea
            id="posting"
            className={styles.textarea}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={12}
            spellCheck={false}
          />

          <div className={styles.controls}>
            {stream.isActive ? (
              <Button variant="outline" onClick={stream.stop}>
                Stop
              </Button>
            ) : (
              <Button onClick={extract} disabled={input.trim().length === 0}>
                {started ? "Extract again" : "Extract"}
              </Button>
            )}
            <span className={styles.progress}>
              {started ? `${filled} of ${JOB_POSTING_FIELDS.length} fields` : null}
            </span>
          </div>
        </div>

        <div className={styles.outputSide}>
          <span className={styles.label} id="extracted-label">
            Extracted
          </span>

          <dl
            className={styles.fields}
            aria-labelledby="extracted-label"
            aria-busy={stream.isActive}
          >
            {JOB_POSTING_FIELDS.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                value={partial[field.key]}
                streaming={stream.isActive}
              />
            ))}
          </dl>
        </div>
      </div>

      {stream.error && <ErrorState error={stream.error} onRetry={extract} />}

      <StreamStats meta={stream.meta} totalMs={stream.totalMs} />
    </div>
  );
}

/**
 * A single extracted field.
 *
 * An empty field during streaming is "waiting", not "absent" -- and once the
 * stream finishes, an absent field means the model genuinely found nothing.
 * Rendering both as a blank box would conflate them.
 */
function Field({
  label,
  value,
  streaming,
}: {
  label: string;
  value: unknown;
  streaming: boolean;
}) {
  const empty = value === undefined || value === null || value === "";

  return (
    <div className={styles.field} data-empty={empty || undefined}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue} aria-busy={empty && streaming}>
        {empty ? (
          <span className={styles.placeholder} aria-hidden="true">
            {streaming ? <span className={styles.shimmer} /> : "—"}
          </span>
        ) : (
          format(value)
        )}
        {empty && (
          <span className="srOnly">
            {streaming ? "waiting" : "not found"}
          </span>
        )}
      </dd>
    </div>
  );
}

function format(value: unknown): React.ReactNode {
  if (Array.isArray(value)) {
    return (
      <span className={styles.tags}>
        {value.map((item, index) => (
          <span key={index} className={styles.tag}>
            {String(item)}
          </span>
        ))}
      </span>
    );
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}
