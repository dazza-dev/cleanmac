import { readdir, lstat, open } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'
import type { DuplicateFile, DuplicateGroup, DuplicateReport } from '../shared/types'

/**
 * M11 — byte-identical files.
 *
 * Reported only, permanently. Which copy of a file matters is not a question
 * this app can answer: the one in `~/Downloads` might be the throwaway, or it
 * might be the one you are about to email.
 *
 * ## Three passes, because hashing everything is not an option
 *
 * A home directory holds hundreds of thousands of files. Hashing them all would
 * read every byte on the disk. Instead each pass only feeds the next one what
 * survived:
 *
 *   1. **Size.** Files of different sizes cannot be identical. Free — the walk
 *      already has `stat`. Kills the overwhelming majority.
 *   2. **Head.** The first 4 KB. Two files that differ at all usually differ
 *      early, and this reads 4 KB instead of gigabytes.
 *   3. **Full content.** Only for what is still tied after the first two.
 *
 * SHA-256 rather than BLAKE3: it is in Node's standard library and Apple
 * Silicon accelerates it in hardware, so the gain from a native BLAKE3 module
 * would not pay for a compiled dependency in a project that has none.
 *
 * ## What this cannot see, and why it says so
 *
 * Two kinds of sharing make a "duplicate" free nothing when deleted:
 *
 *   **Hard links** — several names for one inode. Detected exactly, via
 *   `dev:ino`, and excluded from every reclaimable figure.
 *
 *   **APFS clones** — `cp` on APFS does not copy, it creates a second inode
 *   sharing the same extents. Both files then report their full size to
 *   `stat`, because the sharing lives below the level `stat` describes.
 *   **There is no way to detect this from Node.** It needs `fcntl` with
 *   `F_LOG2PHYS` to compare physical extents, which means native code this
 *   project deliberately does not carry.
 *
 * So the reclaimable figure here is an **upper bound**, and the UI says so
 * rather than presenting it as a promise. That is the opposite of what a
 * cleaner is tempted to do with a number this satisfying, and it is the reason
 * this module reports and never deletes: a figure the app cannot stand behind
 * must not become a button.
 */

const HOME = homedir()

/**
 * `~/Library` is excluded on purpose. It is full of legitimate identical files
 * — the same framework vendored by ten apps, identical zero-byte lockfiles —
 * and none of it is the user's to reorganise.
 */
const EXCLUDES = new Set([
  'Library',
  '.Trash',
  'node_modules',
  '.git',
  'Applications',
  '.cache'
])

const HEAD_BYTES = 4096
const MAX_DEPTH = 8
const DIR_BATCH = 64
const FILE_BATCH = 256

