import { describe, it, expect } from 'vitest'
import {
  installedBundleIds,
  appLeftovers,
  bundleIdOf
} from '../../src/main/modules/app-leftovers'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { InlineScanner } from '../../src/main/scanner/inline-scanner'
import { ALLOWED_ROOTS, assertSafeResolved } from '../../src/main/rules/safe-path'
import { homedir } from 'node:os'
import path from 'node:path'

const HOME = homedir()

/**
 * The module with the highest false-positive risk in the catalogue. What is
 * asserted here is mostly restraint: that it refuses to guess, refuses to touch
 * Apple's data, and gives up entirely when it cannot see the app inventory.
 */

describe('installedBundleIds', () => {
  it('reads real bundle ids from this machine', async () => {
    const { ids, vendors } = await installedBundleIds()

    // Any Mac has applications; an empty result means the read failed.
    expect(ids.size).toBeGreaterThan(0)
    expect(vendors.size).toBeGreaterThan(0)
  })

  it('returns reverse-DNS identifiers, not display names', async () => {
    const { ids } = await installedBundleIds()
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9][a-z0-9.\-_]*\.[a-z0-9.\-_]+$/i)
    }
  })

  it('is lowercased so matching is case-insensitive', async () => {
    const { ids } = await installedBundleIds()
    for (const id of ids) expect(id).toBe(id.toLowerCase())
  })
})

describe('bundleIdOf', () => {
  /**
   * Regression guard for the worst bug this module can have. A binary
   * `Info.plist` read with an XML-only parser returns nothing, an installed app
   * looks uninstalled, and its container becomes a deletion candidate. That is
   * exactly what happened to a running WhatsApp on the reference machine.
   */
  it('reads a binary Info.plist, not just XML', async () => {
    const sandbox = await mkdtemp(path.join(HOME, 'Library', 'Caches', 'clean-mac-plist-'))
    const contents = path.join(sandbox, 'Fake.app', 'Contents')
    await mkdir(contents, { recursive: true })

    const plist = path.join(contents, 'Info.plist')
    await writeFile(
      plist,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.example.binary</string>
</dict></plist>`
    )

    // Same file, binary format — the case the first implementation missed.
    await promisify(execFile)('/usr/bin/plutil', ['-convert', 'binary1', plist])

    expect(await bundleIdOf(path.join(sandbox, 'Fake.app'))).toBe('com.example.binary')

    await rm(sandbox, { recursive: true, force: true })
  })

  it('returns null when there is no bundle id at all', async () => {
    expect(await bundleIdOf('/nonexistent/Nope.app')).toBeNull()
  })
})

describe('app-leftovers rule', () => {
  it('is never preselected, however confident the match looks', () => {
    // A wrong deletion here removes the settings of an app still in use.
    expect(appLeftovers.risk).toBe('medium')
  })

  it('produces only paths the executor would accept', async () => {
    const findings = await appLeftovers.provider!({
      running: { bundles: new Set(), displayNames: new Map(), paths: [] },
      now: Date.now(),
      scanner: new InlineScanner()
    })

    for (const finding of findings) {
      expect(() => assertSafeResolved(finding.path)).not.toThrow()
    }
  })

  it('never reports anything belonging to Apple', async () => {
    const findings = await appLeftovers.provider!({
      running: { bundles: new Set(), displayNames: new Map(), paths: [] },
      now: Date.now(),
      scanner: new InlineScanner()
    })

    for (const finding of findings) {
      expect(finding.path.toLowerCase()).not.toContain('/com.apple.')
      expect(finding.label?.toLowerCase()).not.toMatch(/^com\.apple\./)
    }
  })

  it('only ever names a directory whose own name is a bundle id', async () => {
    const findings = await appLeftovers.provider!({
      running: { bundles: new Set(), displayNames: new Map(), paths: [] },
      now: Date.now(),
      scanner: new InlineScanner()
    })

    for (const finding of findings) {
      // Three reverse-DNS segments minimum. Plain names like "Google" or
      // "Homebrew" are out of scope and must never appear.
      const name = path.basename(finding.path).replace(/\.savedState$/, '')
      expect(name.split('.').length).toBeGreaterThanOrEqual(3)
    }
  })

  it('searches only inside roots the deletion path already permits', () => {
    const searched = [
      'Library/Application Support',
      'Library/Caches',
      'Library/Containers',
      'Library/HTTPStorages',
      'Library/WebKit',
      'Library/Saved Application State'
    ]

    for (const relative of searched) {
      const full = path.join(HOME, relative)
      expect(ALLOWED_ROOTS, `${relative} must be an allowed root`).toContain(full)
    }
  })
})
