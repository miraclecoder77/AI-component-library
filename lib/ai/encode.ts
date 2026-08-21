import type {
  AIProvider,
  StreamEvent,
  StreamRequest,
} from "./types";
import { ProviderError } from "./types";

/**
 * Server side of the wire protocol.
 *
 * `instrument` wraps a provider's event stream and is the only place that
 * measures latency or classifies failure. Providers stay dumb: they yield
 * domain events and throw ProviderError. Everything every demo needs for its
 * TTFT meter and its error states is added here, once.
 */
export async function* instrument(
  provider: AIProvider,
  req: StreamRequest,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const startedAt = performance.now();
  let firstEventAt: number | null = null;
  let sawContent = false;

  try {
    for await (const event of provider.stream(req, signal)) {
      // TTFT is measured at the first event that represents real progress,
      // not at connection open -- otherwise it flatters the number.
      if (firstEventAt === null) {
        firstEventAt = performance.now();
        yield {
          type: "meta",
          model: req.model,
          mode: provider.mode,
          ttftMs: Math.round(firstEventAt - startedAt),
        };
      }

      if (event.type === "delta" && event.text.length > 0) sawContent = true;
      if (event.type === "partial" || event.type === "step") sawContent = true;

      yield event;
    }

    // A stream that completes without producing anything is a real failure
    // mode on free tiers (safety blocks, empty candidates) and deserves its
    // own error state rather than an empty bubble.
    if (!sawContent) {
      yield {
        type: "error",
        code: "empty",
        message: "The model returned an empty response.",
        retryable: true,
      };
      return;
    }

    yield { type: "done", totalMs: Math.round(performance.now() - startedAt) };
  } catch (err) {
    if (signal.aborted) {
      // The user pressed stop. Not an error -- close the stream cleanly so
      // the client renders a "stopped" state rather than a failure.
      yield { type: "done", totalMs: Math.round(performance.now() - startedAt) };
      return;
    }

    if (err instanceof ProviderError) {
      yield {
        type: "error",
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        retryAfterS: err.retryAfterS,
      };
      return;
    }

    yield {
      type: "error",
      code: "unknown",
      message: err instanceof Error ? err.message : "Unexpected failure.",
      retryable: true,
    };
  }
}

/**
 * Serialise events as newline-delimited JSON.
 *
 * NDJSON rather than SSE: the payloads are already structured, framing is one
 * `split("\n")`, and there is no `data:` prefix to strip. We are not using
 * EventSource on the client (it cannot POST), so SSE would buy nothing.
 */
export function toStream(
  events: AsyncIterable<StreamEvent>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch {
        // The consumer disconnected mid-write. Nothing to report.
      } finally {
        controller.close();
      }
    },
  });
}

/** Headers that keep proxies and browsers from buffering the stream. */
export function streamHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disables response buffering on nginx-style proxies. Without it,
    // streaming silently degrades to one big chunk in some deployments.
    "X-Accel-Buffering": "no",
    ...extra,
  };
}

/**
 * Convenience: provider -> instrumented -> framed -> Response.
 *
 * Note there is no `X-Demo-Mode` header. Whether a request ends up live or
 * recorded is not known when headers are written -- the fallback only decides
 * once the live call has failed. The `meta` event carries the real answer.
 */
export function streamResponse(
  provider: AIProvider,
  req: StreamRequest,
  signal: AbortSignal,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(toStream(instrument(provider, req, signal)), {
    headers: streamHeaders(extraHeaders),
  });
}
