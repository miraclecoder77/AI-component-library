import { GeminiProvider } from "./gemini";
import { RecordedProvider } from "./recorded";
import type {
  AIProvider,
  ProviderEvent,
  SourceMode,
  StreamRequest,
} from "./types";
import { ProviderError } from "./types";

/**
 * Chooses which provider serves a request.
 *
 * The rule is narrow on purpose: fall back to a recording only when the live
 * call fails *before producing anything*. Once tokens are on screen, swapping
 * in a different response mid-stream would splice two answers together, which
 * is worse than showing the error. So a late failure surfaces as an error
 * state and an early one degrades silently to a replay.
 */

/** How long to wait for the first token before giving up on the live call. */
const FIRST_TOKEN_TIMEOUT_MS = 12_000;

export function resolveProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;

  // No key configured -- local development, or a fork someone cloned. Every
  // demo still runs, which is why the fixtures are committed.
  if (!apiKey) return new RecordedProvider();

  return new FallbackProvider(new GeminiProvider(apiKey), new RecordedProvider());
}

class FallbackProvider implements AIProvider {
  /**
   * Read lazily. `instrument` only reads this when it emits `meta`, which
   * happens at the first event -- by which point the decision is settled.
   */
  private resolved: SourceMode = "live";

  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: AIProvider,
  ) {}

  get mode(): SourceMode {
    return this.resolved;
  }

  async *stream(
    req: StreamRequest,
    signal: AbortSignal,
  ): AsyncGenerator<ProviderEvent> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), FIRST_TOKEN_TIMEOUT_MS);
    const combined = AbortSignal.any([signal, timeout.signal]);

    let produced = false;

    try {
      for await (const event of this.primary.stream(req, combined)) {
        // The live call is working; stop the first-token timer so a long
        // generation is not cut off by it.
        if (!produced) {
          produced = true;
          clearTimeout(timer);
        }
        yield event;
      }
      return;
    } catch (err) {
      clearTimeout(timer);

      // The user pressed stop. Not a failure, and not something to replay.
      if (signal.aborted) return;

      // Already committed to an answer -- report rather than replace.
      if (produced) throw err;

      if (!shouldFallBack(err, timeout.signal.aborted)) throw err;
    } finally {
      clearTimeout(timer);
    }

    this.resolved = "recorded";
    yield* this.fallback.stream(req, signal);
  }
}

/**
 * Which failures are worth replaying over.
 *
 * Rate limits and timeouts are expected operating conditions on a free tier,
 * and a visitor should never see them. A malformed request is a bug in this
 * codebase and should stay loud.
 */
function shouldFallBack(err: unknown, timedOut: boolean): boolean {
  if (timedOut) return true;
  if (err instanceof ProviderError) {
    return err.code === "rate_limit" || err.code === "timeout";
  }
  return false;
}
