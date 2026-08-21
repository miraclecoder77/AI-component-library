"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./Composer.module.css";

export interface ComposerHandle {
  focus(): void;
}

export interface ComposerProps {
  value: string;
  onChange(value: string): void;
  onSubmit(): void;
  onStop(): void;
  isActive: boolean;
  placeholder?: string;
  label?: string;
  ref?: React.Ref<ComposerHandle>;
}

/**
 * The input.
 *
 * Details that matter more than they look like they should:
 *
 * - Enter submits, Shift+Enter inserts a newline. The reverse is technically
 *   defensible but violates what every chat interface has trained people to
 *   expect.
 * - The textarea autosizes, so long input is visible rather than scrolling
 *   inside three fixed lines.
 * - The submit button becomes the stop button while streaming, in place. It
 *   is the same intent -- control over the response -- and keeping it in one
 *   position means no layout shift and no hunting for the control.
 * - The textarea stays enabled during streaming so the next message can be
 *   composed while the current one arrives.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isActive,
  placeholder = "Ask something...",
  label = "Message",
  ref,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Autosize. Height is reset before measuring so the box can shrink as well
  // as grow -- without the reset, scrollHeight only ever ratchets upward.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [value]);

  const canSubmit = value.trim().length > 0 && !isActive;

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Composing with an IME: Enter is confirming a candidate, not submitting.
    if (event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (canSubmit) onSubmit();
  }

  return (
    <div className={styles.composer}>
      <label className="srOnly" htmlFor="composer-input">
        {label}
      </label>

      <textarea
        id="composer-input"
        ref={textareaRef}
        className={styles.input}
        value={value}
        rows={1}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {isActive ? (
        <Button variant="outline" onClick={onStop} className={styles.action}>
          <span className={styles.stopIcon} aria-hidden="true" />
          Stop
        </Button>
      ) : (
        <Button onClick={onSubmit} disabled={!canSubmit} className={styles.action}>
          Send
        </Button>
      )}
    </div>
  );
}
