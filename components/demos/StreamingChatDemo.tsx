"use client";

import { useEffect, useRef, useState } from "react";
import { Composer, type ComposerHandle } from "@/components/ai/Composer";
import { ErrorState } from "@/components/ai/ErrorState";
import { StreamStats } from "@/components/ai/StreamStats";
import { StreamingText } from "@/components/ai/StreamingText";
import { useStreamController } from "@/hooks/useStreamController";
import type { ChatMessage } from "@/lib/ai/types";
import styles from "./StreamingChatDemo.module.css";

const SUGGESTIONS = [
  "Why does time to first token matter more than total latency?",
  "When is optimistic UI the wrong choice?",
  "How should a stop button behave mid-stream?",
];

/**
 * Streaming chat.
 *
 * The reference implementation for every other demo: it owns nothing to do
 * with transport, which all lives in `useStreamController`, and concerns
 * itself only with what a chat transcript needs on top of a stream -- turn
 * history, committing a finished response, and returning focus after a stop.
 */
export function StreamingChatDemo() {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const composerRef = useRef<ComposerHandle>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  /**
   * Commit a finished response into the transcript.
   *
   * A stopped stream commits too, keeping whatever text arrived. The
   * controller does not reset afterwards, so the latency strip keeps showing
   * the run that just finished -- and the live turn stops rendering anyway
   * once the stream is no longer active, so nothing appears twice.
   */
  const stream = useStreamController("/api/chat", {
    onFinish: ({ text }) => {
      if (!text.trim()) return;
      setHistory((current) => [...current, { role: "model", content: text }]);
    },
  });

  // Keep the newest content in view, but only while it is arriving.
  useEffect(() => {
    if (!stream.isActive) return;
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [stream.text, stream.isActive]);

  function send(message: string) {
    const content = message.trim();
    if (!content || stream.isActive) return;

    // The user's own turn is appended before the request is made. There is no
    // server round trip that could invalidate it, so there is nothing to roll
    // back -- the message is simply theirs.
    const next: ChatMessage[] = [...history, { role: "user", content }];
    setHistory(next);
    setInput("");
    void stream.start({ messages: next });
  }

  function handleStop() {
    stream.stop();
    // Focus would otherwise be lost with the button that just disappeared.
    composerRef.current?.focus();
  }

  function retry() {
    // History already ends with the user turn that failed, because the
    // response was never committed. Re-sending it as-is is the retry.
    if (history.length === 0) return;
    void stream.start({ messages: history });
  }

  const showTranscript = history.length > 0 || stream.isActive;

  return (
    <div className={styles.demo}>
      {showTranscript ? (
        <div className={styles.transcript} ref={transcriptRef}>
          {history.map((message, index) => (
            <Turn key={index} role={message.role}>
              {message.role === "model" ? (
                <StreamingText text={message.content} isStreaming={false} instant />
              ) : (
                <p className={styles.userText}>{message.content}</p>
              )}
            </Turn>
          ))}

          {stream.isActive && (
            <Turn role="model">
              {stream.status === "connecting" && !stream.text ? (
                <ThinkingIndicator />
              ) : (
                <StreamingText text={stream.text} isStreaming />
              )}
            </Turn>
          )}
        </div>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyText}>Try one of these:</p>
          <div className={styles.suggestions}>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className={styles.suggestion}
                onClick={() => send(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {stream.error && (
        <ErrorState error={stream.error} onRetry={retry}>
          {stream.error.code === "empty" && (
            <p className={styles.hint}>
              Rephrasing usually helps more than retrying the same wording.
            </p>
          )}
        </ErrorState>
      )}

      <div className={styles.footer}>
        <Composer
          ref={composerRef}
          value={input}
          onChange={setInput}
          onSubmit={() => send(input)}
          onStop={handleStop}
          isActive={stream.isActive}
        />
        <StreamStats meta={stream.meta} totalMs={stream.totalMs} />
      </div>
    </div>
  );
}

function Turn({
  role,
  children,
}: {
  role: ChatMessage["role"];
  children: React.ReactNode;
}) {
  return (
    <div className={styles.turn} data-role={role}>
      <span className={styles.role}>{role === "user" ? "You" : "Model"}</span>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

/**
 * Shown between the request and the first token.
 *
 * This gap is exactly what TTFT measures, and leaving it blank is what makes
 * an interface feel unresponsive even when it is not.
 */
function ThinkingIndicator() {
  return (
    <div className={styles.thinking}>
      <span className={styles.thinkingDot} />
      <span className={styles.thinkingDot} />
      <span className={styles.thinkingDot} />
      <span className="srOnly">Waiting for a response</span>
    </div>
  );
}
