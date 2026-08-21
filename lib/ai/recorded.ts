import { FIXTURES } from "@/fixtures";
import type {
  AIProvider,
  Fixture,
  ProviderEvent,
  StreamRequest,
} from "./types";
import { ProviderError } from "./types";

/**
 * Replays a recorded response.
 *
 * This is the reason every demo on the site keeps working. Gemini's free tier
 * allows roughly ten requests per minute; three people opening three demos
 * exhausts it. Rather than showing a broken gallery, exhausted requests fall
 * back to a captured response and the UI says so plainly.
 *
 * Timing is replayed from the recording rather than emitted at a uniform
 * rate. Real streams arrive in uneven bursts, and that unevenness is exactly
 * what the smoothing layer exists to absorb -- a synthetic even drip would
 * make the smoothing look unnecessary and the demo dishonest.
 */
export class RecordedProvider implements AIProvider {
  readonly mode = "recorded" as const;

  /** Speeds up or slows down replay. 1 = original pace. */
  constructor(private readonly rate = 1) {}

  async *stream(
    req: StreamRequest,
    signal: AbortSignal,
  ): AsyncGenerator<ProviderEvent> {
    const fixture = selectFixture(req);

    if (!fixture) {
      throw new ProviderError(
        "unknown",
        `No recorded response available for "${req.pattern}".`,
        false,
      );
    }

    let elapsed = 0;

    for (const frame of fixture.frames) {
      if (signal.aborted) return;

      const wait = Math.max(0, frame.atMs - elapsed) / this.rate;
      if (wait > 0) await sleep(wait, signal);
      if (signal.aborted) return;

      elapsed = frame.atMs;
      yield frame.event;
    }
  }
}

/**
 * Pick the fixture that best matches the request.
 *
 * Prefers an exact variant match, then any fixture for the pattern. Variants
 * exist so the error-state demos can request a specific recorded failure.
 */
function selectFixture(req: StreamRequest): Fixture | undefined {
  const candidates = FIXTURES.filter(
    (fixture) => fixture.pattern === req.pattern,
  );
  if (candidates.length === 0) return undefined;

  if (req.variant) {
    const exact = candidates.find((fixture) => fixture.variant === req.variant);
    if (exact) return exact;
  }

  return candidates.find((fixture) => fixture.variant === "default") ?? candidates[0];
}

/** Abort-aware sleep: a stopped replay must not keep timers alive. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });

    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
  });
}
