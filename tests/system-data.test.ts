import { describe, it, expect, beforeAll } from 'vitest'
import {
  parseApfsVolumes,
  parseBootTime,
  parseSwapUsage,
  systemDataReport
} from '../src/main/system-data'

/**
 * Both parsers read the output of a command that this project does not control.
 * A silent parse failure here does not crash anything — it reports zero, which
 * reads exactly like "nothing to explain" and would quietly undo the point of
 * the module. Hence fixtures captured from real machines.
 */

/** Captured from the reference Mac mini after weeks of uptime. */
const MINI_BEFORE_REBOOT = `
+-- Container disk3 978CA3A9-06BB-4A29-8B0B-B4B4B6BC1E36
    |   APFS Container Reference:     disk3
    |   Capacity Ceiling (Size):      245107195904 B (245.1 GB)
    |   Capacity Free:                41037762560 B (41.0 GB)
    |
    +-> Volume disk3s1 3B2E5F1A-0000-0000-0000-000000000001
    |   |   APFS Volume Disk (Role):   disk3s1 (Data)
    |   |   Name:                      Macintosh HD - Data (Case-insensitive)
    |   |   Capacity Consumed:         160432189440 B (160.4 GB)
    |
    +-> Volume disk3s6 3B2E5F1A-0000-0000-0000-000000000006
        |   APFS Volume Disk (Role):   disk3s6 (VM)
        |   Name:                      VM (Case-insensitive)
        |   Capacity Consumed:         36517269504 B (36.5 GB)
`

describe('parseApfsVolumes', () => {
  it('reads every volume with its role and size', () => {
    const volumes = parseApfsVolumes(MINI_BEFORE_REBOOT)

    expect(volumes).toHaveLength(2)
    expect(volumes.find((v) => v.role === 'Data')?.bytes).toBe(160432189440)
    expect(volumes.find((v) => v.role === 'VM')?.bytes).toBe(36517269504)
  })

  it('attaches an explanation to the volumes nobody can name', () => {
    const vm = parseApfsVolumes(MINI_BEFORE_REBOOT).find((v) => v.role === 'VM')
    expect(vm?.noteKey).toBe('systemData.note.vm')
  })

  it('does not invent volumes from a size with no role above it', () => {
    // A role line claims the next size line. An orphan size belongs to nothing
    // and must not become a row.
    expect(parseApfsVolumes('   Capacity Consumed:  12345 B (12.3 GB)')).toEqual([])
  })

  it('survives output it cannot understand', () => {
    expect(parseApfsVolumes('')).toEqual([])
    expect(parseApfsVolumes('command not found')).toEqual([])
  })
})

describe('parseSwapUsage', () => {
  it('reads the real format sysctl prints', () => {
    const swap = parseSwapUsage(
      'vm.swapusage: total = 13312.00M  used = 12043.06M  free = 1268.94M  (encrypted)'
    )

    expect(swap.total).toBe(Math.round(13312.0 * 1024 ** 2))
    expect(swap.used).toBe(Math.round(12043.06 * 1024 ** 2))
  })

  it('handles gigabyte units', () => {
    const swap = parseSwapUsage('vm.swapusage: total = 34.00G  used = 30.50G  free = 3.50G')
    expect(swap.total).toBe(34 * 1024 ** 3)
  })

  it('reports zero rather than NaN when it cannot parse', () => {
    const swap = parseSwapUsage('nonsense')
    expect(swap.total).toBe(0)
    expect(swap.used).toBe(0)
    expect(Number.isNaN(swap.total)).toBe(false)
  })
})

describe('parseBootTime', () => {
  it('reads the format sysctl actually prints', () => {
    expect(
      parseBootTime('{ sec = 1784423058, usec = 44319 } Sat Jul 18 20:04:18 2026')
    ).toBe(1784423058)
  })

  it('returns null rather than a wrong number when it cannot parse', () => {
    expect(parseBootTime('')).toBeNull()
    expect(parseBootTime('command not found')).toBeNull()
  })
})

describe('systemDataReport', () => {
  /*
   * Measured once. Each call shells out to `diskutil apfs list`, `sysctl` and
   * `tmutil`; on a loaded CI runner `diskutil` alone can take several seconds,
   * and three separate calls would put every test in this block within reach of
   * vitest's default per-test timeout for no benefit at all.
   */
  let report: Awaited<ReturnType<typeof systemDataReport>>

  beforeAll(async () => {
    report = await systemDataReport()
  }, 60_000)

  it('runs against this machine and reconciles', () => {
    // Whatever the volumes are, the total outside the data volume has to be
    // their sum — this is the number the UI leads with.
    const expected = report.volumes
      .filter((volume) => volume.role !== 'Data')
      .reduce((sum, volume) => sum + volume.bytes, 0)

    expect(report.outsideData).toBe(expected)
    expect(report.outsideData).toBeGreaterThanOrEqual(0)
  })

  it('never promises more than the VM volume actually holds', () => {
    // A reboot releases swap. It does not release Preboot, Recovery or the
    // sealed system volume, and claiming otherwise would be the exact kind of
    // inflated promise this project exists to avoid.
    expect(report.rebootWouldFree).toBe(report.vmBytes)
    expect(report.rebootWouldFree).toBeLessThanOrEqual(report.outsideData)
  })

  it('reports how long the machine has been up, not this process', () => {
    /*
     * The bug this replaces: the figure came from `process.uptime()`, which is
     * how long the application has been open. It read 0 on a machine that had
     * been up for twenty days, turning the argument for restarting into "you
     * restarted 0 days ago".
     *
     * Asserted as an invariant rather than a magnitude. A machine cannot have
     * booted after a process running on it started, so this holds on a
     * developer's Mac and on a CI runner that booted ninety seconds ago —
     * whereas "greater than a minute" would be a coin flip on the second one.
     */
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(Math.floor(process.uptime()))
    expect(report.uptimeSeconds).toBeGreaterThan(0)
  })
})
