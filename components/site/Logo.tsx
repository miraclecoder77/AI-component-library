import { BRAND, MARK_RECTS } from "@/lib/brand";
import styles from "./Logo.module.css";

/**
 * The mark, rendered inline so it inherits sizing and never flashes in
 * separately from the header. Geometry comes from `lib/brand.ts`, the same
 * source the favicon and touch icon are generated from.
 */
export function LogoMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${BRAND.viewBox} ${BRAND.viewBox}`}
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Rendered once per page, in the header. */}
        <linearGradient
          id="logo-mark-gradient"
          x1="0"
          y1="0"
          x2={BRAND.viewBox}
          y2={BRAND.viewBox}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={BRAND.gradientFrom} />
          <stop offset="1" stopColor={BRAND.gradientTo} />
        </linearGradient>
      </defs>

      <rect
        width={BRAND.viewBox}
        height={BRAND.viewBox}
        rx={BRAND.cornerRadius}
        fill="url(#logo-mark-gradient)"
      />

      {MARK_RECTS.map((rect, index) => (
        <rect
          key={index}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={rect.rx}
          fill={BRAND.ink}
          fillOpacity={rect.opacity}
        />
      ))}
    </svg>
  );
}

/**
 * Mark plus wordmark.
 *
 * The mark is aria-hidden and the name is real text, so the link announces as
 * "AI Interface Patterns" rather than as an image with alt text bolted on.
 */
export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark />
      <span className={styles.wordmark}>AI Interface Patterns</span>
    </span>
  );
}
