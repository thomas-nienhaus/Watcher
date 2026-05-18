#!/usr/bin/env node
/**
 * Generates minimal valid PNG icon files using only Node.js built-ins.
 * No external dependencies required.
 */
'use strict'

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const iconsDir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

function createSolidPNG(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type RGB
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  // Build raw image data: each row has a filter byte (0) then RGB pixels
  const rowSize = 1 + size * 3
  const raw = Buffer.allocUnsafe(size * rowSize)
  for (let y = 0; y < size; y++) {
    const rowStart = y * rowSize
    raw[rowStart] = 0 // filter type: None
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3
      raw[px]     = r
      raw[px + 1] = g
      raw[px + 2] = b
    }
  }

  const compressed = zlib.deflateSync(raw)

  function chunk(type, data) {
    const len = Buffer.allocUnsafe(4)
    len.writeUInt32BE(data.length, 0)
    const typeBytes = Buffer.from(type, 'ascii')
    const crcBuf = Buffer.concat([typeBytes, data])
    const crc = crc32(crcBuf)
    const crcOut = Buffer.allocUnsafe(4)
    crcOut.writeInt32BE(crc, 0)
    return Buffer.concat([len, typeBytes, data, crcOut])
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// CRC32 implementation
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let crc = -1
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1)
}

// BabyWatch brand colors: emerald-500 background with slightly lighter center
// Dark background: #0a0a0a = 10,10,10
// Primary emerald: #10b981 = 16,185,129

const icons = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-512-maskable.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of icons) {
  const png = createSolidPNG(size, 16, 185, 129) // emerald-500
  fs.writeFileSync(path.join(iconsDir, name), png)
  console.log(`✓ Created ${name} (${size}×${size}px, ${png.length} bytes)`)
}

console.log('\nPNG icons created in public/icons/')
