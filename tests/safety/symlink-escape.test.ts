import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { assertSafeToTrash, UnsafePathError } from '../../src/main/rules/safe-path'

/**
 * The scenario this guards against: a symlink planted inside a cache directory
 * that points at something critical. If the allowlist were checked against the
 * un-resolved path, the deletion would be approved and then follow the link.
 *
 * The fixture is built inside a real allowed root (~/Library/Caches) because
 * that is the only place the check can be exercised honestly.
 */

const CACHES = path.join(homedir(), 'Library', 'Caches')
let sandbox: string

beforeAll(async () => {
  sandbox = await mkdtemp(path.join(CACHES, 'clean-mac-test-'))
})

afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

describe('symlink escapes', () => {
  it('rejects a symlink pointing at /System', async () => {
    const link = path.join(sandbox, 'escape-system')
    await symlink('/System', link)
    await expect(assertSafeToTrash(link)).rejects.toThrow(UnsafePathError)
  })

  it('rejects a symlink pointing at the home directory', async () => {
    const link = path.join(sandbox, 'escape-home')
    await symlink(homedir(), link)
    await expect(assertSafeToTrash(link)).rejects.toThrow(UnsafePathError)
  })

  it('rejects a symlink pointing outside every allowed root', async () => {
    const outside = await mkdtemp(path.join(tmpdir(), 'clean-mac-outside-'))
    const link = path.join(sandbox, 'escape-tmp')
    await symlink(outside, link)

    await expect(assertSafeToTrash(link)).rejects.toThrow(UnsafePathError)
    await rm(outside, { recursive: true, force: true })
  })

  it('rejects a path that traverses out via ..', async () => {
    const traversal = path.join(sandbox, '..', '..', '..', '..', 'System')
    await expect(assertSafeToTrash(traversal)).rejects.toThrow(UnsafePathError)
  })

  it('rejects a target that no longer exists', async () => {
    await expect(assertSafeToTrash(path.join(sandbox, 'never-existed'))).rejects.toThrow(
      UnsafePathError
    )
  })

  it('accepts a real directory inside the sandbox', async () => {
    const real = path.join(sandbox, 'com.example.ShipIt')
    await mkdir(real)
    await writeFile(path.join(real, 'update.zip'), 'x')

    await expect(assertSafeToTrash(real)).resolves.toContain('com.example.ShipIt')
  })
})
