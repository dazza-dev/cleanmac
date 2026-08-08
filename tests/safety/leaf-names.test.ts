import { describe, it, expect } from 'vitest'
import { homedir } from 'node:os'
import path from 'node:path'
import {
  assertSafeResolved,
  UnsafePathError,
  ALLOWED_LEAF_NAMES,
  ALLOWED_ROOTS
} from '../../src/main/rules/safe-path'

const HOME = homedir()

/**
 * v0.3 added a second acceptance path so dependency directories can be cleaned
 * wherever someone keeps their code. It is the only place the location
 * allowlist is relaxed, so it gets the closest scrutiny in this suite.
 */

describe('leaf-name acceptance', () => {
  it('accepts node_modules anywhere under home', () => {
    for (const parent of ['Projects/app', 'work/client/api', 'Documents/thesis-site', 'x']) {
      expect(() =>
        assertSafeResolved(path.join(HOME, parent, 'node_modules'))
      ).not.toThrow()
    }
  })

  it('refuses the project itself, only ever the dependency folder', () => {
    // This is the whole guarantee: the parent directory is untouchable.
    expect(() => assertSafeResolved(path.join(HOME, 'Projects', 'app'))).toThrow(UnsafePathError)
    expect(() => assertSafeResolved(path.join(HOME, 'Projects', 'app', 'src'))).toThrow(
      UnsafePathError
    )
  })

  it('refuses paths inside node_modules — the folder goes whole or not at all', () => {
    expect(() =>
      assertSafeResolved(path.join(HOME, 'Projects/app/node_modules/react'))
    ).toThrow(UnsafePathError)
  })

  it('refuses node_modules outside the home directory', () => {
    expect(() => assertSafeResolved('/opt/service/node_modules')).toThrow(UnsafePathError)
    expect(() => assertSafeResolved('/Volumes/Backup/app/node_modules')).toThrow(UnsafePathError)
  })

  it('refuses node_modules inside system and media locations', () => {
    const refused = [
      '/System/x/node_modules',
      '/Library/Foo/node_modules',
      '/Applications/App.app/node_modules',
      path.join(HOME, 'Library', 'Caches', 'thing', 'node_modules'),
      path.join(HOME, 'Pictures', 'node_modules'),
      path.join(HOME, 'Movies', 'node_modules'),
      path.join(HOME, 'Music', 'node_modules'),
      path.join(HOME, '.Trash', 'node_modules')
    ]

    for (const target of refused) {
      expect(() => assertSafeResolved(target), target).toThrow(UnsafePathError)
    }
  })

  it('keeps names whose contents cannot be proven reproducible out of the list', () => {
    // `dist`, `build` and `out` are checked into source in plenty of projects.
    for (const name of ['dist', 'build', 'out', 'target', 'vendor', 'src', '.git']) {
      expect(ALLOWED_LEAF_NAMES).not.toContain(name)
      expect(() => assertSafeResolved(path.join(HOME, 'Projects/app', name))).toThrow(
        UnsafePathError
      )
    }
  })

  it('does not widen the root-based path', () => {
    // Documents is reachable by leaf name only; no rule may walk it.
    expect(ALLOWED_ROOTS.some((root) => root.startsWith(path.join(HOME, 'Documents')))).toBe(
      false
    )
    expect(() => assertSafeResolved(path.join(HOME, 'Documents', 'anything'))).toThrow(
      UnsafePathError
    )
  })
})
