import { describe, it, expect } from 'vitest'
import { homedir } from 'node:os'
import path from 'node:path'
import {
  assertSafeResolved,
  UnsafePathError,
  FORBIDDEN_PREFIXES,
  ALLOWED_ROOTS,
  expandHome
} from '../../src/main/rules/safe-path'

const HOME = homedir()

describe('path allowlist', () => {
  it('rejects every forbidden prefix and anything under it', () => {
    for (const forbidden of FORBIDDEN_PREFIXES) {
      expect(() => assertSafeResolved(forbidden)).toThrow(UnsafePathError)
      expect(() => assertSafeResolved(path.join(forbidden, 'child', 'deeper'))).toThrow(
        UnsafePathError
      )
    }
  })

  it('rejects the filesystem root and the home directory itself', () => {
    expect(() => assertSafeResolved('/')).toThrow(UnsafePathError)
    expect(() => assertSafeResolved(HOME)).toThrow(UnsafePathError)
  })

  it('rejects an allowed root itself — only things *inside* it may go', () => {
    for (const root of ALLOWED_ROOTS) {
      expect(() => assertSafeResolved(root)).toThrow(UnsafePathError)
    }
  })

  it('accepts a normal target inside an allowed root', () => {
    expect(() =>
      assertSafeResolved(path.join(HOME, 'Library', 'Caches', 'com.example.ShipIt'))
    ).not.toThrow()
  })

  it('rejects paths that are too shallow', () => {
    expect(() => assertSafeResolved('/Users')).toThrow(UnsafePathError)
    expect(() => assertSafeResolved(path.join('/Users', path.basename(HOME)))).toThrow(
      UnsafePathError
    )
  })

  it('rejects anything outside every allowed root', () => {
    expect(() => assertSafeResolved('/opt/homebrew/lib/whatever')).toThrow(UnsafePathError)
    expect(() => assertSafeResolved(path.join(HOME, 'Projects', 'app', 'src'))).toThrow(
      UnsafePathError
    )
  })

  it('rejects un-normalized paths so traversal cannot slip through', () => {
    const traversal = path.join(HOME, 'Library', 'Caches') + '/../../../../System'
    expect(() => assertSafeResolved(traversal)).toThrow(UnsafePathError)
  })

  it('rejects relative paths', () => {
    expect(() => assertSafeResolved('Library/Caches/thing')).toThrow(UnsafePathError)
  })

  it('never lists a protected user folder as an allowed root', () => {
    const protectedFolders = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Movies']
    for (const folder of protectedFolders) {
      const target = path.join(HOME, folder)
      expect(ALLOWED_ROOTS.some((root) => root.startsWith(target))).toBe(false)
    }
  })

  it('expands ~ to the real home directory', () => {
    expect(expandHome('~/Library/Caches')).toBe(path.join(HOME, 'Library', 'Caches'))
    expect(expandHome('/absolute')).toBe('/absolute')
  })
})
