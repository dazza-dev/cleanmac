import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { stat } from 'node:fs/promises'
import type { SystemDataReport, SystemVolume } from '../shared/types'

const run = promisify(execFile)

/**
 * What macOS files under "System Data", named.
 *
 * ## The problem this exists for
 *
 * "System Data" is not a category. macOS classifies what it recognises —
 * Applications, Documents, Photos, Music, Mail — and puts *everything else*
 * under one label. It is a subtraction, not a measurement, which is why the
 * Storage screen can show 60 GB and offer nothing to click: nothing was ever
 * identified, so there is nothing to say.
 *
 * A large part of it is not even in the user's home directory. It is whole APFS
 * volumes sharing the container: swap, the hibernation image, Preboot, Recovery.
 * No amount of tidying reaches those, and no cleaner can delete them.
 *
 * ## Measured, not assumed
 *
 * On a reference Mac mini the VM volume held **34.01 GB** after weeks of
 * uptime. A reboot took it to **0.00 GB** — 34 GB back, with nothing deleted and
 * nothing to undo. That measurement is why this module exists, and why it
 * reports rather than offers a button: there is no file here whose removal
 * would be correct.
 *
 * The same machine showed Preboot at 8.40 GB where 1–2 GB is normal. It is
 * reported for the same reason and cleaned for none: Preboot holds what the Mac
 * needs in order to start.
 */

/** Roles worth explaining. Anything else is reported without a note. */
const ROLE_NOTES: Record<string, string> = {
  VM: 'systemData.note.vm',
  Preboot: 'systemData.note.preboot',
  Recovery: 'systemData.note.recovery',
  System: 'systemData.note.system'
}

/**
 * Parses `diskutil apfs list`. `statfs` cannot answer this — it describes one
 * volume, while the question is what the *container* is holding, and the
 * container is what fills up.
 */
export function parseApfsVolumes(output: string): SystemVolume[] {
  const volumes: SystemVolume[] = []
  let role: string | null = null

  for (const line of output.split('\n')) {
    const roleMatch = line.match(/APFS Volume Disk \(Role\):\s+\S+\s+\((.*)\)/)
    if (roleMatch?.[1]) {
      role = roleMatch[1]
      continue
    }

    const consumed = line.match(/Capacity Consumed:\s+(\d+) B/)
    if (consumed?.[1] && role) {
      volumes.push({
        role,
        bytes: Number(consumed[1]),
        noteKey: ROLE_NOTES[role]
      })
      role = null
    }
  }

  return volumes
}

/** `vm.swapusage: total = 13312.00M  used = 12043.06M  free = 1268.94M` */
export function parseSwapUsage(output: string): { total: number; used: number } {
  const size = (label: string): number => {
    const match = output.match(new RegExp(`${label}\\s*=\\s*([\\d.]+)([KMGT])`))
    if (!match?.[1]) return 0
    const multiplier =
      { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }[match[2] ?? 'M'] ?? 1
    return Math.round(Number(match[1]) * multiplier)
  }

  return { total: size('total'), used: size('used') }
}

async function apfsVolumes(): Promise<SystemVolume[]> {
  try {
    const { stdout } = await run('/usr/sbin/diskutil', ['apfs', 'list'], {
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024
    })
    return parseApfsVolumes(stdout)
  } catch {
    return []
  }
}

async function swapUsage(): Promise<{ total: number; used: number }> {
  try {
    const { stdout } = await run('/usr/sbin/sysctl', ['vm.swapusage'], { timeout: 5000 })
    return parseSwapUsage(stdout)
  } catch {
    return { total: 0, used: 0 }
  }
}

async function sleepImageBytes(): Promise<number> {
  try {
    const info = await stat('/private/var/vm/sleepimage')
    return info.blocks * 512
  } catch {
    // Absent on machines that never hibernate, and unreadable without
    // privileges on some. Either way it is not an error.
    return 0
  }
}

/**
 * Local Time Machine snapshots. They occupy real space, appear nowhere in the
 * Finder, and macOS counts them in exactly the bucket this module explains — the
 * other big invisible after swap.
 */
async function localSnapshots(): Promise<string[]> {
  try {
    const { stdout } = await run('/usr/bin/tmutil', ['listlocalsnapshots', '/'], {
      timeout: 15_000,
      maxBuffer: 1024 * 1024
    })
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('com.apple.TimeMachine'))
  } catch {
    return []
  }
}

/**
 * `sysctl -n kern.boottime` prints:
 *
 *     { sec = 1784423058, usec = 44319 } Sat Jul 18 20:04:18 2026
 *
 * Only `sec` is used — a unix timestamp for the moment the machine booted.
 */
export function parseBootTime(output: string): number | null {
  const seconds = output.match(/sec\s*=\s*(\d+)/)?.[1]
  return seconds ? Number(seconds) : null
}

/**
 * Seconds since the machine booted. Swap only grows between restarts, so this
 * is the whole context for the recommendation.
 *
 * NOT `process.uptime()`, which is how long this application has been running.
 * That reads as a plausible number and is never the right one: it says zero on a
 * machine that has been up for three weeks, which turns "you have not restarted
 * in 41 days" into "you have not restarted in 0 days" and quietly deletes the
 * entire argument for restarting.
 */
export async function uptimeSeconds(): Promise<number> {
  try {
    const { stdout } = await run('/usr/sbin/sysctl', ['-n', 'kern.boottime'], {
      timeout: 5000
    })
    const bootedAt = parseBootTime(stdout)
    if (bootedAt === null) return 0
    return Math.max(0, Math.round(Date.now() / 1000) - bootedAt)
  } catch {
    return 0
  }
}

export async function systemDataReport(): Promise<SystemDataReport> {
  const [volumes, swap, sleepImage, snapshots, uptime] = await Promise.all([
    apfsVolumes(),
    swapUsage(),
    sleepImageBytes(),
    localSnapshots(),
    uptimeSeconds()
  ])

  const outsideData = volumes
    .filter((volume) => volume.role !== 'Data')
    .reduce((sum, volume) => sum + volume.bytes, 0)

  const vm = volumes.find((volume) => volume.role === 'VM')?.bytes ?? 0

  return {
    volumes: volumes.sort((a, b) => b.bytes - a.bytes),
    outsideData,
    vmBytes: vm,
    swapTotal: swap.total,
    swapUsed: swap.used,
    sleepImageBytes: sleepImage,
    uptimeSeconds: uptime,
    snapshots,
    // The only remedy offered anywhere in this module, and it deletes nothing.
    // Swap is released on boot; there is no file here that should be removed.
    rebootWouldFree: vm
  }
}
