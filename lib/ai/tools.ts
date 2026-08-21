/**
 * Local, deterministic tools for the agent demo.
 *
 * These deliberately do not call anything. The agent demo already spends
 * three model calls per run against a ~10 requests/minute ceiling; adding a
 * live search would make the most fragile demo on the site depend on a second
 * quota. Keeping retrieval local means the interesting part -- the visible
 * step timeline, the tool cards, the failure states -- is reproducible every
 * time, which is what visitors are actually here to look at.
 */

export interface Document {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

/** A small corpus about AI interface patterns. */
export const CORPUS: Document[] = [
  {
    id: "ttft",
    title: "Time to first token",
    tags: ["latency", "streaming", "perception"],
    body: "Time to first token (TTFT) is the delay between a request and the first visible character. It dominates perceived speed far more than total generation time: a response that starts in 200ms and takes 8 seconds feels faster than one that starts in 3 seconds and takes 4. Optimising total latency while ignoring TTFT is the most common mistake in AI interfaces.",
  },
  {
    id: "streaming",
    title: "Why streaming changes the interaction",
    tags: ["streaming", "perception", "trust"],
    body: "Streaming converts a loading state into a reading experience. The user starts consuming output while generation continues, so waiting time is spent productively. It also makes it possible to abandon a bad answer early, which requires a stop control to be useful.",
  },
  {
    id: "smoothing",
    title: "Token smoothing",
    tags: ["streaming", "motion", "polish"],
    body: "Network chunks arrive unevenly -- several tokens at once, then nothing for 300ms. Rendering them the instant they arrive produces visible stutter. Buffering arrivals and releasing characters on a steady animation-frame cadence makes the same stream feel calm and deliberate, at the cost of a small, constant delay behind the true stream position.",
  },
  {
    id: "optimistic",
    title: "Optimistic updates",
    tags: ["optimistic", "latency", "state"],
    body: "An optimistic update applies the user's action locally before the server confirms it. In chat this means the user's own message appears instantly. The requirement is a visible pending affordance and a real rollback path, otherwise a failed send silently disappears and the user repeats themselves.",
  },
  {
    id: "stop",
    title: "Stop generation",
    tags: ["control", "streaming", "abort"],
    body: "A stop button must actually abort the underlying request, not merely stop painting. Cosmetic stops keep burning quota and keep the connection open. The correct implementation aborts the fetch via AbortController, and the resulting partial output should be kept on screen rather than discarded -- the user stopped because they had read enough.",
  },
  {
    id: "errors",
    title: "Error states worth building",
    tags: ["errors", "recovery", "trust"],
    body: "Three failures dominate real AI products: rate limits, timeouts, and empty responses. Each wants a different recovery. A rate limit wants a countdown and an automatic retry. A timeout wants an immediate retry with backoff. An empty response wants a prompt to rephrase, since retrying identical input usually reproduces it. A single generic error message throws away all of that.",
  },
  {
    id: "structured",
    title: "Structured output and progressive forms",
    tags: ["structured", "streaming", "forms"],
    body: "Schema-constrained generation only guarantees the final payload is valid; intermediate chunks are fragments. Parsing the accumulated buffer tolerantly on each chunk lets form fields populate progressively instead of appearing all at once, which turns an opaque wait into visible progress.",
  },
  {
    id: "agents",
    title: "Making agent progress legible",
    tags: ["agents", "progress", "trust"],
    body: "Multi-step agents take long enough that a spinner reads as a hang. Showing the plan up front and marking each step as it moves from pending to active to done converts an unbounded wait into a bounded one. Exposing tool calls and their arguments also makes the system auditable when it goes wrong.",
  },
  {
    id: "a11y",
    title: "Accessibility of streaming text",
    tags: ["accessibility", "streaming", "aria"],
    body: "A naive aria-live region announces every token, producing unusable screen reader output. The workable pattern is to render the visual stream in an aria-hidden container and announce completed sentences in a polite live region, so assistive technology receives coherent units rather than fragments.",
  },
  {
    id: "reduced-motion",
    title: "Reduced motion in AI interfaces",
    tags: ["accessibility", "motion"],
    body: "Streaming interfaces are unusually motion-heavy: fading tokens, blinking cursors, shimmer placeholders. Honouring prefers-reduced-motion means removing the fade and the blink while keeping the information they carried, so a reduced-motion user still sees where the stream has reached.",
  },
];

export interface SearchResult {
  id: string;
  title: string;
  score: number;
  excerpt: string;
}

/**
 * Term-overlap search over the corpus.
 *
 * Simple on purpose: it is a demonstration of a tool call being made visible,
 * not a retrieval system.
 */
export function searchCorpus(query: string, limit = 3): SearchResult[] {
  const terms = tokenise(query);
  if (terms.length === 0) return [];

  return CORPUS.map((doc) => {
    const haystack = tokenise(`${doc.title} ${doc.body} ${doc.tags.join(" ")}`);
    const score = terms.reduce(
      (total, term) =>
        total + haystack.filter((word) => word.startsWith(term)).length,
      0,
    );
    return {
      id: doc.id,
      title: doc.title,
      score,
      excerpt: doc.body.slice(0, 240),
    };
  })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "it", "for",
  "on", "with", "how", "what", "why", "does", "do", "i", "my", "be",
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export function documentById(id: string): Document | undefined {
  return CORPUS.find((doc) => doc.id === id);
}
