import { homedir } from 'node:os'
import { realpath } from 'node:fs/promises'
import path from 'node:path'

/**
 * Path safety gate. Every deletion in this application passes through
 * `assertSafeToTrash` immediately before the filesystem is touched — not once
 * when a rule is authored, but on every single execution.
 *
 * The model is an allowlist: a path is rejected unless it lives strictly inside
 * a root we explicitly opted into. The inverse ("delete everything except…")
 * is what breaks people's machines when an unforeseen app shows up, so it is
 * never used here.
 */

export class UnsafePathError extends Error {
  readonly target: string
  readonly reason: string

  constructor(target: string, reason: string) {
    super(`Refusing to touch ${target}: ${reason}`)
    this.name = 'UnsafePathError'
    this.target = target
    this.reason = reason
  }
}

const HOME = homedir()

/**
 * Prefixes nothing may ever touch, under any rule or acceptance path. These are
 * the ones where a mistake is unrecoverable or breaks the operating system.
 */
export const SYSTEM_FORBIDDEN: readonly string[] = [
  '/System',
  '/usr',
  '/bin',
  '/sbin',
  '/etc',
  '/var',
  '/private/var/db',
  '/private/etc',
  '/Library',
  '/Applications',
  '/Volumes', // external and network volumes are out of scope
  path.join(HOME, 'Library', 'Keychains'),
  path.join(HOME, 'Library', 'Mail'),
  path.join(HOME, 'Library', 'Messages'),
  path.join(HOME, '.Trash')
]

/**
 * Personal document and media folders. Off-limits to the root-based acceptance
 * path — no rule gets to walk them looking for things to delete.
 */
export const USER_DATA_FORBIDDEN: readonly string[] = [
  path.join(HOME, 'Desktop'),
  path.join(HOME, 'Documents'),
  path.join(HOME, 'Downloads'),
  path.join(HOME, 'Pictures'),
  path.join(HOME, 'Movies'),
  path.join(HOME, 'Music')
]

export const FORBIDDEN_PREFIXES: readonly string[] = [
  ...SYSTEM_FORBIDDEN,
  ...USER_DATA_FORBIDDEN
]

/**
 * Roots inside which cleaning is permitted. A candidate must live *strictly
 * below* one of these — the root itself can never be removed.
 */
export const ALLOWED_ROOTS: readonly string[] = [
  path.join(HOME, 'Library', 'Caches'),
  path.join(HOME, 'Library', 'Application Support'),
  path.join(HOME, 'Library', 'Logs'),
  path.join(HOME, 'Library', 'Developer'),
  path.join(HOME, 'Library', 'Saved Application State'),
  path.join(HOME, 'Library', 'HTTPStorages'),
  // Sandboxed apps keep their data here, including documents. Only the
  // app-leftovers rule targets it, and only for bundle ids no installed
  // application claims — see modules/app-leftovers.ts.
  path.join(HOME, 'Library', 'Containers'),
  path.join(HOME, 'Library', 'WebKit'),
  path.join(HOME, '.npm'),
  path.join(HOME, '.cargo', 'registry'),
  path.join(HOME, '.gradle', 'caches'),
  path.join(HOME, '.cache')
]

/**
 * Second acceptance path, for dependency directories that legitimately live
 * wherever the user keeps their code — `~/Projects`, `~/work`, anywhere.
 *
 * Membership here is a much stronger guarantee than a location allowlist: the
 * directory's own name has to be exactly one of these. A rule can never delete
 * `~/Projects/my-app`; it can only ever delete `~/Projects/my-app/node_modules`.
 *
 * Deliberately narrow. `dist`, `build` and `out` are NOT here: those names are
 * routinely committed source in some projects, and "it deleted my build folder
 * that was actually checked in" is not a recoverable mistake. Every addition
 * needs its own rule proving the contents are reproducible.
 */
export const ALLOWED_LEAF_NAMES: readonly string[] = ['node_modules']

