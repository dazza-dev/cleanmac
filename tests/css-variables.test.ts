import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Every `var(--x)` must resolve to something.
 *
 * This exists because of a real bug that shipped: two components asked for
 * `--panel-solid`, which was never defined anywhere. CSS does not complain about
 * that — an unresolved custom property with no fallback makes the declaration
 * invalid, so `background` simply never applies and the element renders
 * transparent.
 *
 * The two elements it hit were the floating action bar and the delete
 * confirmation dialog: the bar showed the list scrolling underneath its own
 * text, and the dialog that asks "move 8 GB to the Trash?" was see-through.
 * Neither produces a console error, a failing build, or a type error. Nothing
 * catches this except looking at it — or this test.
 */

const RENDERER = path.join(import.meta.dirname, '..', 'src', 'renderer', 'src')
const STYLES = path.join(RENDERER, 'assets', 'styles.css')

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.(vue|css)$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('CSS custom properties', () => {
  it('defines every variable that is used', () => {
    const css = readFileSync(STYLES, 'utf8')
    const defined = new Set(
      [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1])
    )

    const missing: string[] = []

    for (const file of sourceFiles(RENDERER)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/g)) {
        const name = match[1]
        // A fallback makes the declaration valid even with no definition, so
        // `var(--maybe, #fff)` is not a bug.
        const hasFallback = match[2] === ','
        if (!hasFallback && name && !defined.has(name)) {
          missing.push(`${path.basename(file)} uses ${name}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('gives the surfaces that sit over content an opaque background', () => {
    // A sticky bar or a modal that is even slightly transparent puts the text
    // behind it into the text in front. Both of these are pure hex on purpose.
    const css = readFileSync(STYLES, 'utf8')
    for (const name of ['--surface-solid']) {
      const value = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1]?.trim()
      expect(value, `${name} should be defined`).toBeDefined()
      expect(value, `${name} must be opaque, got ${value}`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
