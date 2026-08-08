import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * WCAG AA contrast for every colour that carries text.
 *
 * This app puts real information in muted text — why a finding was skipped, how
 * many files a directory holds, the absolute path itself.
 *
 * The background is a gradient, so there is no single colour to test against.
 * Every check uses `--bg-lightest`, the brightest point the gradient ever
 * reaches, because that is where light text is hardest to read. Passing there
 * means passing everywhere.
 */

const source = readFileSync(path.resolve('src/renderer/src/assets/styles.css'), 'utf8')

/**
 * Comments are stripped before any check that looks for the *absence* of
 * something — otherwise the comment explaining why there is no
 * `prefers-color-scheme` branch trips the assertion that there is none.
 */
const css = source.replace(/\/\*[\s\S]*?\*\//g, '')

/** Relative luminance per WCAG 2.1. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const v = value / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

/** Composites `rgba(r,g,b,a)` over an opaque background. */
function over(
  rgba: [number, number, number, number],
  bg: [number, number, number]
): [number, number, number] {
  const [r, g, b, a] = rgba
  return [
    Math.round(bg[0] + (r - bg[0]) * a),
    Math.round(bg[1] + (g - bg[1]) * a),
    Math.round(bg[2] + (b - bg[2]) * a)
  ]
}

function readVar(name: string): [number, number, number, number] {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match?.[1]) throw new Error(`--${name} not found`)

  const value = match[1].trim()
  const rgba = value.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)/
  )
  if (rgba) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] ? Number(rgba[4]) : 1]
  }

  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex?.[1]) {
    const n = Number.parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }

  throw new Error(`--${name} is not a colour this test understands: ${value}`)
}

function rgb(name: string): [number, number, number] {
  const [r, g, b] = readVar(name)
  return [r, g, b]
}

const WORST_CASE_BG = rgb('bg-lightest')
const AA_NORMAL = 4.5

describe('text contrast against the brightest point of the gradient', () => {
  for (const name of ['label', 'label-secondary', 'label-tertiary']) {
    it(`--${name}`, () => {
      const ratio = contrast(over(readVar(name), WORST_CASE_BG), WORST_CASE_BG)
      expect(ratio, `${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }

  it('white on the primary button', () => {
    // The main call to action is white on fuchsia; if that fails, the most
    // important control in the app is the least readable.
    const ratio = contrast([255, 255, 255], rgb('accent'))
    expect(ratio, `white on accent is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
  })

  it('the accent is never asked to work as text', () => {
    /*
     * Fuchsia on violet measures under 2:1. That is not a threshold to argue
     * down — it is a reason the accent is only ever a fill (buttons, the ring
     * arc, legend swatches) and never a text colour. This asserts the fact so
     * nobody re-introduces it.
     */
    const asText = contrast(rgb('accent-bright'), WORST_CASE_BG)
    expect(asText).toBeLessThan(3)

    const styles = readFileSync(
      path.resolve('src/renderer/src/views/Overview.vue'),
      'utf8'
    )
    expect(styles).not.toMatch(/color:\s*var\(--accent/)
  })
})

describe('single theme', () => {
  it('has no light/dark branch', () => {
    // One palette, on purpose. Two would be two things to keep legible.
    expect(css).not.toContain('prefers-color-scheme')
  })

  it('does not depend on the system accent colour', () => {
    // The accent is part of the brand now, not a system preference.
    expect(css).toMatch(/--accent:\s*#[0-9a-f]{6}/i)
  })
})

describe('motion', () => {
  it('honours prefers-reduced-motion', () => {
    expect(css).toContain('prefers-reduced-motion')
  })
})

describe('focus', () => {
  it('draws a visible focus ring for keyboard users', () => {
    // Without this the app is unusable by keyboard: focus moves, but nothing
    // on screen says where it is.
    expect(css).toContain(':focus-visible')
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:/)
  })
})
