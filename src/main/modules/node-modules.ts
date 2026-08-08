import { opendir, access, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import type { CleanupRule, ProviderContext, ProviderFinding } from '../rules/types'

/**
 * M6 — Dependency directories for projects nobody has touched in months.
 *
 * Reproducible from a lockfile, so the cost of deleting one is a `pnpm install`
 * — but only if a lockfile exists. Without one the exact tree cannot be
 * recreated, and a project that no longer builds is a far worse outcome than a
 * full disk. That check is a hard requirement, not a preference.
 *
 * Scope note: only `node_modules`. `dist`, `build` and `.next` are deliberately
 * out of scope — those names are checked into source in plenty of projects, and
 * this app cannot tell the difference from the outside.
 */

const HOME = homedir()

/** Where people keep code. Anything not found is skipped silently. */
const SEARCH_ROOTS = [
  'Projects',
  'Developer',
  'dev',
  'code',
  'src',
  'work',
  'repos',
  'Sites',
  'workspace'
].map((relative) => path.join(HOME, relative))

/** How deep below a search root a project may sit. */
const MAX_DEPTH = 4

const LOCKFILES = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
  'npm-shrinkwrap.json'
]

const DAY_MS = 24 * 60 * 60 * 1000
const INACTIVE_DAYS = 45

/** Directories never worth descending into while hunting for projects. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'Library', '.Trash', 'vendor', 'target'])

async function findNodeModules(root: string, depth: number): Promise<string[]> {
  if (depth <= 0) return []

  let dir
  try {
    dir = await opendir(root)
  } catch {
    return []
  }

  const found: string[] = []

  try {
    for await (const entry of dir) {
      if (!entry.isDirectory()) continue

      const full = path.join(root, entry.name)

      if (entry.name === 'node_modules') {
        found.push(full)
        continue // never descend into one; nested copies belong to it
      }

      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue

      found.push(...(await findNodeModules(full, depth - 1)))
    }
  } catch {
    // Vanished mid-iteration; whatever was collected still stands.
  }

  return found
}

/** Most recent mtime among a project's own files, ignoring node_modules. */
async function projectLastTouched(projectDir: string): Promise<number> {
  let newest = 0

  let dir
  try {
    dir = await opendir(projectDir)
  } catch {
    return 0
  }

  try {
    for await (const entry of dir) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue

      try {
        const info = await stat(path.join(projectDir, entry.name))
        if (info.mtimeMs > newest) newest = info.mtimeMs
      } catch {
        continue
      }
    }
  } catch {
    return newest
  }

  return newest
}

async function findLockfile(projectDir: string): Promise<string | null> {
  for (const name of LOCKFILES) {
    try {
      await access(path.join(projectDir, name), constants.R_OK)
      return name
    } catch {
      continue
    }
  }
  return null
}

async function provider(context: ProviderContext): Promise<ProviderFinding[]> {
  const findings: ProviderFinding[] = []

  const roots = (
    await Promise.all(SEARCH_ROOTS.map((root) => findNodeModules(root, MAX_DEPTH)))
  ).flat()

  // Measured together rather than one at a time: a dozen dependency trees is
  // hundreds of thousands of files, and sequentially that was fourteen seconds
  // of a scan that should take two.
  const reports = await context.scanner.sizeAll(roots)

  for (const [index, modulesDir] of roots.entries()) {
    const report = reports[index]
    if (!report) continue

    const projectDir = path.dirname(modulesDir)
    const lockfile = await findLockfile(projectDir)
    const lastTouched = await projectLastTouched(projectDir)
    const inactiveDays = Math.floor((context.now - lastTouched) / DAY_MS)

    // Both facts are reported even when the finding is blocked. "1.9 GB, but
    // there is no lockfile" is more useful than the row simply not appearing.
    const skipped = !lockfile
      ? { reasonKey: 'guard.noLockfile' }
      : inactiveDays < INACTIVE_DAYS
        ? { reasonKey: 'guard.projectActive', detail: String(inactiveDays) }
        : undefined

    findings.push({
      path: modulesDir,
      bytes: report.bytes,
      files: report.files,
      mtimeMs: lastTouched,
      label: `${path.basename(projectDir)}${lockfile ? ` · ${lockfile}` : ''}`,
      ...(skipped ? { skipped } : {})
    })
  }

  return findings
}

export const orphanedNodeModules: CleanupRule = {
  id: 'dev.node-modules',
  moduleId: 'node-modules',
  category: 'node-modules',
  titleKey: 'rules.nodeModules.title',
  explainKey: 'rules.nodeModules.explain',
  risk: 'low',
  roots: [],
  depth: 0,
  match: { type: 'glob', patterns: [] },
  guards: [],
  action: 'trash',
  regenerates: true,
  provider,
  minBytes: 20 * 1024 * 1024
}

export const rules: CleanupRule[] = [orphanedNodeModules]
