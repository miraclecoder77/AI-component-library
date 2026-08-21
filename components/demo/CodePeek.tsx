import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { codeToHtml } from "shiki";
import type { Pattern } from "@/lib/registry";
import { CodeTabs } from "./CodeTabs";

/**
 * Shows the source of the demo above it.
 *
 * The files are read from disk at build time rather than being copied into
 * MDX snippets. That difference is the whole point: the code on the page is
 * provably the code that ran, and it cannot drift as the components are
 * edited. Highlighting happens here too, so no highlighter ships to the
 * browser -- the client bundle carries the copy button and nothing else.
 */
export async function CodePeek({ pattern }: { pattern: Pattern }) {
  const files = await Promise.all(
    pattern.files.map(async (file) => {
      const raw = await readSource(file.path);
      return {
        path: file.path,
        note: file.note,
        raw,
        html: await codeToHtml(raw, {
          lang: languageFor(file.path),
          themes: { light: "github-light", dark: "github-dark" },
          // Emits CSS variables for both themes instead of baking one in, so
          // the block follows the page theme without a second render.
          defaultColor: false,
        }),
      };
    }),
  );

  return <CodeTabs files={files} />;
}

async function readSource(relativePath: string): Promise<string> {
  try {
    // turbopackIgnore keeps the bundler from tracing the entire project into
    // the serverless output. It is safe here because this only ever runs at
    // build time: every pattern page is prerendered by `generateStaticParams`,
    // and `dynamicParams = false` means an unknown slug 404s without
    // rendering. No request path reaches this read.
    return await readFile(
      join(/* turbopackIgnore: true */ process.cwd(), relativePath),
      "utf8",
    );
  } catch {
    // A registry entry pointing at a moved file should not fail the build --
    // it should be obvious on the page instead.
    return `// Source not found: ${relativePath}`;
  }
}

function languageFor(path: string): string {
  if (path.endsWith(".tsx")) return "tsx";
  if (path.endsWith(".ts")) return "ts";
  if (path.endsWith(".css")) return "css";
  return "text";
}
