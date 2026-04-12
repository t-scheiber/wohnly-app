#!/usr/bin/env node
/**
 * Generate Tauri icon set from the mobile app icon.
 * Usage: node apps/desktop/generate-icons.mjs
 * Requires: npm install --save-dev sharp png-to-ico
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(__dirname, '../mobile/assets/images/icon.png');
const OUT = resolve(__dirname, 'tauri/icons');

mkdirSync(OUT, { recursive: true });

const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
];

// MSIX package icon sizes (placed in msix/assets/)
const MSIX_OUT = resolve(__dirname, 'msix/assets');
mkdirSync(MSIX_OUT, { recursive: true });

const msixSizes = [
  { name: 'StoreLogo.png', size: 50 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square150x150Logo.png', size: 150 },
];

for (const { name, size } of msixSizes) {
  await sharp(SOURCE).resize(size, size).png().toFile(resolve(MSIX_OUT, name));
  console.log(`Generated msix/assets/${name}`);
}

// Wide310x150Logo: 310x150 with the icon centered on transparent background
const wideWidth = 310;
const wideHeight = 150;
const iconSize = 140; // slightly smaller than height for padding
const iconBuf = await sharp(SOURCE).resize(iconSize, iconSize).png().toBuffer();
await sharp({
  create: { width: wideWidth, height: wideHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
  .composite([{ input: iconBuf, left: Math.round((wideWidth - iconSize) / 2), top: Math.round((wideHeight - iconSize) / 2) }])
  .png()
  .toFile(resolve(MSIX_OUT, 'Wide310x150Logo.png'));
console.log('Generated msix/assets/Wide310x150Logo.png');

for (const { name, size } of sizes) {
  await sharp(SOURCE).resize(size, size).png().toFile(resolve(OUT, name));
  console.log(`Generated ${name}`);
}

// Generate .ico (256, 128, 64, 48, 32, 16)
const icoSizes = [256, 128, 64, 48, 32, 16];
const icoBuffers = await Promise.all(
  icoSizes.map((s) => sharp(SOURCE).resize(s, s).png().toBuffer())
);

// Simple ICO format writer
function createIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = pngBuffers.map((buf, i) => {
    const size = icoSizes[i] >= 256 ? 0 : icoSizes[i];
    const entry = { size, buf, offset };
    offset += buf.length;
    return entry;
  });

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(count, 4);

  entries.forEach((e, i) => {
    const pos = 6 + i * 16;
    header.writeUInt8(e.size, pos);       // width
    header.writeUInt8(e.size, pos + 1);   // height
    header.writeUInt8(0, pos + 2);        // color palette
    header.writeUInt8(0, pos + 3);        // reserved
    header.writeUInt16LE(1, pos + 4);     // color planes
    header.writeUInt16LE(32, pos + 6);    // bits per pixel
    header.writeUInt32LE(e.buf.length, pos + 8);  // size
    header.writeUInt32LE(e.offset, pos + 12);     // offset
  });

  return Buffer.concat([header, ...pngBuffers.map((b) => b)]);
}

writeFileSync(resolve(OUT, 'icon.ico'), createIco(icoBuffers));
console.log('Generated icon.ico');

// Generate .icns (512x512 + 1024x1024 PNGs in icns container)
const png512 = await sharp(SOURCE).resize(512, 512).png().toBuffer();
const png1024 = await sharp(SOURCE).resize(1024, 1024).png().toBuffer();
const icnsType = Buffer.from('icns');
const ic09 = Buffer.from('ic09'); // 512x512 PNG
const ic09Size = Buffer.alloc(4);
ic09Size.writeUInt32BE(png512.length + 8);
const ic10 = Buffer.from('ic10'); // 512x512@2x (1024x1024) PNG
const ic10Size = Buffer.alloc(4);
ic10Size.writeUInt32BE(png1024.length + 8);
const totalSize = Buffer.alloc(4);
totalSize.writeUInt32BE(8 + (png512.length + 8) + (png1024.length + 8));
const icnsData = Buffer.concat([icnsType, totalSize, ic09, ic09Size, png512, ic10, ic10Size, png1024]);
writeFileSync(resolve(OUT, 'icon.icns'), icnsData);
console.log('Generated icon.icns (512x512 + 1024x1024)');

console.log('All Tauri icons generated.');
