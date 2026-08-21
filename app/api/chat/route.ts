import { handlePattern } from "@/lib/ai/route";

// Node runtime: the fixture fallback and the SDK both need it. Edge would
// also work for the live path, but not for both.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handlePattern(request, "streaming-chat");
}
