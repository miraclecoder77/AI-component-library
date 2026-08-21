"use client";

import { useSentenceAnnouncer } from "@/hooks/useSentenceAnnouncer";
import { useSmoothStream } from "@/hooks/useSmoothStream";
import styles from "./StreamingText.module.css";

export interface StreamingTextProps {
  text: string;
  /** True while the stream is still running. Drives the cursor and pacing. */
  isStreaming: boolean;
  /** Disables smoothing. Used for text that is already complete. */
  instant?: boolean;
  className?: string;
}

/**
 * Renders streamed text.
 *
 * Two things happen here that are easy to skip and hard to add later:
 *
 * 1. The text is paced by `useSmoothStream` rather than painted on arrival,
 *    so uneven network chunks read as steady typing.
 * 2. The visible copy is `aria-hidden`, and a separate polite live region
 *    announces completed sentences. Announcing the visible text directly
 *    would flood a screen reader with fragments.
 */
export function StreamingText({
  text,
  isStreaming,
  instant = false,
  className,
}: StreamingTextProps) {
  const smoothed = useSmoothStream(text, isStreaming);
  const visible = instant ? text : smoothed;
  const announcement = useSentenceAnnouncer(text, isStreaming);

  // The cursor belongs at the tail only while output is still arriving --
  // or while smoothing is still catching up after the stream closed.
  const showCursor = isStreaming || visible.length < text.length;

  return (
    <>
      <div
        className={[styles.text, className].filter(Boolean).join(" ")}
        aria-hidden="true"
      >
        {renderParagraphs(visible, showCursor)}
      </div>

      <div className="srOnly" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </>
  );
}

/**
 * Blank lines become paragraph breaks.
 *
 * The cursor is rendered inside the final paragraph rather than after the
 * block. Placed outside, it drops onto its own line whenever the model emits
 * a trailing newline mid-stream, which makes the caret visibly jump around.
 */
function renderParagraphs(text: string, showCursor: boolean) {
  const paragraphs = text.split(/\n{2,}/);
  const lastIndex = paragraphs.length - 1;

  return paragraphs.map((paragraph, index) => (
    <p key={index} className={styles.paragraph}>
      {paragraph}
      {showCursor && index === lastIndex && <span className={styles.cursor} />}
    </p>
  ));
}
