/**
 * The mark, defined once.
 *
 * It is the site's subject drawn literally: a completed line of text, a second
 * line still arriving, and the stream caret at its tail -- taller than the
 * text and narrow enough to read as a cursor rather than a block.
 *
 * Geometry lives here rather than in each asset because the same shape has to
 * appear in the favicon, the touch icon, and the React header logo. Duplicating
 * four rectangles across three files is exactly the kind of thing that drifts.
 *
 * Colours are hex rather than the oklch() tokens they mirror: favicon
 * rasterisers and mail clients are not reliably modern CSS engines.
 */

export const BRAND = {
  /** Matches --accent-9 in the dark and light ramps respectively. */
  gradientFrom: "#6c70ff",
  gradientTo: "#5856ec",
  ink: "#ffffff",
  /** Drawn on a 32x32 grid. */
  viewBox: 32,
  cornerRadius: 7.5,
} as const;

export interface MarkRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  opacity: number;
}

/** The completed line, the truncated line, and the caret, in paint order. */
export const MARK_RECTS: MarkRect[] = [
  { x: 6.5, y: 9, width: 18.5, height: 3.4, rx: 1.7, opacity: 0.9 },
  { x: 6.5, y: 17.3, width: 7.5, height: 3.4, rx: 1.7, opacity: 0.9 },
  { x: 17, y: 14.4, width: 3.2, height: 9.2, rx: 1.6, opacity: 1 },
];

/**
 * Serialise the mark as a standalone SVG document.
 *
 * `rounded` controls the badge corners. The touch icon wants a full-bleed
 * square because iOS applies its own mask -- supplying rounded corners as
 * well produces a visibly double-rounded icon.
 */
export function markSvg({
  size = 32,
  rounded = true,
}: { size?: number; rounded?: boolean } = {}): string {
  const box = BRAND.viewBox;
  const radius = rounded ? BRAND.cornerRadius : 0;

  const rects = MARK_RECTS.map(
    (r) =>
      `  <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.rx}" fill="${BRAND.ink}" fill-opacity="${r.opacity}"/>`,
  ).join("\n");

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${box} ${box}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mark" x1="0" y1="0" x2="${box}" y2="${box}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${BRAND.gradientFrom}"/>
      <stop offset="1" stop-color="${BRAND.gradientTo}"/>
    </linearGradient>
  </defs>
  <rect width="${box}" height="${box}" rx="${radius}" fill="url(#mark)"/>
${rects}
</svg>
`;
}
