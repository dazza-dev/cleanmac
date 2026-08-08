import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, utimes } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { evaluateRule } from '../../src/main/rules/engine'
import { InlineScanner } from '../../src/main/scanner/inline-scanner'
import { updaterResidue } from '../../src/main/modules/updater-residue'
import type { CleanupRule } from '../../src/main/rules/types'

/**
 * Per-rule test against a real directory tree.
 *
 * The important half is the negative assertion: what the rule leaves alone. A
 * test that only checks the matches would pass just as happily for a rule that
 * deletes the entire cache directory.
 */

const CACHES = path.join(homedir(), 'Library', 'Caches')
const DAY = 24 * 60 * 60 * 1000

let sandbox: string
let rule: CleanupRule

async function makeDir(name: string, sizeBytes: number, ageDays: number): Promise<string> {
  const dir = path.join(sandbox, name)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'payload.bin'), Buffer.alloc(sizeBytes))

  const when = new Date(Date.now() - ageDays * DAY)
  await utimes(dir, when, when)
  return dir
}

beforeAll(async () => {
  sandbox = await mkdtemp(path.join(CACHES, 'clean-mac-rule-'))

  // Should match: spent update payloads, old enough to be safe.
  await makeDir('com.example.app.ShipIt', 3 * 1024 * 1024, 40)
  await makeDir('example-desktop-updater', 2 * 1024 * 1024, 40)

  // Should NOT match.
  await makeDir('com.example.app', 3 * 1024 * 1024, 40) // a real app cache
  await makeDir('Homebrew', 3 * 1024 * 1024, 40) // belongs to another rule
  await makeDir('GoogleUpdater', 3 * 1024 * 1024, 40) // live updater install
  await makeDir('com.recent.app.ShipIt', 3 * 1024 * 1024, 1) // too recent
  await makeDir('com.tiny.app.ShipIt', 1024, 40) // below minBytes

  // Point the rule at the sandbox instead of the real cache directory.
  rule = { ...updaterResidue, roots: [sandbox] }
})

afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

describe('updater.residue', () => {
  it('matches spent update payloads', async () => {
    const result = await evaluateRule(rule, { scanner: new InlineScanner() })
    const actionable = result.findings.filter((finding) => !finding.skipped)
    const names = actionable.map((finding) => path.basename(finding.path)).sort()

    expect(names).toEqual(['com.example.app.ShipIt', 'example-desktop-updater'])
  })

  it('leaves everything else alone', async () => {
    const result = await evaluateRule(rule, { scanner: new InlineScanner() })
    const touched = result.findings.map((finding) => path.basename(finding.path))

    // These must not appear at all — not even as a skipped row.
    expect(touched).not.toContain('com.example.app')
    expect(touched).not.toContain('Homebrew')
    expect(touched).not.toContain('GoogleUpdater')
    // Below the size floor, so it never becomes a finding.
    expect(touched).not.toContain('com.tiny.app.ShipIt')
  })

  it('reports a recently modified payload but refuses to act on it', async () => {
    const result = await evaluateRule(rule, { scanner: new InlineScanner() })
    const recent = result.findings.find(
      (finding) => path.basename(finding.path) === 'com.recent.app.ShipIt'
    )

    expect(recent).toBeDefined()
    expect(recent?.skipped?.reasonKey).toBe('guard.tooRecent')
    expect(recent?.selected).toBe(false)
  })

  it('excludes guard-blocked findings from the reclaimable total', async () => {
    const result = await evaluateRule(rule, { scanner: new InlineScanner() })
    const actionable = result.findings.filter((finding) => !finding.skipped)
    const expected = actionable.reduce(
      (sum, finding) => sum + Math.max(0, finding.bytes - finding.sharedBytes),
      0
    )

    expect(result.reclaimable).toBe(expected)
    expect(result.reclaimable).toBeGreaterThan(0)
  })

  it('preselects only because the risk is none', async () => {
    const result = await evaluateRule(rule, { scanner: new InlineScanner() })
    const actionable = result.findings.filter((finding) => !finding.skipped)

    expect(result.risk).toBe('none')
    expect(actionable.every((finding) => finding.selected)).toBe(true)
  })
})
