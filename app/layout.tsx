import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { ThemeToggle, themeScript } from "@/components/site/ThemeToggle";
import "./globals.css";
import styles from "./layout.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Interface Patterns",
    template: "%s — AI Interface Patterns",
  },
  description:
    "A working gallery of AI interface patterns: streaming, structured output, agent progress, and the error states that make them survivable.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="skipLink">
          Skip to content
        </a>

        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand} aria-label="AI Interface Patterns, home">
              <Logo />
            </Link>
            <nav className={styles.nav}>
              <Link href="/foundations" className={styles.navLink}>
                Foundations
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>

        <main id="main" className={styles.main}>
          {children}
        </main>

        <footer className={styles.footer}>
          <p>
            Built with Next.js and the Gemini API. Streaming, parsing, and
            state are hand-rolled — no AI SDK.
          </p>
        </footer>
      </body>
    </html>
  );
}
