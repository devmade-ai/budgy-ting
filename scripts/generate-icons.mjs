/**
 * Generate PWA icon PNGs from icon.svg using sharp.
 *
 * Requirement: CI and local icon generation from single SVG source
 * Approach: sharp for SVG→PNG rasterisation, manual ICO packing
 * Alternatives:
 *   - Python script (generate-icons.py): Rejected for CI — needs Python + manual pixel drawing
 *   - Canvas-based: Rejected — heavier dependency, no benefit over sharp
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')
const svgPath = resolve(publicDir, 'icon.svg')

const svg = readFileSync(svgPath)

// 400 DPI: ~5.5x the default 72 DPI. Sharp rasterizes the SVG at this density
// before downscaling, so edges are anti-aliased from high-res source data.
// The 192px PWA icon benefits most — arc and B-glyph edges are noticeably crisper.
const SVG_DENSITY = 400

const sizes = [
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-48x48.png', size: 48 },
]

for (const { name, size } of sizes) {
  await sharp(svg, { density: SVG_DENSITY })
    .resize(size, size)
    .png()
    .toFile(resolve(publicDir, name))
  console.log(`Generated ${name} (${size}x${size})`)
}

// Maskable icon — 1024x1024 with safe-zone padding
// Requirement: Separate maskable icon for Android adaptive-icon cropping
// Approach: Remove rounded corners (OS applies its own mask), scale B glyph to
//   80% safe zone so content survives any mask shape (circle, squircle, etc.)
// Alternatives:
//   - Reuse same image for maskable: Rejected — rounded corners create visible
//     artifacts when OS applies its own mask shape on top
//   - Separate hand-crafted SVG: Rejected — drift risk, single source preferred
const svgString = svg.toString('utf8')
const maskableSvg = Buffer.from(
  svgString
    .replace('<svg ', '<svg shape-rendering="geometricPrecision" ')
    .replace(/ rx="92"/, '')
    .replace('<path ', '<g transform="translate(51.2 51.2) scale(0.8)"><path ')
    .replace('</svg>', '</g></svg>')
)

await sharp(maskableSvg, { density: SVG_DENSITY })
  .resize(1024, 1024)
  .png()
  .toFile(resolve(publicDir, 'pwa-maskable-1024x1024.png'))
console.log('Generated pwa-maskable-1024x1024.png (1024x1024, maskable)')

// Favicon — 32x32 PNG wrapped in ICO container
const favicon32 = await sharp(svg, { density: SVG_DENSITY })
  .resize(32, 32)
  .png()
  .toBuffer()

const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0)  // reserved
icoHeader.writeUInt16LE(1, 2)  // type: icon
icoHeader.writeUInt16LE(1, 4)  // count: 1

const icoEntry = Buffer.alloc(16)
icoEntry.writeUInt8(32, 0)     // width
icoEntry.writeUInt8(32, 1)     // height
icoEntry.writeUInt8(0, 2)      // colours (0 = no palette)
icoEntry.writeUInt8(0, 3)      // reserved
icoEntry.writeUInt16LE(1, 4)   // planes
icoEntry.writeUInt16LE(32, 6)  // bits per pixel
icoEntry.writeUInt32LE(favicon32.length, 8)  // size of PNG data
icoEntry.writeUInt32LE(22, 12) // offset (6 header + 16 entry)

writeFileSync(
  resolve(publicDir, 'favicon.ico'),
  Buffer.concat([icoHeader, icoEntry, favicon32]),
)
console.log('Generated favicon.ico (32x32)')
