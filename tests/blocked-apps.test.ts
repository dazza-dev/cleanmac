import { describe, it, expect } from 'vitest'
import { collectBlockedApps } from '../src/main/scan'
import type { Finding, RuleResult } from '../src/shared/types'

/**
 * Deterministic coverage for the grouping that powers "Quit Trae to reclaim
 * 1.07 GB". The live behaviour depends on what happens to be open, so the logic
 * is exercised against fixtures instead.
 */

function finding(overrides: Partial<Finding>): Finding {
  return {
    id: overrides.path ?? 'id',
    ruleId: 'updater.residue',
    moduleId: 'updater-residue',
    path: '/tmp/x',
    displayPath: '~/x',
    bytes: 0,
    logicalBytes: 0,
    sharedBytes: 0,
    files: 1,
    mtimeMs: 0,
    risk: 'none',
    action: 'trash',
    regenerates: false,
    selected: false,
    unreadable: 0,
    ...overrides
  }
}

function result(findings: Finding[]): RuleResult {
  return {
    ruleId: 'updater.residue',
    moduleId: 'updater-residue',
    titleKey: 'rules.updaterResidue.title',
    explainKey: 'rules.updaterResidue.explain',
    risk: 'none',
    action: 'trash',
    regenerates: false,
    findings,
    reclaimable: 0
  }
}

describe('collectBlockedApps', () => {
  it('groups findings by the app holding them and sums the bytes', () => {
    const apps = collectBlockedApps([
      result([
        finding({
          id: 'a',
          bytes: 1_000_000,
          skipped: { reasonKey: 'guard.appRunningNamed', detail: 'Trae' }
        }),
        finding({
          id: 'b',
          bytes: 300_000,
          skipped: { reasonKey: 'guard.appRunningNamed', detail: 'Zoho Mail' }
        }),
        finding({
          id: 'c',
          bytes: 200_000,
          skipped: { reasonKey: 'guard.appRunningNamed', detail: 'Zoho Mail' }
        })
      ])
    ])

    expect(apps).toHaveLength(2)
    expect(apps[0]).toEqual({ name: 'Trae', findingIds: ['a'], bytes: 1_000_000 })
    expect(apps[1]).toEqual({ name: 'Zoho Mail', findingIds: ['b', 'c'], bytes: 500_000 })
  })

  it('orders by reclaimable size so the biggest win is offered first', () => {
    const apps = collectBlockedApps([
      result([
        finding({
          id: 'small',
          bytes: 10,
          skipped: { reasonKey: 'guard.appRunningNamed', detail: 'Small' }
        }),
        finding({
          id: 'big',
          bytes: 10_000,
          skipped: { reasonKey: 'guard.appRunningNamed', detail: 'Big' }
        })
      ])
    ])

    expect(apps.map((app) => app.name)).toEqual(['Big', 'Small'])
  })

  it('ignores findings blocked for reasons quitting an app would not fix', () => {
    const apps = collectBlockedApps([
      result([
        finding({ id: 'a', bytes: 999, skipped: { reasonKey: 'guard.tooRecent', detail: '2' } }),
        finding({ id: 'b', bytes: 999, skipped: { reasonKey: 'guard.notWritable' } }),
        finding({ id: 'c', bytes: 999, skipped: { reasonKey: 'guard.dockerNotRunning' } })
      ])
    ])

    expect(apps).toEqual([])
  })

  it('skips an unnamed owner rather than telling the user to quit nothing', () => {
    const apps = collectBlockedApps([
      result([
        finding({ id: 'a', bytes: 999, skipped: { reasonKey: 'guard.appRunning' } }),
        finding({
          id: 'b',
          bytes: 999,
          skipped: { reasonKey: 'guard.appRunningNamed', detail: '' }
        })
      ])
    ])

    expect(apps).toEqual([])
  })

  it('never counts shared blocks, which quitting would not free either', () => {
    const apps = collectBlockedApps([
      result([
        finding({
          id: 'a',
          bytes: 1_000,
          sharedBytes: 400,
          skipped: { reasonKey: 'guard.appRunningNamed', detail: 'Trae' }
        })
      ])
    ])

    expect(apps[0]?.bytes).toBe(600)
  })
})
