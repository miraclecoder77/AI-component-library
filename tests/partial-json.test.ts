import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePartialJson } from "../lib/ai/partial-json.ts";

/**
 * The tolerant parser is the load-bearing piece of the structured-output
 * demo, and every one of these cases is a real shape a stream passes through
 * on its way to valid JSON. Run with:
 *
 *   npm run test:unit
 */

const cases: [string, unknown, string][] = [
  ['{"name": "Ada Lo', { name: "Ada Lo" }, "keeps a partial string value"],
  ['{"a":1,"b":', { a: 1 }, "drops a key with no value yet"],
  ['{"a":1,', { a: 1 }, "strips a trailing comma"],
  ['{"a":[1,2', { a: [1, 2] }, "closes an open array"],
  ['{"a":{"b":"c', { a: { b: "c" } }, "closes nested open structures"],
  ['{"a":tru', undefined, "no value yet for a partial literal"],
  ['{"a":1,"b":tru', { a: 1 }, "a partial literal keeps earlier fields"],
  ['{"a":"he said \\"hi', { a: 'he said "hi' }, "handles an escaped quote"],
  // Two distinct cases. In TS source, "\\\\" is one escaped backslash inside
  // the JSON (a complete escape), while "\\" is a lone trailing backslash
  // that would otherwise escape the quote the repair appends.
  ['{"a":"back\\\\', { a: "back\\" }, "keeps a completed backslash escape"],
  ['{"a":"back\\', { a: "back" }, "drops a dangling backslash"],
  ['```json\n{"a":1}\n```', { a: 1 }, "strips a code fence"],
  ['{"a":1}', { a: 1 }, "passes complete JSON through"],
  ['{"a":[{"b":1},{"c"', { a: [{ b: 1 }] }, "emits no phantom empty object"],
  ['{"s":["x","y', { s: ["x", "y"] }, "keeps a partial string inside an array"],
  ["", undefined, "returns nothing for empty input"],
  ["{", undefined, "returns nothing for a bare brace"],
];

for (const [input, expected, description] of cases) {
  test(description, () => {
    assert.deepEqual(parsePartialJson(input), expected);
  });
}

test("never throws on arbitrary truncations of a real payload", () => {
  const full = JSON.stringify({
    title: "Senior Frontend Engineer",
    salaryMin: 95000,
    skills: ["TypeScript", "React"],
    remote: true,
    nested: { a: [1, 2, { b: "c" }] },
  });

  // Every prefix of a valid document must parse to something or to undefined,
  // and must never throw. This is the property the streaming path relies on.
  for (let i = 0; i <= full.length; i++) {
    assert.doesNotThrow(() => parsePartialJson(full.slice(0, i)));
  }
});
