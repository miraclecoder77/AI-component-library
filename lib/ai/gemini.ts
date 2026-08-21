import { GoogleGenAI } from "@google/genai";
import { runAgent } from "./agent";
import { parsePartialJson } from "./partial-json";
import type {
  AIProvider,
  ChatMessage,
  ProviderEvent,
  StreamRequest,
} from "./types";
import { ProviderError } from "./types";

/**
 * The live provider.
 *
 * Translates Gemini's Interactions API into this project's event union. All
 * three patterns go through `stream()`, which is what lets the recorded
 * provider stand in for any of them without the routes knowing.
 */
export class GeminiProvider implements AIProvider {
  readonly mode = "live" as const;
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async *stream(
    req: StreamRequest,
    signal: AbortSignal,
  ): AsyncGenerator<ProviderEvent> {
    try {
      switch (req.pattern) {
        case "streaming-chat":
          yield* this.streamChat(req, signal);
          return;
        case "structured-output":
          yield* this.streamStructured(req, signal);
          return;
        case "multi-step-agent":
          yield* runAgent(this, req, signal);
          return;
      }
    } catch (err) {
      throw classify(err);
    }
  }

  /** Plain text streaming. The reference path. */
  private async *streamChat(
    req: StreamRequest,
    signal: AbortSignal,
  ): AsyncGenerator<ProviderEvent> {
    const stream = await this.client.interactions.create({
      model: req.model,
      input: toSteps(req.messages),
      stream: true,
    });

    for await (const event of stream) {
      if (signal.aborted) return;
      if (event.event_type !== "step.delta") continue;

      const delta = event.delta;
      if (delta.type === "text" && delta.text) {
        yield { type: "delta", text: delta.text };
      } else if (delta.type === "thought_summary") {
        const text = thoughtText(delta);
        if (text) yield { type: "thinking", text };
      }
    }
  }

  /**
   * Schema-constrained streaming.
   *
   * Gemini guarantees the *final* payload matches the schema, but the
   * intermediate chunks are just fragments of that JSON. We re-parse the
   * accumulated buffer on every chunk so the form can fill in progressively,
   * and only emit when the parsed shape actually changed -- otherwise React
   * re-renders on every token for no visible benefit.
   */
  private async *streamStructured(
    req: StreamRequest,
    signal: AbortSignal,
  ): AsyncGenerator<ProviderEvent> {
    if (!req.schema) {
      throw new ProviderError(
        "unknown",
        "Structured output requires a schema.",
        false,
      );
    }

    const stream = await this.client.interactions.create({
      model: req.model,
      input: toSteps(req.messages),
      stream: true,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: req.schema,
      },
    });

    let buffer = "";
    let lastEmitted = "";

    for await (const event of stream) {
      if (signal.aborted) return;
      if (event.event_type !== "step.delta") continue;
      if (event.delta.type !== "text" || !event.delta.text) continue;

      buffer += event.delta.text;

      const parsed = parsePartialJson(buffer);
      if (parsed === undefined) continue;

      const serialised = JSON.stringify(parsed);
      if (serialised === lastEmitted) continue;
      lastEmitted = serialised;

      yield { type: "partial", json: parsed };
    }
  }

  /** Single-shot text generation. Used by the agent for each of its steps. */
  async complete(
    model: string,
    prompt: string,
    signal: AbortSignal,
  ): Promise<string> {
    try {
      const stream = await this.client.interactions.create({
        model,
        input: prompt,
        stream: true,
      });

      let out = "";
      for await (const event of stream) {
        if (signal.aborted) return out;
        if (
          event.event_type === "step.delta" &&
          event.delta.type === "text" &&
          event.delta.text
        ) {
          out += event.delta.text;
        }
      }
      return out;
    } catch (err) {
      throw classify(err);
    }
  }
}

/** Multi-turn history in the shape the Interactions API expects. */
function toSteps(messages: ChatMessage[]) {
  return messages.map((message) =>
    message.role === "user"
      ? {
          type: "user_input" as const,
          content: [{ type: "text" as const, text: message.content }],
        }
      : {
          type: "model_output" as const,
          content: [{ type: "text" as const, text: message.content }],
        },
  );
}

/** Thought summaries carry Content rather than a bare string. */
function thoughtText(delta: { content?: unknown }): string {
  const content = delta.content;
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object" && "text" in content) {
    const text = (content as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }
  return "";
}

/**
 * Map SDK failures onto the error codes the UI knows how to render.
 *
 * Rate limiting is the one that matters here: the free tier allows roughly
 * 10 requests per minute, so 429 is an expected operating condition rather
 * than an exceptional one, and it needs to reach the client precisely enough
 * for `resolve` to fall back to a fixture.
 */
function classify(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;

  const status = extractStatus(err);
  const message = err instanceof Error ? err.message : String(err);

  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
    return new ProviderError(
      "rate_limit",
      "Gemini's free-tier rate limit was reached.",
      true,
      extractRetryAfter(message),
    );
  }

  if (status === 503 || status === 504 || /timeout|deadline/i.test(message)) {
    return new ProviderError(
      "timeout",
      "The model took too long to respond.",
      true,
    );
  }

  return new ProviderError("unknown", message, true);
}

function extractStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const record = err as Record<string, unknown>;
  if (typeof record.status === "number") return record.status;
  if (typeof record.code === "number") return record.code;
  return undefined;
}

/** Gemini reports its backoff hint inside the error body. */
function extractRetryAfter(message: string): number | undefined {
  const match = message.match(/retry(?:Delay|-after)["':\s]+(\d+)/i);
  return match ? Number(match[1]) : undefined;
}
