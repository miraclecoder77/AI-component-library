import type { StreamEvent } from "./types";

/**
 * Client side of the wire protocol.
 *
 * Reads an NDJSON response body and yields typed events. The subtlety worth
 * noting: chunk boundaries do not respect line boundaries. A single read can
 * deliver half an event, or three and a half events. The trailing partial
 * line must be carried into the next iteration, which is the bug most
 * hand-rolled streaming clients ship with -- it only shows up under slow
 * networks or long tokens, so it survives local testing.
 */
export async function* parseStream(
  response: Response,
): AsyncGenerator<StreamEvent> {
  if (!response.body) {
    throw new Error("Response has no body to stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // `stream: true` keeps multi-byte characters intact across chunk
      // boundaries. Without it, an emoji split across two reads becomes
      // two replacement characters.
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // The last element is either an empty string (buffer ended on a
      // newline) or an incomplete event. Either way it goes back in.
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseLine(line);
        if (event) yield event;
      }
    }

    // Flush whatever the final read left behind.
    buffer += decoder.decode();
    const event = parseLine(buffer);
    if (event) yield event;
  } finally {
    reader.releaseLock();
  }
}

function parseLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as StreamEvent;
  } catch {
    // A malformed line should not tear down an otherwise healthy stream.
    return null;
  }
}
