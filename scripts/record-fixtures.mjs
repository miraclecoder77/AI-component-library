/**
 * Captures real responses and writes them as replayable fixtures.
 *
 * Recording happens through the running app rather than by importing the
 * provider directly, which means the captured timing is true end-to-end
 * arrival timing -- network included. That is the timing worth replaying: it
 * is what a visitor would actually have experienced.
 *
 * Usage:
 *   1. Put GEMINI_API_KEY in .env.local
 *   2. npm run dev
 *   3. npm run fixtures:record -- --base http://localhost:3000
 *
 * Existing fixtures are overwritten. Anything that comes back in `recorded`
 * mode is refused rather than written, so a quota-limited run cannot silently
 * re-record a fixture from a fixture.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "fixtures");

const baseIndex = process.argv.indexOf("--base");
const BASE =
  baseIndex !== -1 ? process.argv[baseIndex + 1] : "http://localhost:3000";

const JOBS = [
  {
    pattern: "streaming-chat",
    variant: "default",
    endpoint: "/api/chat",
    body: {
      messages: [
        {
          role: "user",
          content:
            "Why does time to first token matter more than total latency in a chat interface? Two short paragraphs.",
        },
      ],
    },
  },
  {
    pattern: "structured-output",
    variant: "default",
    endpoint: "/api/structured",
    body: {
      messages: [
        {
          role: "user",
          content: `Extract the job posting details from the text below.

We're Northwind Labs, and we're looking for a Senior Frontend Engineer to join our product team. This is a fully remote role open to anyone in the EU.

You'll own our design system and the streaming interfaces in our core product. We care a lot about accessibility and about how things feel under load. Our stack is TypeScript and React.

Salary is 95,000-125,000 EUR depending on experience. Full time, permanent.`,
        },
      ],
    },
  },
  {
    pattern: "multi-step-agent",
    variant: "default",
    endpoint: "/api/agent",
    body: {
      messages: [
        {
          role: "user",
          content: "Why does perceived speed depend on time to first token?",
        },
      ],
    },
  },
];

async function record(job) {
  process.stdout.write(`  ${job.pattern} ... `);

  const started = Date.now();
  const response = await fetch(BASE + job.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job.body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${job.endpoint}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frames = [];
  let model = null;
  let mode = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);

      // meta and done are re-synthesised by `instrument` on replay, so they
      // are metadata here rather than frames.
      if (event.type === "meta") {
        model = event.model;
        mode = event.mode;
        continue;
      }
      if (event.type === "done") continue;
      if (event.type === "error") {
        throw new Error(`${event.code}: ${event.message}`);
      }

      frames.push({ atMs: Date.now() - started, event });
    }
  }

  if (mode !== "live") {
    throw new Error(
      "response came back in 'recorded' mode -- set GEMINI_API_KEY and make sure quota is available",
    );
  }

  if (frames.length === 0) {
    throw new Error("no frames captured");
  }

  const fixture = {
    pattern: job.pattern,
    variant: job.variant,
    model,
    synthetic: false,
    recordedAt: new Date().toISOString(),
    frames,
  };

  const name = `${job.pattern}.${job.variant}.json`;
  writeFileSync(join(outDir, name), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`${frames.length} frames over ${Date.now() - started}ms -> ${name}`);
}

console.log(`Recording fixtures from ${BASE}`);

let failed = 0;
for (const job of JOBS) {
  try {
    await record(job);
  } catch (error) {
    failed++;
    console.log(`failed\n    ${error.message}`);
  }

  // Stay under the free tier's per-minute ceiling between captures.
  await new Promise((resolve) => setTimeout(resolve, 8000));
}

if (failed > 0) {
  console.log(`\n${failed} of ${JOBS.length} failed; existing fixtures kept.`);
  process.exit(1);
}

console.log("\nAll fixtures recorded.");
