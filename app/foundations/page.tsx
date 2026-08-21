import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Foundations",
  description:
    "The token layer behind the pattern library: colour, type, space, motion, and the AI-specific semantics a general design system has no vocabulary for.",
};

const GRAY = Array.from({ length: 12 }, (_, i) => `--gray-${i + 1}`);
const ACCENT = Array.from({ length: 12 }, (_, i) => `--accent-${i + 1}`);

const SEMANTIC = [
  ["--bg-canvas", "Page background"],
  ["--bg-subtle", "Recessed panels"],
  ["--bg-raised", "Cards and bubbles"],
  ["--fg-default", "Body text"],
  ["--fg-muted", "Secondary text"],
  ["--fg-subtle", "Metadata"],
  ["--border-subtle", "Dividers"],
  ["--accent-solid", "Primary action"],
];

const AI_TOKENS = [
  ["--stream-cursor", "The caret pinned to the tail of streaming text."],
  ["--surface-thinking", "The model is reasoning; no output has arrived yet."],
  ["--surface-tool", "Tool and function call cards in an agent timeline."],
  [
    "--surface-optimistic",
    "Applied locally, not yet confirmed by the server.",
  ],
  ["--surface-recorded", "A replayed fixture rather than a live call."],
  ["--fg-latency-good", "Time to first token under 300ms."],
  ["--fg-latency-warn", "Under 800ms."],
  ["--fg-latency-bad", "Slower than 800ms."],
  ["--step-active", "The agent step currently running."],
  ["--step-done", "A completed step."],
];

const TYPE = [
  ["--text-9", "3rem"],
  ["--text-8", "2.25rem"],
  ["--text-7", "1.75rem"],
  ["--text-6", "1.375rem"],
  ["--text-5", "1.125rem"],
  ["--text-4", "1rem"],
  ["--text-3", "0.875rem"],
  ["--text-2", "0.8125rem"],
  ["--text-1", "0.75rem"],
];

const SPACE = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const MOTION = [
  ["--duration-instant", "80ms", "State flips that should feel immediate"],
  ["--duration-fast", "140ms", "Hover and focus"],
  ["--duration-normal", "220ms", "Most transitions"],
  ["--duration-slow", "380ms", "Entrances"],
  ["--motion-stream-reveal", "260ms", "Per-token fade"],
  ["--motion-cursor-blink", "1060ms", "Streaming caret"],
  ["--motion-shimmer", "1600ms", "Thinking and skeleton sweeps"],
];

export default function FoundationsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Foundations</h1>
        <p className={styles.lede}>
          Three tiers: raw ramps, semantic aliases, and a layer of AI-specific
          semantics. Components only ever reference the last two, which is what
          keeps a theme change to one file.
        </p>
      </header>

      <Section
        title="Colour"
        note="Ramps are authored in OKLCH so lightness steps are perceptually even and the dark palette is a genuine re-derivation rather than an inversion."
      >
        <Ramp label="Gray" tokens={GRAY} />
        <Ramp label="Accent" tokens={ACCENT} />

        <div className={styles.swatchGrid}>
          {SEMANTIC.map(([token, description]) => (
            <div key={token} className={styles.swatch}>
              <span
                className={styles.swatchChip}
                style={{ background: `var(${token})` }}
              />
              <code className={styles.token}>{token}</code>
              <span className={styles.description}>{description}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="AI semantics"
        note="A general design system has no name for 'the model is thinking' or 'this response was replayed from a recording'. Naming them is what keeps the streaming UI consistent across demos instead of being reinvented in each one."
      >
        <div className={styles.tokenList}>
          {AI_TOKENS.map(([token, description]) => (
            <div key={token} className={styles.tokenRow}>
              <span
                className={styles.tokenChip}
                style={{ background: `var(${token})` }}
              />
              <code className={styles.token}>{token}</code>
              <span className={styles.description}>{description}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Type"
        note="A tight scale, around a 1.2 ratio. Machine metadata — model ids, latency, token counts — sits at the bottom two steps and is always set in mono, which is what makes a value read as measured rather than written."
      >
        <div className={styles.typeList}>
          {TYPE.map(([token, size]) => (
            <div key={token} className={styles.typeRow}>
              <span className={styles.typeSample} style={{ fontSize: `var(${token})` }}>
                Streaming changes what the user is doing while they wait
              </span>
              <code className={styles.typeMeta}>
                {token} · {size}
              </code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Space" note="A 4px base, growing non-linearly so large gaps stay distinguishable.">
        <div className={styles.spaceList}>
          {SPACE.map((step) => (
            <div key={step} className={styles.spaceRow}>
              <code className={styles.token}>--space-{step}</code>
              <span
                className={styles.spaceBar}
                style={{ width: `var(--space-${step})` }}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Motion"
        note="Every animation in the system reads a duration token. Under prefers-reduced-motion all of them collapse to 0ms in one place, which is what makes reduced-motion support global rather than something each component has to remember."
      >
        <div className={styles.motionList}>
          {MOTION.map(([token, value, use]) => (
            <div key={token} className={styles.motionRow}>
              <code className={styles.token}>{token}</code>
              <code className={styles.motionValue}>{value}</code>
              <span className={styles.description}>{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Accessibility rules"
        note="Applied throughout rather than audited afterwards."
      >
        <ul className={styles.rules}>
          <li>
            Streaming text is announced as completed sentences through a polite
            live region, never token by token.
          </li>
          <li>
            Every state distinguished by colour is also distinguished by text —
            step status, latency grade, and replay mode all carry a label.
          </li>
          <li>
            Focus is returned deliberately when a control disappears, such as
            the stop button at the end of a stream.
          </li>
          <li>
            JavaScript-driven motion checks prefers-reduced-motion in the hook,
            because CSS duration tokens cannot reach it.
          </li>
          <li>
            One focus ring definition, applied on :focus-visible only.
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <p className={styles.sectionNote}>{note}</p>
      </div>
      {children}
    </section>
  );
}

function Ramp({ label, tokens }: { label: string; tokens: string[] }) {
  return (
    <div className={styles.ramp}>
      <span className={styles.rampLabel}>{label}</span>
      <div className={styles.rampRow}>
        {tokens.map((token, index) => (
          <div key={token} className={styles.rampStep} title={token}>
            {/* The index sits below the swatch rather than on it: no single
                text colour stays legible across a full lightness ramp. */}
            <span
              className={styles.rampChip}
              style={{ background: `var(${token})` }}
            />
            <span className={styles.rampIndex}>{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
