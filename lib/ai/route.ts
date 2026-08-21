import { z } from "zod";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import { streamHeaders, streamResponse } from "./encode";
import { resolveProvider } from "./resolve";
import type { ModelId, PatternId, StreamEvent } from "./types";
import { MODELS } from "./types";

/**
 * Shared request handling for every pattern route.
 *
 * Keeping this in one place is what makes the route files three lines each.
 * Rate limiting, validation, model selection, and abort wiring are identical
 * across patterns; only the schema differs.
 */

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  model: z.string().optional(),
  variant: z.string().optional(),
});

const ALLOWED_MODELS = new Set<string>(Object.values(MODELS));

export async function handlePattern(
  request: Request,
  pattern: PatternId,
  schema?: Record<string, unknown>,
): Promise<Response> {
  const limit = checkRateLimit(clientKey(request));
  if (!limit.ok) {
    // Returned as a stream, not as JSON, so the client parses every outcome
    // through the same code path. One parser, one state machine -- including
    // for failures that never reach a provider.
    return errorStream(
      {
        type: "error",
        code: "rate_limit",
        message: "You have made a lot of requests. Give it a moment.",
        retryable: true,
        retryAfterS: limit.retryAfterS,
      },
      429,
      { "Retry-After": String(limit.retryAfterS) },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return errorStream(
      {
        type: "error",
        code: "unknown",
        message: "That request was malformed.",
        retryable: false,
      },
      400,
    );
  }

  // Never trust a client-supplied model id: an arbitrary string would let a
  // visitor point our key at an expensive model.
  const model: ModelId =
    body.model && ALLOWED_MODELS.has(body.model)
      ? (body.model as ModelId)
      : MODELS.flash;

  return streamResponse(
    resolveProvider(),
    {
      pattern,
      model,
      messages: body.messages,
      schema,
      variant: body.variant,
    },
    // Fires when the browser disconnects, including when the user presses
    // stop. This is what makes the stop button abort real work rather than
    // just stop painting.
    request.signal,
  );
}

/** A complete NDJSON stream carrying exactly one event. */
export function errorStream(
  event: StreamEvent,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(event) + "\n", {
    status,
    headers: streamHeaders(extraHeaders),
  });
}
