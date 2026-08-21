/**
 * Tolerant parser for incomplete JSON.
 *
 * Structured output arrives as a stream of text fragments that only become
 * valid JSON at the very last character. Waiting for the close brace means
 * the form sits empty and then snaps into existence -- which throws away the
 * entire benefit of streaming.
 *
 * This closes whatever structures are still open so the half-received value
 * can be rendered on every chunk. Partial *string* values are kept rather
 * than discarded: watching a field fill in character by character is the
 * effect worth having, so `{"name": "Ada Lo` yields `{ name: "Ada Lo" }`.
 *
 * Returns `undefined` when nothing coherent can be salvaged yet, which is
 * only true for the first few characters of a response.
 */
export function parsePartialJson(text: string): unknown | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Models often wrap JSON in a code fence despite being told not to.
  const unfenced = stripFence(trimmed);

  // Fast path: the stream has finished, or happens to be complete.
  try {
    return JSON.parse(unfenced);
  } catch {
    // fall through to repair
  }

  // Walk backwards, repairing each prefix, until one parses. In practice the
  // first attempt succeeds -- later iterations only matter when the stream
  // stopped mid-token (`tru`, `1.`, or a key with no value yet).
  const floor = Math.max(0, unfenced.length - MAX_BACKTRACK);
  for (let end = unfenced.length; end > floor; end--) {
    const repaired = repairPrefix(unfenced.slice(0, end));
    if (repaired === null) continue;
    try {
      return JSON.parse(repaired);
    } catch {
      // keep shortening
    }
  }

  return undefined;
}

/**
 * How far back to walk before giving up. Bounds the worst case: without it,
 * a badly malformed response would cost O(n^2) on every streamed chunk.
 */
const MAX_BACKTRACK = 512;

function stripFence(s: string): string {
  if (!s.startsWith("```")) return s;
  const firstNewline = s.indexOf("\n");
  if (firstNewline === -1) return s;
  const body = s.slice(firstNewline + 1);
  const closing = body.lastIndexOf("```");
  return (closing === -1 ? body : body.slice(0, closing)).trim();
}

/**
 * Close every structure left open in `s`.
 *
 * Returns null when the prefix cannot be repaired in place -- the caller
 * shortens and tries again.
 */
function repairPrefix(s: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const char = s[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") stack.pop();
  }

  let out = s;

  // A trailing backslash would escape the quote we are about to add.
  if (escaped) out = out.slice(0, -1);
  if (inString) out += '"';

  out = out.trimEnd();

  // A dangling comma or colon cannot be closed over; shorten instead.
  const last = out[out.length - 1];
  if (last === ",") out = out.slice(0, -1).trimEnd();
  else if (last === ":") return null;

  // A structure that has only just opened carries no information yet, and
  // closing it would emit an empty object into the output -- which renders as
  // a blank row that appears and then fills. Shortening instead means the
  // element simply arrives once it has content.
  const tail = out[out.length - 1];
  if (tail === "{" || tail === "[") return null;

  if (out.length === 0) return null;

  return out + stack.reverse().join("");
}
