import { readdir, lstat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import path from 'node:path'
import type { SizeReport, WalkRequest } from './types'

/**
 * The measurement itself, kept free of any worker plumbing so the exact same
 * code runs inside the pool in production and inline in the safety tests.
 *
 * ## Why breadth-first with batched metadata reads
 *
 * Walking a directory tree is almost pure I/O latency, so what matters is how
 * many requests are in flight at once — not how little work happens per file.
 * This reads every directory of a level concurrently and issues every `lstat`
 * within a directory concurrently, which keeps libuv's filesystem thread pool
 * saturated instead of idling between one syscall and the next.
 *
 * Measured on the reference machine over cold caches, normalised per file
 * because the trees differ in size:
 *
 *   this (level-order, batched)         10.8 – 15.8 µs/file
 *   synchronous                         32.8 – 38.5 µs/file
 *   depth-first, batched per directory  40.4 µs/file
 *   depth-first, one lstat at a time    55.9 µs/file   ← the original
 *
 * Two earlier conclusions were wrong and are worth recording so nobody redoes
 * them:
 *
 *  - A synchronous walk looked 15× faster in a first benchmark. That run had
 *    measured warm-cache sync against cold-cache async. Measured fairly, sync
 *    *loses* on a cold cache — which is the only case a first scan ever sees —
 *    because a blocking call cannot overlap with disk latency.
 *  - A native (Rust) walker was planned for this version. It is not needed: the
 *    gap this closed was scheduling, not language, and a cargo toolchain is a
 *    real cost for contributors to an open source project.
 */

const BLOCK_SIZE = 512

/**
 * Caps on how much is put in flight at once. High enough to keep the thread
 * pool busy, low enough that a directory with a million entries does not turn
 * into a million pending promises.
 */
const DIR_BATCH = 64
const FILE_BATCH = 512

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export async function walk(request: WalkRequest): Promise<SizeReport> {
  const exclude = new Set(request.exclude)
  const seenInodes = new Set<string>()

  const report: SizeReport = {
    path: request.target,
    bytes: 0,
    logicalBytes: 0,
    files: 0,
    sharedBytes: 0,
    newestMtimeMs: 0,
    unreadable: []
  }

  let root: Stats
  try {
    root = await lstat(request.target)
  } catch {
    report.unreadable.push(request.target)
    return report
  }

  if (!root.isDirectory()) {
    report.files = 1
    report.bytes = root.blocks * BLOCK_SIZE
    report.logicalBytes = root.size
    report.newestMtimeMs = root.mtimeMs
    return report
  }

  report.newestMtimeMs = root.mtimeMs

  const account = (stat: Stats): void => {
    const allocated = stat.blocks * BLOCK_SIZE
    report.files += 1
    report.bytes += allocated
    report.logicalBytes += stat.size
    if (stat.mtimeMs > report.newestMtimeMs) report.newestMtimeMs = stat.mtimeMs

    // Hard links and APFS clones share blocks. The first sighting counts as
    // reclaimable; later ones are recorded as shared so the headline number
    // never promises bytes a delete would not actually free.
    if (stat.nlink > 1) {
      const key = `${stat.dev}:${stat.ino}`
      if (seenInodes.has(key)) report.sharedBytes += allocated
      else seenInodes.add(key)
    }
  }

  let level = [request.target]
  let depth = 0

  while (level.length > 0 && depth <= request.maxDepth) {
    const nextLevel: string[] = []

    for (const dirs of chunk(level, DIR_BATCH)) {
      const listings = await Promise.all(
        dirs.map(async (dir) => {
          if (exclude.has(dir)) return null
          try {
            return { dir, entries: await readdir(dir, { withFileTypes: true }) }
          } catch {
            // Nearly always EPERM from TCC. Recorded rather than thrown so the
            // UI can tell the user which parts of the scan were blind.
            report.unreadable.push(dir)
            return null
          }
        })
      )

      const files: string[] = []

      for (const listing of listings) {
        if (!listing) continue

        for (const entry of listing.entries) {
          const full = path.join(listing.dir, entry.name)
          if (exclude.has(full)) continue

          if (entry.isDirectory()) {
            if (depth < request.maxDepth) nextLevel.push(full)
            continue
          }

          // Symlinks are counted as the link itself, never followed. Following
          // them would double-count and could walk out of the tree entirely.
          if (entry.isFile() || entry.isSymbolicLink()) files.push(full)
        }
      }

      for (const batch of chunk(files, FILE_BATCH)) {
        const stats = await Promise.all(batch.map((file) => lstat(file).catch(() => null)))
        for (const stat of stats) {
          if (stat) account(stat)
        }
      }
    }

    level = nextLevel
    depth += 1
  }

  return report
}
