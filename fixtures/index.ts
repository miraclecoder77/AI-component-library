import type { Fixture } from "@/lib/ai/types";
import agent from "./multi-step-agent.default.json";
import chat from "./streaming-chat.default.json";
import structured from "./structured-output.default.json";

/**
 * Recorded responses, imported statically.
 *
 * Static imports rather than `fs.readFile` at request time: the bundler then
 * guarantees these ship with the deployment. Reading from disk works locally
 * and then fails on a serverless deploy where only traced files are present,
 * which would break the fallback exactly when it is needed most.
 */
export const FIXTURES: Fixture[] = [
  chat as Fixture,
  structured as Fixture,
  agent as Fixture,
];
