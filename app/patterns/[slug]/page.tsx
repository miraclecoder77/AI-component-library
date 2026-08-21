import { notFound } from "next/navigation";
import { DemoFrame } from "@/components/demo/DemoFrame";
import { MultiStepAgentDemo } from "@/components/demos/MultiStepAgentDemo";
import { StreamingChatDemo } from "@/components/demos/StreamingChatDemo";
import { StructuredOutputDemo } from "@/components/demos/StructuredOutputDemo";
import { PATTERNS, patternBySlug } from "@/lib/registry";
import type { PatternId } from "@/lib/ai/types";

/**
 * Pattern pages are statically generated. That is what lets `CodePeek` read
 * source files with `fs` -- the read happens at build time, not per request.
 */
export function generateStaticParams() {
  return PATTERNS.map((pattern) => ({ slug: pattern.slug }));
}

/**
 * Unknown slugs 404 without rendering, which guarantees the build-time-only
 * property `CodePeek` relies on.
 */
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/patterns/[slug]">) {
  const { slug } = await params;
  const pattern = patternBySlug(slug);
  if (!pattern) return {};
  return { title: pattern.title, description: pattern.blurb };
}

const DEMOS: Record<PatternId, React.ComponentType> = {
  "streaming-chat": StreamingChatDemo,
  "structured-output": StructuredOutputDemo,
  "multi-step-agent": MultiStepAgentDemo,
};

export default async function PatternPage({
  params,
}: PageProps<"/patterns/[slug]">) {
  const { slug } = await params;
  const pattern = patternBySlug(slug);
  if (!pattern) notFound();

  const Demo = DEMOS[pattern.slug];

  return (
    <DemoFrame pattern={pattern}>
      <Demo />
    </DemoFrame>
  );
}
