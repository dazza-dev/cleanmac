import { describe, it, expect } from 'vitest'
import { allRules } from '../../src/main/modules'
import {
  ALLOWED_ROOTS,
  FORBIDDEN_PREFIXES,
  expandHome
} from '../../src/main/rules/safe-path'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Inspect-only rules exist so the app can say "WhatsApp is holding 14 GB" and
 * "these are your iPhone backups" without ever offering a delete button. That
 * promise has to be structural, not a matter of the UI happening to hide a
 * checkbox.
 */

describe('inspect-only rules', () => {
  const inspectRules = allRules.filter((rule) => rule.action === 'inspect')

  it('exist — the catalogue reports on data it will not touch', () => {
    expect(inspectRules.length).toBeGreaterThan(0)
  })

  it('never carry a command that could act on them', () => {
    for (const rule of inspectRules) {
      expect(rule.command).toBeUndefined()
    }
  })

  it('cover the irreplaceable categories', () => {
    const ids = inspectRules.map((rule) => rule.id)
    expect(ids).toContain('system.ios-backups')
    expect(ids).toContain('system.xcode-archives')
  })

  it('are the only home for high-risk rules', () => {
    // Anything touching user data must be inspect-only. A "high" risk rule with
    // a trash action would be a delete button on someone's photo library.
    for (const rule of allRules) {
      if (rule.risk === 'high') expect(rule.action).toBe('inspect')
    }
  })

  it('are refused by the executor before any filesystem call', async () => {
    const source = await readFile(
      path.resolve('src/main/executor/index.ts'),
      'utf8'
    )

    const guardIndex = source.indexOf("finding.action === 'inspect'")
    const trashIndex = source.indexOf('await trashOne(finding)')

    expect(guardIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(trashIndex)
  })
})

describe('rule catalogue invariants', () => {
  it('gives every rule a translated title and explanation', () => {
    for (const rule of allRules) {
      expect(rule.titleKey).toMatch(/^rules\./)
      expect(rule.explainKey).toMatch(/^rules\./)
    }
  })

  it('requires a command spec whenever the action is command', () => {
    for (const rule of allRules) {
      if (rule.action === 'command') expect(rule.command).toBeDefined()
    }
  })

  /**
   * The invariant that stops a rule author pointing a delete rule at
   * ~/Documents. Checked against the rule declarations themselves, so a bad
   * rule fails here rather than at the moment it would remove someone's files.
   */
  it('confines every root-walking trash rule to an allowed root', () => {
    for (const rule of allRules) {
      if (rule.action !== 'trash') continue

      // Provider rules name their own paths rather than walking a root, so
      // there is nothing to check statically. Every path they produce still
      // passes `assertSafeToTrash` immediately before deletion, which is what
      // `tests/safety/leaf-names.test.ts` covers.
      if (rule.provider) {
        expect(rule.roots).toEqual([])
        continue
      }

      expect(rule.roots.length).toBeGreaterThan(0)

      for (const root of rule.roots) {
        const resolved = expandHome(root)
        const permitted = ALLOWED_ROOTS.some(
          (allowed) => resolved === allowed || resolved.startsWith(allowed + '/')
        )
        expect(permitted, `${rule.id} walks ${root}, which is outside every allowed root`).toBe(
          true
        )
      }
    }
  })

  it('keeps every trash rule out of protected user folders', () => {
    for (const rule of allRules) {
      if (rule.action !== 'trash' || rule.provider) continue

      for (const root of rule.roots) {
        const resolved = expandHome(root)
        for (const forbidden of FORBIDDEN_PREFIXES) {
          expect(resolved.startsWith(forbidden)).toBe(false)
        }
      }
    }
  })
})
