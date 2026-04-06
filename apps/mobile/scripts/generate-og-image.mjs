/**
 * Generates an OG image (1200x630) for social sharing.
 * Uses sharp to composite the app icon onto a branded background.
 */
import sharp from "sharp";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconPath = resolve(__dirname, "../assets/images/icon.png");
const outPath = resolve(__dirname, "../public/og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;
const ICON_SIZE = 180;
const BG_COLOR = "#6db5a8";

const icon = await sharp(iconPath)
  .resize(ICON_SIZE, ICON_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

// Create SVG overlay with text
const textSvg = `<svg width="${WIDTH}" height="${HEIGHT}">
  <style>
    .title { fill: white; font-family: sans-serif; font-size: 64px; font-weight: 800; }
    .subtitle { fill: rgba(255,255,255,0.9); font-family: sans-serif; font-size: 28px; font-weight: 400; }
  </style>
  <text x="${WIDTH / 2}" y="${HEIGHT / 2 + 40}" text-anchor="middle" class="title">Wohnly</text>
  <text x="${WIDTH / 2}" y="${HEIGHT / 2 + 85}" text-anchor="middle" class="subtitle">Household Management for Roommates &amp; Families</text>
</svg>`;

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: BG_COLOR,
  },
})
  .composite([
    { input: icon, top: Math.round(HEIGHT / 2 - ICON_SIZE - 30), left: Math.round((WIDTH - ICON_SIZE) / 2) },
    { input: Buffer.from(textSvg), top: 0, left: 0 },
  ])
  .png()
  .toFile(outPath);

console.log(`Generated OG image at ${outPath}`);
