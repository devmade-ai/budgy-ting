/**
 * Generate PWA icon PNGs from icon.svg using sharp.
 *
 * Requirement: CI and local icon generation from single SVG source
 * Approach: sharp for SVG→PNG rasterisation at 400 DPI, manual ICO packing.
 *   400 DPI (~5.5x default 72 DPI) renders the SVG at high resolution before
 *   downscaling, producing clean anti-aliased edges especially on the 192px icon.
 * Alternatives:
 *   - Python script (generate-icons.py): Rejected for CI — needs Python + manual pixel drawing
 *   - Canvas-based: Rejected — heavier dependency, no benefit over sharp
 *   - 150 DPI: Previous setting — produced slightly fuzzy edges on smaller icons
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')
const svgPath = resolve(publicDir, 'icon.svg')
const maskableSvgPath = resolve(publicDir, 'icon-maskable.svg')

const svg = readFileSync(svgPath)
const maskableSvg = readFileSync(maskableSvgPath)

// Standard icons — from icon.svg (full-bleed, purpose: any)
const sizes = [
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  await sharp(svg, { density: 400 })
    .resize(size, size)
    .png()
    .toFile(resolve(publicDir, name))
  console.log(`Generated ${name} (${size}x${size})`)
}

// Maskable icon — from icon-maskable.svg (content within 80% safe zone, purpose: maskable)
// Requirement: Android adaptive icons crop to various shapes. Content must be
//   within the inner 80% safe zone to avoid clipping.
// Approach: Separate SVG source with padded content, rendered at 1024px for
//   maximum quality on high-density displays.
await sharp(maskableSvg, { density: 400 })
  .resize(1024, 1024)
  .png()
  .toFile(resolve(publicDir, 'pwa-maskable-1024x1024.png'))
console.log('Generated pwa-maskable-1024x1024.png (1024x1024)')

// Favicon — 32x32 PNG wrapped in ICO container
const favicon32 = await sharp(svg, { density: 400 })
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
