import { describe, it, expect } from 'vitest'
import { rules as browserRules } from '../../src/main/modules/browsers'
import { findRunningApp } from '../../src/main/rules/processes'
import { globToRegExp } from '../../src/main/rules/engine'
import type { RunningApps } from '../../src/main/rules/types'

function running(names: string[]): RunningApps {
  return {
    bundles: new Set(names.map((n) => n.toLowerCase())),
    displayNames: new Map(names.map((n) => [n.toLowerCase(), n])),
    paths: []
  }
}

/**
 * What matters about the browser module is what it can never match. Signing
 * someone out of every site, or destroying a web app's local data, is what
 * "clear browser data" buttons do and what this must not.
 */
const NEVER_MATCH = [
  'Cookies',
  'Login Data',
  'Login Data For Account',
  'History',
  'Bookmarks',
  'Preferences',
  'Secure Preferences',
  'Web Data',
  'Local Storage',
  'IndexedDB',
  'Local Extension Settings',
  'Extension State',
  'Sessions',
  'Favicons',
  'Network Action Predictor',
  'Affiliation Database'
]

describe('browser rules', () => {
  it('never match anything holding user state', () => {
    for (const rule of browserRules) {
      if (rule.action !== 'trash') continue

      for (const name of NEVER_MATCH) {
        const matched = rule.match.patterns.some((pattern) => globToRegExp(pattern).test(name))
        expect(matched, `${rule.id} would match ${name}`).toBe(false)
      }
    }
  })

  it('will not delete a browser profile', () => {
    // Profiles hold bookmarks and saved passwords; the rule that finds them is
    // inspect-only, and no deleting rule may match their names.
    for (const rule of browserRules) {
      if (rule.action !== 'trash') continue
      for (const name of ['Default', 'Profile 1', 'Guest Profile', 'System Profile']) {
        const matched = rule.match.patterns.some((pattern) => globToRegExp(pattern).test(name))
        expect(matched, `${rule.id} would match profile ${name}`).toBe(false)
      }
    }
  })

  it('refuse to run while their browser is open', () => {
    for (const rule of browserRules) {
      if (rule.action !== 'trash') continue
      expect(rule.guards.some((guard) => guard.id.startsWith('not-running:'))).toBe(true)
    }
  })
})

describe('findRunningApp', () => {
  it('connects a Chrome cache directory to the app that owns it', () => {
    // The prefix heuristic cannot: "chrome" and "googlechrome" share no prefix.
    expect(findRunningApp('Google Chrome', running(['Google Chrome']))).toBe('Google Chrome')
  })

  it('matches helper processes of the same app', () => {
    expect(findRunningApp('Google Chrome', running(['Google Chrome Helper']))).toBe(
      'Google Chrome Helper'
    )
  })

  it('does not match a different app that merely contains the word', () => {
    expect(findRunningApp('Safari', running(['SafariTechnologyPreviewThing']))).toBeNull()
    expect(findRunningApp('Firefox', running(['Google Chrome', 'Finder']))).toBeNull()
  })
})
