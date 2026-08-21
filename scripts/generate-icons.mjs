/**
 * Generates every icon asset from the geometry in lib/brand.ts.
 *
 *   npm run icons
 *
 * Rasterising is done with the Playwright Chromium that the e2e suite already
 * installs, rather than adding an image-processing dependency for three files
 * that change roughly never.
 *
 * Outputs:
 *   app/icon.svg        favicon; Next serves this from the App Router convention
 *   app/favicon.ico     32x32, for anything that still requests /favicon.ico
 *   app/apple-icon.png  180x180 full-bleed, because iOS applies its own mask
 *   public/logo.svg     standalone copy for READMEs and social cards
 */

import { chromium } from "@playwright/test";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { markSvg } from "../lib/brand.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- vector assets -------------------------------------------------------

const roundedSvg = markSvg({ size: 32, rounded: true });
writeFileSync(join(root, "app", "icon.svg"), roundedSvg);
writeFileSync(join(root, "public", "logo.svg"), markSvg({ size: 128, rounded: true }));
console.log("wrote app/icon.svg");
console.log("wrote public/logo.svg");

// --- rasterise -----------------------------------------------------------

const browser = await chromium.launch();

async function rasterise(svg, size) {
  const context = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px">${svg}</body>`,
  );
  // omitBackground keeps the rounded corners transparent rather than white.
  const buffer = await page.screenshot({ omitBackground: true });
  await context.close();
  return buffer;
}

const scale = (svg, size) =>
  svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);

// Touch icon: square, full-bleed. iOS rounds it itself.
const applePng = await rasterise(scale(markSvg({ rounded: false }), 180), 180);
writeFileSync(join(root, "app", "apple-icon.png"), applePng);
console.log("wrote app/apple-icon.png");

const icoPng = await rasterise(scale(roundedSvg, 32), 32);
writeFileSync(join(root, "app", "favicon.ico"), toIco(icoPng, 32));
console.log("wrote app/favicon.ico");

await browser.close();

// The scaffold's placeholder, if it is still around.
const stale = join(root, "public", "favicon.ico");
if (existsSync(stale)) unlinkSync(stale);

/**
 * Wrap a PNG in an ICO container.
 *
 * ICO permits a PNG payload rather than a BMP, which every browser since IE11
 * understands -- so this is a 22-byte header plus the PNG, and needs no image
 * encoder of its own.
 */
function toIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // 0 means 256
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2); // palette size
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12); // payload offset

  return Buffer.concat([header, entry, png]);
}
