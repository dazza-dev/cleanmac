import type { CleanupRule } from '../rules/types'
import { minAge, writable } from '../rules/guards'

/**
 * M2 — Developer tool caches.
 *
 * Download and build caches that every package manager rebuilds on demand. The
 * cost of clearing them is bandwidth and one slow build, never data.
 *
 * Only directories whose entire purpose is caching are listed. Package manager
 * *stores* that back existing installs (pnpm's content-addressable store, for
 * instance) are handled by their own tooling instead — see `homebrewCleanup`.
 */
export const packageCaches: CleanupRule = {
  id: 'dev.package-caches',
  moduleId: 'dev-caches',
  category: 'dev-caches',
  titleKey: 'rules.packageCaches.title',
  explainKey: 'rules.packageCaches.explain',
  risk: 'low',
  roots: ['~/Library/Caches'],
  depth: 1,
  match: {
    type: 'glob',
    patterns: [
      'composer',
      'typescript',
      'node-gyp',
      'electron',
      'electron-builder',
      'go-build',
      'ms-playwright',
      'Cypress',
      'deno',
      'pip',
      'bun',
      'yarn',
      'org.swift.swiftpm'
    ]
  },
  guards: [
    // Seven days keeps the toolchain the user is actively building against
    // intact — including anything downloaded during today's work.
    minAge(7),
    writable()
  ],
  action: 'trash',
  regenerates: true,
  minBytes: 10 * 1024 * 1024
}

/**
 * Homebrew ships its own garbage collection that knows which downloads still
 * back an installed formula. Deleting the cache directory by hand works but
 * discards more than necessary, so the official command is used instead.
 */
export const homebrewCleanup: CleanupRule = {
  id: 'dev.homebrew',
  moduleId: 'dev-caches',
  category: 'dev-caches',
  titleKey: 'rules.homebrew.title',
  explainKey: 'rules.homebrew.explain',
  risk: 'low',
  roots: ['~/Library/Caches'],
  depth: 1,
  match: { type: 'glob', patterns: ['Homebrew'] },
  guards: [writable()],
  action: 'command',
  regenerates: true,
  minBytes: 10 * 1024 * 1024,
  command: {
    bin: 'brew',
    dryRun: ['cleanup', '-n'],
    execute: ['cleanup']
  }
}

export const rules: CleanupRule[] = [packageCaches, homebrewCleanup]
