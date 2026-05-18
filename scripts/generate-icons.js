#!/usr/bin/env node
/**
 * Generates PWA icons as SVG files that can be used directly,
 * or converted to PNG with sharp/imagemagick.
 * This script creates PNG-compatible SVG icons for BabyWatch.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const iconsDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

function createSVG(size, forMaskable = false) {
  const padding = forMaskable ? Math.round(size * 0.1) : 0
  const innerSize = size - padding * 2
  const cx = size / 2
  const cy = size / 2
  const r = innerSize / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0a0a0a"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#10b981"/>
  <text x="${cx}" y="${cy + r * 0.12}" font-family="-apple-system, system-ui, sans-serif"
        font-size="${r * 0.55}" font-weight="bold" fill="white"
        text-anchor="middle" dominant-baseline="middle">👶</text>
</svg>`
}

// Write SVG files (browsers accept SVG for PWA icons)
const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-512-maskable.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size, maskable } of sizes) {
  const svgName = name.replace('.png', '.svg')
  const svgPath = path.join(iconsDir, svgName)
  fs.writeFileSync(svgPath, createSVG(size, maskable))
  console.log(`✓ Created ${svgName}`)
}

console.log('\nSVG icons created in public/icons/')
console.log('For production PNG conversion, run:')
console.log('  npx sharp-cli --input public/icons/*.svg --output public/icons/ --format png')
console.log('Or open the SVG files in any image editor and export as PNG.')
