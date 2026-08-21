"use client";

import { useState } from "react";
import { ErrorState } from "@/components/ai/ErrorState";
import { StepTimeline } from "@/components/ai/StepTimeline";
import { StreamStats } from "@/components/ai/StreamStats";
import { StreamingText } from "@/components/ai/StreamingText";
import { ToolCallCard } from "@/components/ai/ToolCallCard";
import { Button } from "@/components/ui/Button";
import { useStreamController } from "@/hooks/useStreamController";
import styles from "./MultiStepAgentDemo.module.css";

const QUESTIONS = [
  "Why does perceived speed depend on time to first token?",
  "How should an interface handle a rate limit?",
  "What makes streaming text hard for screen readers?",
];

/**
 * A bounded agent with its work exposed.
 *
 * Every stage the agent passes through is rendered: the plan before it
 * starts, each step as it advances, the tool call with its arguments, and
 * finally the answer. Nothing here is faster than a spinner would be -- it is
 * only legible, which is the entire difference.
 */
export function MultiStepAgentDemo() {
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const stream = useStreamController("/api/agent");

  function run(text: string) {
    if (stream.isActive) return;
    setQuestion(text);
    void stream.start({ messages: [{ role: "user", content: text }] });
  }

  const started = stream.status !== "idle";

  return (
    <div className={styles.demo}>
      <div className={styles.picker}>
        <span className={styles.label}>Ask</span>
        <div className={styles.questions}>
          {QUESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={styles.question}
              data-selected={item === question || undefined}
              onClick={() => run(item)}
              disabled={stream.isActive}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.controls}>
        {stream.isActive ? (
          <Button variant="outline" onClick={stream.stop}>
            Stop
          </Button>
        ) : (
          <Button onClick={() => run(question)}>
            {started ? "Run again" : "Run"}
          </Button>
        )}
      </div>

      {started && (
        <div className={styles.output}>
          <StepTimeline steps={stream.steps} />

          {stream.tools.length > 0 && (
            <div className={styles.tools}>
              {stream.tools.map((tool) => (
                <ToolCallCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}

          {stream.text && (
            <div className={styles.answer}>
              <span className={styles.label}>Answer</span>
              <StreamingText text={stream.text} isStreaming={stream.isActive} />
            </div>
          )}
        </div>
      )}

      {stream.error && (
        <ErrorState error={stream.error} onRetry={() => run(question)} />
      )}

      <StreamStats meta={stream.meta} totalMs={stream.totalMs} />
    </div>
  );
}
