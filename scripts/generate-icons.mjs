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

const sizes = [
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  await sharp(svg, { density: 150 })
    .resize(size, size)
    .png()
    .toFile(resolve(publicDir, name))
  console.log(`Generated ${name} (${size}x${size})`)
}

// Favicon — 32x32 PNG wrapped in ICO container
const favicon32 = await sharp(svg, { density: 150 })
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
