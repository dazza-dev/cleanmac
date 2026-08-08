import { describe, it, expect, afterAll } from 'vitest'
import { runScan, getFindings, getSummary, disposeScanner } from '../src/main/scan'
import { allRules } from '../src/main/modules'

/**
 * Exercises the orchestrator against this machine's real filesystem.
 *
 * The property under test is the one the security model rests on: the renderer
 * only ever sends finding ids back, so an id that was never produced by a scan
 * must resolve to nothing at all.
 */

afterAll(async () => {
  await disposeScanner()
})

describe('scan session', () => {
  it('produces a result for every rule and caches findings by id', async () => {
    // No window: progress events are simply not emitted.
    const summary = await runScan(null)

    expect(summary.results).toHaveLength(allRules.length)
    expect(summary.durationMs).toBeGreaterThanOrEqual(0)
    expect(getSummary()).toEqual(summary)

    const ids = summary.results.flatMap((result) => result.findings.map((f) => f.id))
    expect(getFindings(ids)).toHaveLength(ids.length)
  })

  it('resolves nothing for ids the scan never produced', async () => {
    await runScan(null)

    // This is what stops a compromised renderer from naming an arbitrary path.
    expect(getFindings(['made.up::/etc/passwd'])).toEqual([])
    expect(getFindings(['updater.residue::/System'])).toEqual([])
  })

  it('never counts shared blocks or guard-blocked findings as reclaimable', async () => {
    const summary = await runScan(null)

    for (const result of summary.results) {
      const expected = result.findings
        .filter((finding) => !finding.skipped && finding.action !== 'inspect')
        .reduce((sum, f) => sum + Math.max(0, f.bytes - f.sharedBytes), 0)

      expect(result.reclaimable).toBe(expected)
    }

    expect(summary.totalReclaimable).toBe(
      summary.results.reduce((sum, result) => sum + result.reclaimable, 0)
    )
  })

  it('only preselects findings that are risk-free and unblocked', async () => {
    const summary = await runScan(null)

    for (const finding of summary.results.flatMap((r) => r.findings)) {
      if (!finding.selected) continue
      expect(finding.skipped).toBeUndefined()
      expect(['none', 'low']).toContain(finding.risk)
      expect(finding.action).not.toBe('inspect')
    }
  })
})
