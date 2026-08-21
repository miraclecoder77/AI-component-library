import { handlePattern } from "@/lib/ai/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handlePattern(request, "multi-step-agent");
}
