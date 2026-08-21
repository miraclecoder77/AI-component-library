"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { parseStream } from "@/lib/ai/parse";
import type {
  ErrorCode,
  SourceMode,
  StepStatus,
  StreamEvent,
} from "@/lib/ai/types";

/**
 * The state machine every demo runs on.
 *
 *   idle -> connecting -> streaming -> done
 *                              |-----> stopped   (user pressed stop)
 *                              |-----> error
 *
 * Written as a reducer rather than a cluster of useState calls on purpose:
 * the illegal transitions are the interesting part. A stopped stream must
 * keep its partial text, an error arriving after content must not wipe the
 * screen, and a late event from an aborted request must be ignored entirely.
 * Those rules are enforceable in one place here and invisible if the state is
 * scattered.
 */

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "done"
  | "stopped"
  | "error";

export interface StepState {
  id: string;
  label: string;
  status: StepStatus;
}

export interface ToolState {
  id: string;
  name: string;
  args?: unknown;
  result?: unknown;
}

export interface StreamMeta {
  model: string;
  mode: SourceMode;
  ttftMs: number;
}

export interface StreamError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  retryAfterS?: number;
}

export interface StreamState {
  status: StreamStatus;
  /** Accumulated user-visible text. */
  text: string;
  /** Accumulated reasoning summary, rendered separately from `text`. */
  thinking: string;
  steps: StepState[];
  tools: ToolState[];
  /** Latest tolerantly-parsed structured value. */
  partial: unknown;
  meta: StreamMeta | null;
  error: StreamError | null;
  totalMs: number | null;
}

const INITIAL: StreamState = {
  status: "idle",
  text: "",
  thinking: "",
  steps: [],
  tools: [],
  partial: undefined,
  meta: null,
  error: null,
  totalMs: null,
};

type Action =
  | { kind: "start" }
  | { kind: "event"; event: StreamEvent }
  | { kind: "stop" }
  | { kind: "fail"; error: StreamError }
  | { kind: "reset" };

function reducer(state: StreamState, action: Action): StreamState {
  switch (action.kind) {
    case "start":
      // A fresh run clears everything except nothing -- previous output is
      // the caller's to keep if it wants it (chat appends to a message list).
      return { ...INITIAL, status: "connecting" };

    case "stop":
      // Terminal states stay put: a `stop` racing a `done` must not undo it.
      if (state.status !== "connecting" && state.status !== "streaming") {
        return state;
      }
      return { ...state, status: "stopped" };

    case "fail":
      if (state.status === "stopped") return state;
      return { ...state, status: "error", error: action.error };

    case "reset":
      return INITIAL;

    case "event":
      return applyEvent(state, action.event);
  }
}

function applyEvent(state: StreamState, event: StreamEvent): StreamState {
  // Events that arrive after the user stopped are dropped. The request is
  // aborted, but a chunk already in flight can still land.
  if (state.status === "stopped") return state;

  switch (event.type) {
    case "meta":
      return {
        ...state,
        status: "streaming",
        meta: {
          model: event.model,
          mode: event.mode,
          ttftMs: event.ttftMs,
        },
      };

    case "delta":
      return {
        ...state,
        status: "streaming",
        text: state.text + event.text,
      };

    case "thinking":
      return {
        ...state,
        status: "streaming",
        thinking: state.thinking + event.text,
      };

    case "step":
      return { ...state, status: "streaming", steps: upsertStep(state.steps, event) };

    case "tool":
      return { ...state, status: "streaming", tools: upsertTool(state.tools, event) };

    case "partial":
      return { ...state, status: "streaming", partial: event.json };

    case "error":
      return {
        ...state,
        status: "error",
        error: {
          code: event.code,
          message: event.message,
          retryable: event.retryable,
          retryAfterS: event.retryAfterS,
        },
      };

    case "done":
      return { ...state, status: "done", totalMs: event.totalMs };
  }
}

/** Steps are addressed by id: the same step is emitted repeatedly as it advances. */
function upsertStep(
  steps: StepState[],
  event: Extract<StreamEvent, { type: "step" }>,
): StepState[] {
  const next = { id: event.id, label: event.label, status: event.status };
  const index = steps.findIndex((step) => step.id === event.id);
  if (index === -1) return [...steps, next];

  const copy = [...steps];
  copy[index] = next;
  return copy;
}

/** Tool calls arrive twice: once on invocation, once with the result. */
function upsertTool(
  tools: ToolState[],
  event: Extract<StreamEvent, { type: "tool" }>,
): ToolState[] {
  const index = tools.findIndex((tool) => tool.id === event.id);
  if (index === -1) {
    return [...tools, { id: event.id, name: event.name, args: event.args, result: event.result }];
  }

  const copy = [...tools];
  copy[index] = { ...copy[index], ...event };
  return copy;
}

export interface StreamController extends StreamState {
  /** True while a request is in flight. */
  isActive: boolean;
  start(body: unknown): Promise<void>;
  stop(): void;
  reset(): void;
}

export interface StreamOptions {
  /**
   * Called once when a run reaches a terminal state that produced output --
   * either it completed or the user stopped it. Not called on error.
   *
   * A callback rather than an effect watching `status`: the consumer wants to
   * act on the transition, and an effect would have to infer it by comparing
   * against the previous status, which misfires on any unrelated re-render.
   */
  onFinish?(result: { text: string; status: "done" | "stopped" }): void;
}

export function useStreamController(
  endpoint: string,
  options: StreamOptions = {},
): StreamController {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  // Accumulated outside the reducer so `stop` can report the partial text
  // without waiting for a re-render to observe it.
  const textRef = useRef("");
  const onFinishRef = useRef(options.onFinish);

  useEffect(() => {
    onFinishRef.current = options.onFinish;
  });

  // An in-flight request must not outlive the component.
  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    const wasActive = abortRef.current !== null;
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ kind: "stop" });

    // Partial output is kept: the user stopped because they had read enough,
    // not because they wanted it deleted.
    if (wasActive && textRef.current) {
      onFinishRef.current?.({ text: textRef.current, status: "stopped" });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ kind: "reset" });
  }, []);

  const start = useCallback(
    async (body: unknown) => {
      // Starting again while running replaces the previous run rather than
      // racing it.
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;
      textRef.current = "";
      let sawError = false;
      dispatch({ kind: "start" });

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        // Error responses carry an NDJSON error event in the body, so they go
        // through the same parser rather than a separate branch.
        if (!response.body) {
          throw new Error("The server returned no response body.");
        }

        for await (const event of parseStream(response)) {
          if (controller.signal.aborted) return;
          if (event.type === "delta") textRef.current += event.text;
          if (event.type === "error") sawError = true;
          dispatch({ kind: "event", event });
        }

        // `stop` reports its own finish, so this only runs for a stream that
        // ran to completion on its own.
        if (!controller.signal.aborted && !sawError && textRef.current) {
          onFinishRef.current?.({ text: textRef.current, status: "done" });
        }
      } catch (err) {
        // Abort is the expected outcome of pressing stop, not a failure.
        if (controller.signal.aborted) return;

        dispatch({
          kind: "fail",
          error: {
            code: "unknown",
            message:
              err instanceof Error
                ? err.message
                : "The connection failed unexpectedly.",
            retryable: true,
          },
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [endpoint],
  );

  return {
    ...state,
    isActive: state.status === "connecting" || state.status === "streaming",
    start,
    stop,
    reset,
  };
}
