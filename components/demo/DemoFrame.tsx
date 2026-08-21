import Link from "next/link";
import type { Pattern } from "@/lib/registry";
import { CodePeek } from "./CodePeek";
import styles from "./DemoFrame.module.css";

/**
 * The shell every pattern page shares.
 *
 * Order is deliberate: the live demo comes first, the explanation second, the
 * source third. A visitor who only interacts and leaves should still have
 * understood the pattern, and one who reads on should not have to hunt for
 * why it matters.
 */
export function DemoFrame({
  pattern,
  children,
}: {
  pattern: Pattern;
  children: React.ReactNode;
}) {
  return (
    <article className={styles.frame}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          <span aria-hidden="true">←</span> All patterns
        </Link>
        <h1 className={styles.title}>{pattern.title}</h1>
        <p className={styles.blurb}>{pattern.blurb}</p>
      </header>

      <section className={styles.stage} aria-label="Live demo">
        {children}
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Why this matters</h2>
        <p className={styles.prose}>{pattern.why}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Accessibility notes</h2>
        <ul className={styles.notes}>
          {pattern.a11y.map((note) => (
            <li key={note} className={styles.note}>
              {note}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Source</h2>
        <p className={styles.caption}>
          Read from the repository at build time, so this is the code that just
          ran.
        </p>
        <CodePeek pattern={pattern} />
      </section>
    </article>
  );
}
