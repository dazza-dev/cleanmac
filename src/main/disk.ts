import { statfs } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DiskStats } from '../shared/types'

const run = promisify(execFile)

/** The data volume is what fills up; `/` is the sealed read-only system snapshot. */
const DATA_VOLUME = '/System/Volumes/Data'

/**
 * Reporting storage on APFS honestly is harder than it looks, and getting it
 * wrong is the exact failure this project exists to correct.
 *
 * A single container holds several volumes — the data volume, the sealed system
 * volume, Preboot, Recovery and VM swap. `statfs` reports the *container's*
 * total and free space, so `total - free` counts all of them and overstates
 * what the user owns. On the reference machine that is 201 GB against a true
 * 167 GB: a 34 GB lie in the headline figure.
 *
 * `diskutil info` reports "Volume Used Space" for the data volume specifically,
 * which is the number a person can act on. Both are needed:
 *
 *   yourData + system + free = total
 *   167.3 GB + 33.8 GB + 44.0 GB = 245.1 GB
 */

interface DiskutilFields {
  volumeUsed?: number
  containerTotal?: number
  containerFree?: number
  purgeable?: number
}

function parseBytes(output: string, label: string): number | undefined {
  // "Volume Used Space:   167.3 GB (167293026304 Bytes) (exactly …)"
  const match = output.match(new RegExp(`${label}:\\s+[\\d.]+ \\w+ \\((\\d+) Bytes\\)`))
  return match?.[1] ? Number(match[1]) : undefined
}

async function readDiskutil(): Promise<DiskutilFields> {
  try {
    const { stdout } = await run('/usr/sbin/diskutil', ['info', DATA_VOLUME], {
      timeout: 10_000
    })

    return {
      volumeUsed: parseBytes(stdout, 'Volume Used Space'),
      containerTotal: parseBytes(stdout, 'Container Total Space'),
      containerFree: parseBytes(stdout, 'Container Free Space'),
      // Not present on every macOS build; absent means "unknown", never "zero
      // because we would rather not mention it".
      purgeable: parseBytes(stdout, 'Volume Available Space \\(Purgeable\\)')
    }
  } catch {
    return {}
  }
}

export async function diskStats(): Promise<DiskStats> {
  const [fields, fallback] = await Promise.all([readDiskutil(), statfs(DATA_VOLUME)])

  const statfsTotal = Number(fallback.blocks) * Number(fallback.bsize)
  const statfsFree = Number(fallback.bavail) * Number(fallback.bsize)

  const total = fields.containerTotal ?? statfsTotal
  const free = fields.containerFree ?? statfsFree

  // Without diskutil there is no way to separate the user's data from the other
  // volumes, so we fall back to the container figure and flag it rather than
  // presenting a number we cannot stand behind.
  const approximate = fields.volumeUsed === undefined
  const yourData = fields.volumeUsed ?? Math.max(0, total - free)
  const system = Math.max(0, total - yourData - free)

  return {
    total,
    yourData,
    system,
    free,
    purgeable: fields.purgeable ?? 0,
    usedPercent: total > 0 ? ((total - free) / total) * 100 : 0,
    approximate
  }
}
