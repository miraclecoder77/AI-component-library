import { handlePattern } from "@/lib/ai/route";
import { jobPostingJsonSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handlePattern(request, "structured-output", jobPostingJsonSchema());
}
