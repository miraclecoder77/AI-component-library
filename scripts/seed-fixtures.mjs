/**
 * Generates placeholder fixtures so every demo runs before an API key exists.
 *
 * These are SYNTHETIC. They are marked as such in the JSON, and
 * `scripts/record-fixtures.ts` replaces them with real captures. They exist so
 * that `npm run dev` on a fresh clone produces a working gallery rather than a
 * wall of error states.
 *
 * The timing model matters more than the text: real streams arrive in uneven
 * bursts with occasional stalls, and that unevenness is what the smoothing
 * layer absorbs. A uniform drip would make smoothing look pointless.
 *
 *   node scripts/seed-fixtures.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "fixtures");
mkdirSync(outDir, { recursive: true });

// Deterministic pseudo-random so regenerating does not churn the diff.
let seed = 20260820;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

/** Word-chunk a string into deltas with burst/stall timing. */
function textFrames(text, startMs) {
  const words = text.split(/(\s+)/);
  const frames = [];
  let at = startMs;

  for (let i = 0; i < words.length; i += 3) {
    const chunk = words.slice(i, i + 3).join("");
    if (!chunk) continue;

    // Most chunks land quickly; roughly one in nine stalls, the way a real
    // connection does when a packet is late.
    const stalled = random() < 0.11;
    at += stalled ? 180 + random() * 320 : 22 + random() * 46;

    frames.push({ atMs: Math.round(at), event: { type: "delta", text: chunk } });
  }

  return frames;
}

function write(fixture) {
  const name = `${fixture.pattern}.${fixture.variant}.json`;
  writeFileSync(join(outDir, name), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`  ${name}  (${fixture.frames.length} frames)`);
}

console.log("Writing synthetic fixtures:");

// --- streaming chat ------------------------------------------------------

const chatText =
  "Streaming changes what the user is doing while they wait. Instead of " +
  "watching a spinner and wondering whether anything is happening, they " +
  "start reading, and the remaining generation time is spent productively.\n\n" +
  "The number that matters most is time to first token, not total duration. " +
  "A reply that begins in 200ms and finishes in eight seconds feels faster " +
  "than one that begins in three seconds and finishes in four, because the " +
  "first one stops feeling like waiting almost immediately. That is also why " +
  "a stop control is essential: once people can read along, they will often " +
  "know the answer is wrong before it is finished, and they need a way out.";

write({
  pattern: "streaming-chat",
  variant: "default",
  model: "gemini-3.7-flash",
  synthetic: true,
  recordedAt: null,
  frames: textFrames(chatText, 240),
});

// --- structured output ---------------------------------------------------
// Frames are whole parsed values, exactly what the tolerant parser produces
// from a growing buffer -- including partial string values mid-fill.

const structuredSteps = [
  { title: "Senior Front" },
  { title: "Senior Frontend Engineer" },
  { title: "Senior Frontend Engineer", company: "Northwind" },
  { title: "Senior Frontend Engineer", company: "Northwind Labs" },
  {
    title: "Senior Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote (EU)",
  },
  {
    title: "Senior Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote (EU)",
    employmentType: "full_time",
  },
  {
    title: "Senior Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote (EU)",
    employmentType: "full_time",
    salaryMin: 95000,
  },
  {
    title: "Senior Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote (EU)",
    employmentType: "full_time",
    salaryMin: 95000,
    salaryMax: 125000,
    currency: "EUR",
  },
  {
    title: "Senior Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote (EU)",
    employmentType: "full_time",
    salaryMin: 95000,
    salaryMax: 125000,
    currency: "EUR",
    skills: ["TypeScript", "React"],
  },
  {
    title: "Senior Frontend Engineer",
    company: "Northwind Labs",
    location: "Remote (EU)",
    employmentType: "full_time",
    salaryMin: 95000,
    salaryMax: 125000,
    currency: "EUR",
    skills: ["TypeScript", "React", "Streaming UIs", "Accessibility"],
    remote: true,
  },
];

let structuredAt = 380;
write({
  pattern: "structured-output",
  variant: "default",
  model: "gemini-3.7-flash",
  synthetic: true,
  recordedAt: null,
  frames: structuredSteps.map((json) => {
    structuredAt += 130 + random() * 210;
    return { atMs: Math.round(structuredAt), event: { type: "partial", json } };
  }),
});

// --- multi-step agent ----------------------------------------------------

const agentSteps = [
  ["plan", "Interpret the question"],
  ["retrieve", "Search the pattern corpus"],
  ["analyse", "Select relevant material"],
  ["answer", "Compose the answer"],
];

const agentFrames = [];
let agentAt = 120;

for (const [id, label] of agentSteps) {
  agentFrames.push({
    atMs: agentAt,
    event: { type: "step", id, label, status: "pending" },
  });
  agentAt += 12;
}

function advance(id, label, status, gap) {
  agentAt += gap;
  agentFrames.push({
    atMs: Math.round(agentAt),
    event: { type: "step", id, label, status },
  });
}

advance("plan", "Interpret the question", "active", 160);
advance("plan", "Interpret the question", "done", 900);

advance("retrieve", "Search the pattern corpus", "active", 90);

const toolArgs = { query: "streaming latency perceived speed", limit: 3 };
const toolResult = [
  {
    id: "ttft",
    title: "Time to first token",
    score: 7,
    excerpt:
      "Time to first token (TTFT) is the delay between a request and the first visible character.",
  },
  {
    id: "streaming",
    title: "Why streaming changes the interaction",
    score: 5,
    excerpt: "Streaming converts a loading state into a reading experience.",
  },
  {
    id: "smoothing",
    title: "Token smoothing",
    score: 3,
    excerpt: "Network chunks arrive unevenly -- several tokens at once, then nothing.",
  },
];

agentAt += 120;
agentFrames.push({
  atMs: Math.round(agentAt),
  event: { type: "tool", id: "search-1", name: "searchCorpus", args: toolArgs },
});

agentAt += 260;
agentFrames.push({
  atMs: Math.round(agentAt),
  event: {
    type: "tool",
    id: "search-1",
    name: "searchCorpus",
    args: toolArgs,
    result: toolResult,
  },
});

advance("retrieve", "Search the pattern corpus", "done", 90);
advance("analyse", "Select relevant material", "active", 110);
advance("analyse", "Select relevant material", "done", 640);
advance("answer", "Compose the answer", "active", 120);

const agentAnswer =
  "Perceived speed is governed by time to first token rather than total " +
  "generation time. Once the first characters appear the user switches from " +
  "waiting to reading, so the rest of the response is absorbed rather than " +
  "endured.\n\nThat is why streaming is worth the added complexity, and why " +
  "the arrival pattern needs smoothing: chunks land in uneven bursts, and " +
  "rendering them raw reads as stutter even when the underlying stream is fast.";

const answerFrames = textFrames(agentAnswer, agentAt + 200);
agentFrames.push(...answerFrames);
agentAt = answerFrames.at(-1).atMs;

advance("answer", "Compose the answer", "done", 60);

write({
  pattern: "multi-step-agent",
  variant: "default",
  model: "gemini-3.7-flash",
  synthetic: true,
  recordedAt: null,
  frames: agentFrames,
});

console.log("Done.");
