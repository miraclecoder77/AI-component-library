import type { PatternId } from "./ai/types";

/**
 * The gallery index.
 *
 * One entry per pattern, carrying everything the shell needs: the copy, the
 * source files to display, and the accessibility notes. Adding a pattern means
 * adding an entry and a component -- the gallery, the routes list, and the
 * code viewer all read from here.
 *
 * `files` are repo-relative paths read at build time by `CodePeek`. Because
 * the viewer reads the real files rather than a copy, the code shown is
 * always the code running.
 */

export interface Pattern {
  slug: PatternId;
  title: string;
  /** One line for the gallery card. */
  blurb: string;
  /** Why the pattern matters. Two or three sentences, shown above the demo. */
  why: string;
  /** Specific accessibility decisions, listed under the demo. */
  a11y: string[];
  files: { path: string; note: string }[];
  status: "live" | "planned";
}

export const PATTERNS: Pattern[] = [
  {
    slug: "streaming-chat",
    title: "Streaming chat",
    blurb: "Token streaming with a real stop control and honest latency reporting.",
    why: "Streaming turns a loading state into a reading experience: the user starts consuming the answer while it is still being written, so the wait is spent productively. It also makes time to first token the number that matters — a reply that starts in 200ms and runs for eight seconds feels faster than one that starts in three seconds and runs for four. And once people can read along, they need a way out, which is why the stop control has to abort the request rather than just stop painting.",
    a11y: [
      "The visible stream is aria-hidden; a polite live region announces completed sentences instead, so screen readers receive coherent units rather than a flood of tokens.",
      "Stop returns focus to the composer, so keyboard users are not stranded on a button that has just disappeared.",
      "The token reveal animation is driven by JavaScript, so prefers-reduced-motion is checked in the hook itself and text appears instantly instead.",
      "The composer stays enabled while streaming, so the next message can be composed without waiting.",
    ],
    files: [
      { path: "components/ai/StreamingText.tsx", note: "Rendering and the live region" },
      { path: "hooks/useSmoothStream.ts", note: "Frame-paced reveal" },
      { path: "hooks/useStreamController.ts", note: "The shared state machine" },
      { path: "lib/ai/parse.ts", note: "NDJSON parsing across chunk boundaries" },
      { path: "app/api/chat/route.ts", note: "The route" },
    ],
    status: "live",
  },
  {
    slug: "structured-output",
    title: "Structured output",
    blurb: "Schema-constrained JSON that fills a form field by field as it streams.",
    why: "Schema-constrained generation guarantees the final payload is valid, but says nothing about the fragments in between — so the naive implementation waits for the closing brace and the form snaps into existence all at once, discarding the entire benefit of streaming. Parsing the accumulated buffer tolerantly on every chunk lets fields populate as they arrive, which turns an opaque wait into visible progress.",
    a11y: [
      "Each field is a real labelled element, so the filled form is navigable rather than being a decorative rendering of JSON.",
      "Fields announce politely as they settle, not on every keystroke of the stream.",
      "Pending fields are marked with aria-busy rather than being visually greyed out alone.",
    ],
    files: [
      { path: "lib/ai/partial-json.ts", note: "Tolerant parser for incomplete JSON" },
      { path: "lib/schemas.ts", note: "One Zod schema, used for both the model and the UI" },
      { path: "components/demos/StructuredOutputDemo.tsx", note: "Progressive form" },
      { path: "app/api/structured/route.ts", note: "The route" },
    ],
    status: "live",
  },
  {
    slug: "multi-step-agent",
    title: "Multi-step agent",
    blurb: "A bounded pipeline whose plan, steps, and tool calls are all visible.",
    why: "Multi-step work takes long enough that a spinner starts to read as a hang. Publishing the plan before any work begins, then marking each step as it moves from pending to active to done, converts an unbounded wait into a bounded one without making anything faster. Exposing the tool calls and their arguments does the other half of the job: when the answer is wrong, the user can see where it went wrong.",
    a11y: [
      "The step list is a polite live region, so progress is announced per transition rather than per token.",
      "Step status is conveyed by text in a visually-hidden span, not by colour and position alone.",
      "Tool cards are native details/summary elements, so expansion works without JavaScript and is announced correctly.",
    ],
    files: [
      { path: "lib/ai/agent.ts", note: "The bounded pipeline" },
      { path: "lib/ai/tools.ts", note: "Deterministic local tools" },
      { path: "components/ai/StepTimeline.tsx", note: "Progress rendering" },
      { path: "components/ai/ToolCallCard.tsx", note: "Tool call inspection" },
    ],
    status: "live",
  },
];

/** Patterns designed but not yet built. Shown on the gallery as upcoming. */
export const PLANNED: { title: string; blurb: string }[] = [
  {
    title: "Optimistic UI",
    blurb: "Local-first sends with a visible pending state and a real rollback path.",
  },
  {
    title: "Progressive image generation",
    blurb: "Prompt expansion, then generation, then an edit pass — each stage rendered as it lands.",
  },
  {
    title: "Voice in and out",
    blurb: "Browser speech recognition and synthesis with the model in between.",
  },
  {
    title: "Model comparison",
    blurb: "The same prompt against three models, streaming side by side.",
  },
];

export function patternBySlug(slug: string): Pattern | undefined {
  return PATTERNS.find((pattern) => pattern.slug === slug);
}
