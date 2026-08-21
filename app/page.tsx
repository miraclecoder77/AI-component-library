import Link from "next/link";
import { PATTERNS, PLANNED } from "@/lib/registry";
import styles from "./page.module.css";

export default function GalleryPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Interface patterns for AI products, built properly.
        </h1>
        <p className={styles.lede}>
          Every pattern here is live, runs against a real model, and shows the
          source that produced it. The interesting parts are the ones usually
          skipped: what happens before the first token, what a stop button has
          to actually do, and how any of it behaves for a screen reader.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="patterns-heading">
        <h2 id="patterns-heading" className={styles.sectionHeading}>
          Patterns
        </h2>

        <ul className={styles.grid}>
          {PATTERNS.map((pattern) => (
            <li key={pattern.slug}>
              <Link href={`/patterns/${pattern.slug}`} className={styles.card}>
                <h3 className={styles.cardTitle}>{pattern.title}</h3>
                <p className={styles.cardBlurb}>{pattern.blurb}</p>
                <span className={styles.cardLink} aria-hidden="true">
                  Open demo →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="planned-heading">
        <h2 id="planned-heading" className={styles.sectionHeading}>
          Next
        </h2>

        <ul className={styles.plannedList}>
          {PLANNED.map((item) => (
            <li key={item.title} className={styles.planned}>
              <span className={styles.plannedTitle}>{item.title}</span>
              <span className={styles.plannedBlurb}>{item.blurb}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
