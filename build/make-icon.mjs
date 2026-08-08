#!/usr/bin/env node
/**
 * Generates the application icon.
 *
 * Kept as a script rather than a committed binary so the icon is reviewable:
 * a `.icns` in a pull request is an opaque blob, this is a diff. Run with
 * `node build/make-icon.mjs`; needs only Node and macOS `iconutil`.
 *
 * The mark is the disk ring from the app's own overview, open at the top.
 * It has to survive being drawn at 16px in the menu bar, so it carries exactly
 * one idea and no detail: a first version shaded a "detaching" segment at 75%
 * alpha, which was invisible at every size that matters and was removed.
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const OUT = path.join(import.meta.dirname, 'icon.iconset')

/* ---------------------------------------------------------------- PNG ---- */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Encodes RGBA pixels as a PNG. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // truecolour with alpha
  header[12] = 0

  // Each scanline is prefixed with its filter type; 0 means none.
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* ------------------------------------------------------------ drawing ---- */

const SS = 4 // supersampling factor, for antialiasing without a canvas

/** macOS icons are a squircle, not a rounded rectangle: |x|^n + |y|^n = r^n. */
function insideSquircle(x, y, half, n = 5) {
  return Math.abs(x / half) ** n + Math.abs(y / half) ** n <= 1
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ]
}

/** Ring geometry, in fractions of the icon size. */
const RING_OUTER = 0.3
const RING_INNER = 0.215
/** The opening, in radians, measured clockwise from 12 o'clock. */
const GAP_START = -0.30
const GAP_END = 0.30

// Matches the app's own gradient: fuchsia accent falling into deep indigo.
const TOP = [0xd6, 0x3a, 0xe8]
const BOTTOM = [0x3d, 0x0b, 0x76]

function render(size) {
  const dim = size * SS
  const pixels = Buffer.alloc(dim * dim * 4)

  const half = dim / 2
  // Content is inset the way Apple's own icons are, so it sits correctly
  // beside them in the Dock.
  const plateHalf = half * 0.88
  const cx = half
  const cy = half

  for (let y = 0; y < dim; y += 1) {
    for (let x = 0; x < dim; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const index = (y * dim + x) * 4

      if (!insideSquircle(dx, dy, plateHalf)) continue

      const [r, g, b] = mix(TOP, BOTTOM, y / dim)
      pixels[index] = r
      pixels[index + 1] = g
      pixels[index + 2] = b
      pixels[index + 3] = 255

      const distance = Math.hypot(dx, dy) / dim
      if (distance > RING_OUTER || distance < RING_INNER) continue

      // atan2 measured from 12 o'clock, clockwise, in [-PI, PI].
      const angle = Math.atan2(dx, -dy)
      if (angle > GAP_START && angle < GAP_END) continue

      pixels[index] = 255
      pixels[index + 1] = 255
      pixels[index + 2] = 255
      pixels[index + 3] = 255
    }
  }

  // Downsample the supersampled buffer, averaging in premultiplied space so
  // edges against the transparent background stay clean.
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const i = ((y * SS + sy) * dim + (x * SS + sx)) * 4
          const alpha = pixels[i + 3] / 255
          r += pixels[i] * alpha
          g += pixels[i + 1] * alpha
          b += pixels[i + 2] * alpha
          a += pixels[i + 3]
        }
      }

      // r/g/b accumulated premultiplied, so dividing by the summed alpha
      // *fraction* — not the sample count — is what recovers the colour.
      const samples = SS * SS
      const alphaSum = a / 255
      const scale = alphaSum > 0 ? 1 / alphaSum : 0
      const o = (y * size + x) * 4
      out[o] = Math.min(255, Math.round(r * scale))
      out[o + 1] = Math.min(255, Math.round(g * scale))
      out[o + 2] = Math.min(255, Math.round(b * scale))
      out[o + 3] = Math.round(a / samples)
    }
  }

  return encodePng(size, size, out)
}

/* --------------------------------------------------------------- main ---- */

// The set `iconutil` expects. Retina variants are the same pixels at 2×.
const VARIANTS = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png']
]

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

for (const [size, name] of VARIANTS) {
  writeFileSync(path.join(OUT, name), render(size))
  process.stdout.write(`  ${name}\n`)
}

const icns = path.join(import.meta.dirname, 'icon.icns')
execFileSync('iconutil', ['-c', 'icns', OUT, '-o', icns])

// electron-builder also wants a plain PNG for non-DMG targets.
writeFileSync(path.join(import.meta.dirname, 'icon.png'), render(512))

rmSync(OUT, { recursive: true, force: true })
console.log(`\nWrote ${icns}`)
