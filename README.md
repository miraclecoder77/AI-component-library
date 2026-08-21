# AI Interface Patterns

A working gallery of interface patterns for AI products. Every pattern is
live, runs against a real model, and shows the source that produced it.

The patterns themselves are not the hard part — streaming text to a page is a
weekend's work. What this is actually about is the parts usually skipped: what
happens in the gap before the first token, what a stop button has to do to be
honest, how a screen reader experiences text that arrives one token at a time,
and what the interface should do when a free-tier quota runs out mid-demo.

**Live:** _(add your Vercel URL here)_

---

## What's in it

| Pattern | What it demonstrates |
| --- | --- |
| **Streaming chat** | Token streaming, frame-paced smoothing, a stop button that aborts the request, TTFT reporting, and differentiated error states |
| **Structured output** | Schema-constrained JSON parsed tolerantly on every chunk, so a form fills field by field instead of snapping into existence |
| **Multi-step agent** | A bounded pipeline that publishes its plan before starting and exposes every tool call with its arguments |

Plus a [`/foundations`](/foundations) page documenting the token layer,
including the AI-specific semantic tokens a general design system has no
vocabulary for.

Designed but not yet built: optimistic UI, progressive image generation, voice
in/out, and side-by-side model comparison. They slot into the same shell.

---

## Running it

```bash
npm install
npm run dev
```

That's the whole setup. **No API key is required** — without one, every demo
runs from committed fixtures. Add a key to run against the live model:

```bash
echo "GEMINI_API_KEY=your-key-here" > .env.local
```

Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### Other commands

```bash
npm run test:unit
```

```bash
npm run test:e2e
```

```bash
npm run fixtures:record
```

`fixtures:record` re-captures the recorded responses against the live API.
Run it with the dev server up and a key configured; it refuses to write a
fixture that came back in `recorded` mode, so a quota-limited run cannot
silently re-record a fixture from a fixture.

---

## How it's built

**Next.js 16 (App Router), TypeScript, custom CSS with CSS Modules, Radix
primitives for behaviour, Google Gemini.** No Vercel AI SDK — the streaming
transport, parsing, state machine, and abort handling are all hand-rolled,
because they are the thing being demonstrated.

### One protocol, three demos

Every route emits the same event union, and every demo consumes it through the
same parser and the same state machine:

```ts
type StreamEvent =
  | { type: "meta";    model: string; mode: "live" | "recorded"; ttftMs: number }
  | { type: "delta";   text: string }
  | { type: "thinking"; text: string }
  | { type: "step";    id: string; label: string; status: StepStatus }
  | { type: "tool";    id: string; name: string; args?: unknown; result?: unknown }
  | { type: "partial"; json: unknown }
  | { type: "error";   code: ErrorCode; message: string; retryable: boolean }
  | { type: "done";    totalMs: number };
```

Newline-delimited JSON over a `ReadableStream`. Chat, structured output, and
the agent differ only in which event types they care about — not in how they
connect, buffer, abort, or report latency. That uniformity is why
`useStreamController` could be written once, and why every pattern gets a real
TTFT meter for free.

### Layout

```
app/
  api/{chat,structured,agent}/   three-line routes over one shared handler
  patterns/[slug]/               statically generated demo pages
  foundations/                   living token documentation
components/
  ai/          the library: StreamingText, StepTimeline, ToolCallCard, ErrorState
  demo/        the shell: DemoFrame, CodePeek
  demos/       the three pattern implementations
hooks/
  useStreamController            the state machine every demo runs on
  useSmoothStream                frame-paced token reveal
  useSentenceAnnouncer           screen-reader announcements
lib/
  ai/          provider interface, Gemini adapter, fixture player, wire protocol
  registry.ts  pattern metadata and which source files each page displays
fixtures/      recorded responses with original frame timing
```

---

## Things I'd have got wrong without building it

**Time to first token is the number that matters, and it is easy to flatter.**
Measuring from connection open rather than from the first event that
represents real progress produces a much prettier number that means nothing.
It is measured once, in `instrument()`, so no demo can quietly report it
differently.

**Raw streaming looks broken.** Network chunks arrive in bursts — several
tokens at once, then nothing for 300ms. Painting each chunk on arrival
faithfully reproduces that jitter and reads as jank even when the stream is
objectively fast. `useSmoothStream` buffers arrivals and releases characters on
animation frames, speeding up when it falls behind. The output sits slightly
behind the true stream position; that lag is the price, and it is worth it.

**Chunk boundaries do not respect line boundaries.** A single `read()` can
deliver half an event or three and a half events. The trailing partial line has
to be carried into the next iteration. Skipping this works locally and fails on
a slow connection, which is the worst possible place to find out.

**`aria-live` on streaming text is actively harmful.** It seems obvious and it
produces unusable output — every token mutates the region, so the screen reader
either interrupts itself continuously or reads a stream of fragments. The
working pattern is to hide the visual stream from assistive technology entirely
and announce completed sentences in a separate polite region.

**A stop button that only stops painting is a lie.** It keeps the connection
open and keeps burning quota. It has to abort the request — and the partial
output should stay on screen, because the user stopped since they had read
enough, not because they wanted it deleted.

**Structured output only guarantees the *final* payload.** Everything before
the closing brace is a fragment. Waiting for validity means the form snaps into
existence at the end, discarding the whole benefit of streaming. A tolerant
parser that closes open structures on every chunk is what makes the pattern
worth anything — including keeping partial *string* values, so a field fills
character by character.

**Free-tier quota is an operating condition, not an exception.** Gemini's free
tier allows roughly ten requests per minute; three people opening three demos
exhausts it. A portfolio site that dies under exactly the traffic that makes it
worth having is a bad portfolio site. So every response is recorded with its
original frame timing, and an exhausted request replays one — labelled, in the
UI, as a recording. Designing the degradation path is a stronger signal than
hiding it.

**That fallback is also what makes the provider abstraction honest.** With a
single vendor, a swap layer would be speculative scaffolding for a second
provider that never arrives. Here the fixture player implements the same
`AIProvider` interface, so the seam is exercised on every quota-exhausted
request rather than sitting unused.

**Reduced motion needs a JavaScript path.** Collapsing every CSS duration token
to `0ms` in one place covers the whole system — except the token reveal, which
is driven by `requestAnimationFrame` and cannot be reached by CSS. It has to
check the preference itself.

---

## Deliberate limitations

- **Agent tools are local and deterministic.** The agent already spends model
  calls against a tight quota; adding live search would make the most fragile
  demo depend on a second one. Retrieval runs against a small in-repo corpus so
  the visible behaviour is reproducible.
- **The agent pipeline is bounded, not a loop.** An open-ended agent loop on a
  free tier produces a demo that fails in front of visitors.
- **Rate limiting is in-memory.** Correct in development, best-effort across
  serverless instances. It is a quota-preservation measure, not a security
  control — the fixture fallback is what actually guarantees the demos work.
  `Limiter` is an interface so a Redis implementation can drop in.
- **Committed fixtures are synthetic until recorded.** They are marked
  `"synthetic": true` in the JSON. Run `npm run fixtures:record` with a key
  configured to replace them with real captures.