/** Places a leaf-name match is still refused. Build output does not live here. */
const LEAF_FORBIDDEN: readonly string[] = [
  ...SYSTEM_FORBIDDEN,
  path.join(HOME, 'Library'),
  path.join(HOME, 'Pictures'),
  path.join(HOME, 'Movies'),
  path.join(HOME, 'Music')
]

/** Minimum number of path segments below `/` before a target is even considered. */
const MIN_SEGMENTS = 4

function segments(p: string): string[] {
  return p.split(path.sep).filter(Boolean)
}

function isInside(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep)
}

function isStrictlyInside(candidate: string, root: string): boolean {
  return candidate.startsWith(root + path.sep)
}

/**
 * Validates an already-resolved absolute path. Split out from
 * `assertSafeToTrash` so the safety suite can exercise it without touching a
 * real filesystem.
 */
export function assertSafeResolved(resolved: string): void {
  if (!path.isAbsolute(resolved)) {
    throw new UnsafePathError(resolved, 'not an absolute path')
  }

  if (resolved !== path.normalize(resolved)) {
    throw new UnsafePathError(resolved, 'path is not normalized')
  }

  if (resolved === '/' || resolved === HOME) {
    throw new UnsafePathError(resolved, 'refusing to operate on a filesystem or home root')
  }

  if (segments(resolved).length < MIN_SEGMENTS) {
    throw new UnsafePathError(resolved, `only ${segments(resolved).length} segments deep`)
  }

  // Acceptance path 2: a dependency directory identified by its own name.
  // Checked first because it has its own, stricter, forbidden list.
  if (ALLOWED_LEAF_NAMES.includes(path.basename(resolved))) {
    for (const forbidden of LEAF_FORBIDDEN) {
      if (isInside(resolved, forbidden)) {
        throw new UnsafePathError(resolved, `inside protected location ${forbidden}`)
      }
    }

    if (!isStrictlyInside(resolved, HOME)) {
      throw new UnsafePathError(resolved, 'outside the home directory')
    }

    return
  }

  // Acceptance path 1: anything strictly inside a root we opted into.
  for (const forbidden of FORBIDDEN_PREFIXES) {
    if (isInside(resolved, forbidden)) {
      throw new UnsafePathError(resolved, `inside protected location ${forbidden}`)
    }
  }

  const root = ALLOWED_ROOTS.find((candidate) => isStrictlyInside(resolved, candidate))
  if (!root) {
    throw new UnsafePathError(resolved, 'outside every allowed root')
  }
}

/**
 * Resolves symlinks *before* validating. This ordering is the whole point: a
 * symlink sitting in a cache directory could otherwise point at /System and
 * sail through a check performed on the un-resolved path.
 */
export async function assertSafeToTrash(target: string): Promise<string> {
  if (!path.isAbsolute(target)) {
    throw new UnsafePathError(target, 'not an absolute path')
  }

  let resolved: string
  try {
    resolved = await realpath(target)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw new UnsafePathError(target, 'no longer exists')
    }
    throw new UnsafePathError(target, `could not be resolved (${code ?? 'unknown'})`)
  }

  assertSafeResolved(resolved)

  // `shell.trashItem` acts on the path we hand it, so the declared form has to
  // clear the same bar as the resolved one.
  const declared = path.normalize(target)
  if (resolved !== declared) {
    assertSafeResolved(declared)

    // A symlink may not change what the thing *is*. `node_modules` pointing at
    // a directory called `thesis` is refused even though both locations would
    // individually pass, because the rule matched on the name.
    if (path.basename(resolved) !== path.basename(declared)) {
      throw new UnsafePathError(target, `resolves to a different name (${resolved})`)
    }
  }

  return resolved
}

/** Expands a leading `~` to the current user's home directory. */
export function expandHome(input: string): string {
  if (input === '~') return HOME
  if (input.startsWith('~/')) return path.join(HOME, input.slice(2))
  return input
}
