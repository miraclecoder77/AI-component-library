/**
 * The wire protocol.
 *
 * Every route handler in this project emits this event union, and every demo
 * consumes it through the same parser and the same state machine. Chat,
 * structured output, and the multi-step agent differ only in which event
 * types they care about -- not in how they connect, buffer, abort, or
 * report latency.
 *
 * That uniformity is the point. It is what lets `useStreamController` be
 * written once, and what makes TTFT instrumentation free for every pattern.
 */

/** Models this project uses. Verified against Google's model list. */
export const MODELS = {
  /** Default. Latest stable Flash. */
  flash: "gemini-3.7-flash",
  /** Previous generation -- the baseline in speed/quality comparisons. */
  flashPrev: "gemini-2.5-flash",
  /** Slower, stronger. Used sparingly: much tighter free-tier quota. */
  pro: "gemini-3.1-pro-preview",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/** Whether a response came from the live API or a recorded fixture. */
export type SourceMode = "live" | "recorded";

export type ErrorCode =
  | "rate_limit"
  | "timeout"
  | "empty"
  | "aborted"
  | "unknown";

/** A single node in the multi-step agent timeline. */
export type StepStatus = "pending" | "active" | "done" | "error";

/**
 * Events a provider produces. Deliberately excludes `meta`, `done`, and
 * `error` -- those are added by the instrumentation wrapper so that latency
 * measurement and failure classification live in exactly one place.
 */
export type ProviderEvent =
  /** A chunk of user-visible text. */
  | { type: "delta"; text: string }
  /** Model reasoning summary. Rendered on the "thinking" surface, not inline. */
  | { type: "thinking"; text: string }
  /** Agent step transition. */
  | { type: "step"; id: string; label: string; status: StepStatus }
  /** Tool invocation and (later) its result, correlated by id. */
  | {
      type: "tool";
      id: string;
      name: string;
      args?: unknown;
      result?: unknown;
    }
  /** Progressively parsed structured output. Always a whole, valid value. */
  | { type: "partial"; json: unknown };

/** The full union that crosses the network. */
export type StreamEvent =
  | ProviderEvent
  /** Always first. Carries the measured time to first token. */
  | {
      type: "meta";
      model: ModelId | string;
      mode: SourceMode;
      ttftMs: number;
    }
  | {
      type: "error";
      code: ErrorCode;
      message: string;
      retryable: boolean;
      /** Seconds to wait before retrying, when the server tells us. */
      retryAfterS?: number;
    }
  /** Always last on a successful stream. */
  | { type: "done"; totalMs: number; tokens?: number };

/** Chat turn. */
export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

/** The demos, by id. Doubles as the fixture namespace and the route slug. */
export type PatternId =
  | "streaming-chat"
  | "structured-output"
  | "multi-step-agent";

export interface StreamRequest {
  pattern: PatternId;
  model: ModelId;
  messages: ChatMessage[];
  /**
   * JSON schema for structured output. Present only for the structured
   * pattern; providers ignore it otherwise.
   */
  schema?: Record<string, unknown>;
  /**
   * Selects which recorded fixture to replay when running in `recorded`
   * mode. Ignored by the live provider.
   */
  variant?: string;
}

/**
 * The provider contract.
 *
 * With a single vendor this abstraction would normally be decorative. It
 * earns its place because the recorded-fixture player implements the same
 * interface -- so the seam is exercised on every quota-exhausted request
 * rather than sitting unused against a hypothetical second vendor.
 */
export interface AIProvider {
  readonly mode: SourceMode;
  stream(req: StreamRequest, signal: AbortSignal): AsyncIterable<ProviderEvent>;
}

/** Thrown by providers so `instrument` can classify failures uniformly. */
export class ProviderError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly retryAfterS?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * A recorded response.
 *
 * `frames` keep the original arrival times so replay reproduces real pacing,
 * bursts and stalls included, rather than a uniform drip.
 */
export interface Fixture {
  pattern: string;
  variant: string;
  model: string;
  /** True while the fixture is a hand-authored placeholder, not a capture. */
  synthetic?: boolean;
  recordedAt: string | null;
  frames: { atMs: number; event: ProviderEvent }[];
}

/** TTFT thresholds, shared by the meter component and the docs page. */
export const TTFT_THRESHOLDS = { good: 300, warn: 800 } as const;

export function ttftGrade(ms: number): "good" | "warn" | "bad" {
  if (ms <= TTFT_THRESHOLDS.good) return "good";
  if (ms <= TTFT_THRESHOLDS.warn) return "warn";
  return "bad";
}
