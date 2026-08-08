import { describe, it, expect } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Structural guarantee, not a unit test: nothing in this codebase may call a
 * destructive fs API. Every removal goes through `shell.trashItem`, which is
 * what makes the whole product recoverable.
 *
 * If this fails, the fix is to use the Trash — not to loosen the test.
 */

const SRC = path.resolve('src')

const BANNED = [
  /\bfs\.rm\b/,
  /\bfs\.rmSync\b/,
  /\bfs\.unlink\b/,
  /\bfs\.unlinkSync\b/,
  /\bfs\.rmdir\b/,
  /\brmSync\s*\(/,
  /\bunlinkSync\s*\(/,
  /\brimraf\b/,
  // `rm -rf` shelled out is the same thing wearing a hat.
  /['"`]rm['"`]\s*,\s*\[/,
  /rm\s+-rf/
]

/** `rm` from fs/promises, but not the harmless `rm` in a comment. */
const BANNED_IMPORTS = [/import\s*\{[^}]*\brm\b[^}]*\}\s*from\s*['"]node:fs\/promises['"]/]

/**
 * Comments are removed before matching. The rule is about what the code calls,
 * and prose that merely *names* a banned API — including the doc comment in the
 * executor explaining why it is banned — is not a violation.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await sourceFiles(full)))
    else if (/\.(ts|vue)$/.test(entry.name)) files.push(full)
  }

  return files
}

describe('no hard deletes', () => {
  it('never calls a destructive filesystem API anywhere in src/', async () => {
    const files = await sourceFiles(SRC)
    expect(files.length).toBeGreaterThan(10)

    const offenders: string[] = []

    for (const file of files) {
      const contents = stripComments(await readFile(file, 'utf8'))
      for (const pattern of [...BANNED, ...BANNED_IMPORTS]) {
        if (pattern.test(contents)) {
          offenders.push(`${path.relative(SRC, file)} matched ${pattern}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  /**
   * Guards the guard. Stripping comments must not blunt the detector, so a
   * synthetic violation has to still trip every relevant pattern.
   */
  it('still detects a real violation after comments are stripped', () => {
    const offending = [
      `import { rm } from 'node:fs/promises'`,
      `// this comment mentions fs.rm and must not count`,
      `await fs.rm(target, { recursive: true })`,
      `execFile('rm', ['-rf', target])`
    ].join('\n')

    const stripped = stripComments(offending)
    expect(stripped).not.toContain('must not count')
    expect([...BANNED, ...BANNED_IMPORTS].filter((p) => p.test(stripped)).length).toBeGreaterThan(2)

    const innocent = stripComments(`// fs.rm is banned here, see docs\nawait shell.trashItem(p)`)
    expect([...BANNED, ...BANNED_IMPORTS].some((p) => p.test(innocent))).toBe(false)
  })

  it('routes deletion through shell.trashItem', async () => {
    const executor = await readFile(path.join(SRC, 'main/executor/index.ts'), 'utf8')
    expect(executor).toContain('shell.trashItem')
  })

  it('validates the path immediately before trashing it', async () => {
    const executor = await readFile(path.join(SRC, 'main/executor/index.ts'), 'utf8')
    const guardIndex = executor.indexOf('assertSafeToTrash')
    const trashIndex = executor.indexOf('shell.trashItem')

    expect(guardIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(trashIndex)
  })
})