interface Candidate {
  path: string
  bytes: number
  /** `dev:ino` — identifies the file itself, as opposed to a name for it. */
  inode: string
  nlink: number
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function displayPath(target: string): string {
  return target.startsWith(HOME + path.sep) ? `~${target.slice(HOME.length)}` : target
}

/** Collects every regular file at or above `minBytes`. */
async function collect(
  minBytes: number,
  roots: string[]
): Promise<{ files: Candidate[]; scanned: number; unreadable: number }> {
  const files: Candidate[] = []
  let scanned = 0
  let unreadable = 0

  let level = roots
  let depth = 0

  while (level.length > 0 && depth <= MAX_DEPTH) {
    const next: string[] = []

    for (const dirs of chunk(level, DIR_BATCH)) {
      const listings = await Promise.all(
        dirs.map(async (dir) => {
          try {
            return { dir, entries: await readdir(dir, { withFileTypes: true }) }
          } catch {
            unreadable += 1
            return null
          }
        })
      )

      const found: string[] = []

      for (const listing of listings) {
        if (!listing) continue

        for (const entry of listing.entries) {
          if (EXCLUDES.has(entry.name) || entry.name.startsWith('.')) continue
          // Bundles are one item to a person, not a tree to rummage through.
          if (entry.name.includes('.app') || entry.name.includes('.photoslibrary')) continue

          const full = path.join(listing.dir, entry.name)
          if (entry.isDirectory()) next.push(full)
          else if (entry.isFile()) found.push(full)
        }
      }

      for (const batch of chunk(found, FILE_BATCH)) {
        const stats = await Promise.all(
          batch.map(async (file) => ({ file, stat: await lstat(file).catch(() => null) }))
        )

        for (const { file, stat } of stats) {
          if (!stat) continue
          scanned += 1
          if (stat.size < minBytes) continue

          files.push({
            path: file,
            bytes: stat.size,
            inode: `${stat.dev}:${stat.ino}`,
            nlink: stat.nlink
          })
        }
      }
    }

    level = next
    depth += 1
  }

  return { files, scanned, unreadable }
}

/** Hashes the first `HEAD_BYTES`, or the whole file when `full` is set. */
async function digest(target: string, full: boolean): Promise<string | null> {
  let handle
  try {
    handle = await open(target, 'r')
  } catch {
    return null
  }

  try {
    const hash = createHash('sha256')

    if (full) {
      for await (const piece of handle.createReadStream({ autoClose: false })) {
        hash.update(piece as Buffer)
      }
    } else {
      const buffer = Buffer.alloc(HEAD_BYTES)
      const { bytesRead } = await handle.read(buffer, 0, HEAD_BYTES, 0)
      hash.update(buffer.subarray(0, bytesRead))
    }

    return hash.digest('hex')
  } catch {
    return null
  } finally {
    await handle.close().catch(() => undefined)
  }
}

/** Groups by a key, dropping anything that ends up alone. */
function groupBy<T>(items: T[], key: (item: T) => string): T[][] {
  const buckets = new Map<string, T[]>()
  for (const item of items) {
    const bucket = buckets.get(key(item))
    if (bucket) bucket.push(item)
    else buckets.set(key(item), [item])
  }
  return [...buckets.values()].filter((bucket) => bucket.length > 1)
}

async function refine(
  groups: Candidate[][],
  full: boolean,
  read: Set<string>
): Promise<Candidate[][]> {
  const refined: Candidate[][] = []

  for (const group of groups) {
    const hashed: Array<{ candidate: Candidate; hash: string }> = []

    for (const batch of chunk(group, FILE_BATCH)) {
      const results = await Promise.all(
        batch.map(async (candidate) => {
          // Distinct files, not hash operations: a file that reaches the third
          // pass is read twice, and "12 hashes over 8 files" tells nobody
          // anything. What costs time is opening files.
          read.add(candidate.path)
          return { candidate, hash: await digest(candidate.path, full) }
        })
      )
      for (const result of results) {
        if (result.hash) hashed.push({ candidate: result.candidate, hash: result.hash })
      }
    }

    refined.push(...groupBy(hashed, (entry) => entry.hash).map((b) => b.map((e) => e.candidate)))
  }

  return refined
}

/**
 * `roots` defaults to the home directory, which is the policy the UI uses.
 * Scoping it is what lets a test be hermetic instead of depending on whatever
 * the machine happens to hold — the first version of the test searched the real
 * home and its fixtures fell outside the top 40 results.
 */
export async function findDuplicates(
  minBytes = 1024 * 1024,
  limit = 40,
  roots: string[] = [HOME]
): Promise<DuplicateReport> {
  const started = Date.now()
  const { files, scanned, unreadable } = await collect(minBytes, roots)

  const read = new Set<string>()

  // Pass 1 is free: the walk already knows every size.
  let groups = groupBy(files, (file) => String(file.bytes))
  groups = await refine(groups, false, read)
  groups = await refine(groups, true, read)

  const result: DuplicateGroup[] = groups.map((group) => {
    // Two names for one inode are a hard link, not a duplicate: deleting one
    // frees nothing at all. They are shown, but never counted.
    const inodes = new Set(group.map((file) => file.inode))
    const bytes = group[0]?.bytes ?? 0

    const entries: DuplicateFile[] = group.map((file) => ({
      path: file.path,
      displayPath: displayPath(file.path),
      inode: file.inode
    }))

    return {
      bytes,
      files: entries,
      distinctCopies: inodes.size,
      reclaimable: bytes * Math.max(0, inodes.size - 1),
      hardLinked: inodes.size < group.length
    }
  })

  result.sort((a, b) => b.reclaimable - a.reclaimable)

  return {
    groups: result.slice(0, limit),
    totalGroups: result.length,
    totalReclaimable: result.reduce((sum, group) => sum + group.reclaimable, 0),
    scanned,
    hashed: read.size,
    unreadable,
    durationMs: Date.now() - started
  }
}
