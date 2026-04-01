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

// Generate .icns (simplified — just embed 512x512 PNG in icns container)
const png512 = await sharp(SOURCE).resize(512, 512).png().toBuffer();
const icnsType = Buffer.from('icns');
const ic09 = Buffer.from('ic09'); // 512x512 PNG
const entrySize = Buffer.alloc(4);
entrySize.writeUInt32BE(png512.length + 8);
const totalSize = Buffer.alloc(4);
totalSize.writeUInt32BE(png512.length + 8 + 8);
const icnsData = Buffer.concat([icnsType, totalSize, ic09, entrySize, png512]);
writeFileSync(resolve(OUT, 'icon.icns'), icnsData);
console.log('Generated icon.icns');

console.log('All Tauri icons generated.');
