import { documentById, searchCorpus } from "./tools";
import type { ProviderEvent, StreamRequest } from "./types";

/**
 * The multi-step agent.
 *
 * Four steps, fixed shape, no loop. That is a deliberate constraint: an
 * open-ended agent loop on a ~10 requests/minute quota produces a demo that
 * fails in front of visitors. A bounded pipeline still demonstrates the thing
 * worth demonstrating -- that a long operation becomes tolerable when its
 * structure is visible -- while staying inside the budget.
 *
 * Two of the four steps call the model. The retrieval step runs locally and
 * is emitted as a tool call so the timeline shows a real, inspectable
 * invocation rather than a decorative one.
 */

/** The minimum a provider must offer for the agent to drive it. */
export interface Completer {
  complete(model: string, prompt: string, signal: AbortSignal): Promise<string>;
}

const STEPS = [
  { id: "plan", label: "Interpret the question" },
  { id: "retrieve", label: "Search the pattern corpus" },
  { id: "analyse", label: "Select relevant material" },
  { id: "answer", label: "Compose the answer" },
] as const;

/** The plan, published before any work starts. */
export function agentPlan() {
  return STEPS.map((step) => ({ ...step, status: "pending" as const }));
}

export async function* runAgent(
  provider: Completer,
  req: StreamRequest,
  signal: AbortSignal,
): AsyncGenerator<ProviderEvent> {
  const question = req.messages.at(-1)?.content?.trim() ?? "";

  // Publish the whole plan first. Showing four pending steps immediately is
  // what converts an unbounded wait into a bounded one -- the user can see
  // how much is left before anything has happened.
  for (const step of STEPS) {
    yield { type: "step", id: step.id, label: step.label, status: "pending" };
  }

  // --- 1. Interpret ------------------------------------------------------
  yield step("plan", "active");

  const searchQuery = await provider.complete(
    req.model,
    `Extract 3 to 6 search keywords from this question about AI interface design.
Reply with the keywords only, space separated, no punctuation or commentary.

Question: ${question}`,
    signal,
  );
  if (signal.aborted) return;

  const cleanedQuery = searchQuery.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
  yield step("plan", "done");

  // --- 2. Retrieve (local tool) -----------------------------------------
  yield step("retrieve", "active");

  const toolCallId = "search-1";
  const args = { query: cleanedQuery || question, limit: 3 };

  // Emitted before the result so the UI can render the invocation while it
  // is still in flight -- the same reason the plan is published up front.
  yield { type: "tool", id: toolCallId, name: "searchCorpus", args };

  const results = searchCorpus(args.query, args.limit);

  yield {
    type: "tool",
    id: toolCallId,
    name: "searchCorpus",
    args,
    result: results,
  };

  if (results.length === 0) {
    yield step("retrieve", "error");
    yield {
      type: "delta",
      text: `Nothing in the corpus matches "${question}". It covers streaming, latency, optimistic updates, structured output, agent progress, error recovery, and accessibility -- try one of those.`,
    };
    return;
  }

  yield step("retrieve", "done");

  // --- 3. Analyse --------------------------------------------------------
  yield step("analyse", "active");

  const sources = results
    .map((result) => {
      const doc = documentById(result.id);
      return `### ${result.title}\n${doc?.body ?? result.excerpt}`;
    })
    .join("\n\n");

  yield step("analyse", "done");

  // --- 4. Answer ---------------------------------------------------------
  yield step("answer", "active");

  const answer = await provider.complete(
    req.model,
    `Answer the question using only the sources below. Be specific and concrete.
Two short paragraphs at most. Do not mention that you were given sources.

Sources:
${sources}

Question: ${question}`,
    signal,
  );
  if (signal.aborted) return;

  // The final call is buffered rather than streamed, because the answer is
  // short and the step timeline is already carrying the progress signal.
  // Re-chunking it here keeps the reveal consistent with the other demos.
  for (const chunk of chunkText(answer)) {
    if (signal.aborted) return;
    yield { type: "delta", text: chunk };
  }

  yield step("answer", "done");
}

function step(
  id: (typeof STEPS)[number]["id"],
  status: "active" | "done" | "error",
): ProviderEvent {
  const found = STEPS.find((candidate) => candidate.id === id)!;
  return { type: "step", id: found.id, label: found.label, status };
}

/** Split on word boundaries so the reveal never tears a word in half. */
function chunkText(text: string, size = 6): string[] {
  const words = text.split(/(\s+)/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(""));
  }
  return chunks;
}
