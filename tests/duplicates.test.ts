import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, link } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { findDuplicates } from '../src/main/duplicates'

/**
 * The three cases that decide whether this module is honest:
 *
 *  - identical content is found, however the copies are named;
 *  - files that merely start the same are not called duplicates;
 *  - hard links are shown but never counted, because deleting one frees
 *    nothing.
 *
 * Every call scopes the search to the fixture directory. Searching the real
 * home made the first version of this test fail for a reason that had nothing
 * to do with the code: the machine had 86 genuine duplicate groups, and the
 * fixtures ranked below the result limit.
 */

const MB = 1024 * 1024
let sandbox: string

/** A buffer that is identical up to `divergeAt`, then differs. */
function content(size: number, marker: number, divergeAt = 0): Buffer {
  const buffer = Buffer.alloc(size, 0x41)
  if (divergeAt < size) buffer[divergeAt] = marker
  return buffer
}

beforeAll(async () => {
  sandbox = await mkdtemp(path.join(homedir(), 'Downloads', 'cleanmac-dup-'))
  await mkdir(path.join(sandbox, 'nested'), { recursive: true })

  // Two genuine duplicates with different names, in different directories.
  const identical = content(2 * MB, 0x42)
  await writeFile(path.join(sandbox, 'report.pdf'), identical)
  await writeFile(path.join(sandbox, 'nested', 'report-copy.pdf'), identical)

  // Same size, same first 4 KB, different later — must survive pass 2 and be
  // rejected by pass 3. Without the full-content pass this would be a false
  // positive, which for a duplicate finder is the whole ballgame.
  await writeFile(path.join(sandbox, 'a.bin'), content(2 * MB, 0x01, 1_000_000))
  await writeFile(path.join(sandbox, 'b.bin'), content(2 * MB, 0x02, 1_000_000))

  // One file, two names.
  await writeFile(path.join(sandbox, 'original.iso'), content(3 * MB, 0x43))
  await link(path.join(sandbox, 'original.iso'), path.join(sandbox, 'linked.iso'))

  // Below the floor: identical, but too small to be worth a row.
  await writeFile(path.join(sandbox, 'tiny-1.txt'), 'same')
  await writeFile(path.join(sandbox, 'tiny-2.txt'), 'same')
})

afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true })
})

function groupContaining(
  report: Awaited<ReturnType<typeof findDuplicates>>,
  name: string
): (typeof report.groups)[number] | undefined {
  return report.groups.find((group) =>
    group.files.some((file) => file.path.endsWith(name))
  )
}

describe('findDuplicates', () => {
  it('finds byte-identical files under different names', async () => {
    const report = await findDuplicates(MB, 40, [sandbox])
    const group = groupContaining(report, 'report.pdf')

    expect(group).toBeDefined()
    expect(group?.distinctCopies).toBe(2)
    expect(group?.files.map((f) => path.basename(f.path)).sort()).toEqual([
      'report-copy.pdf',
      'report.pdf'
    ])
  })

  it('does not call files duplicates just because they start the same', async () => {
    const report = await findDuplicates(MB, 40, [sandbox])

    // Same size and same first 4 KB — only reading the whole file separates
    // them. A two-pass implementation would report these and be wrong.
    expect(groupContaining(report, 'a.bin')).toBeUndefined()
    expect(groupContaining(report, 'b.bin')).toBeUndefined()
  })

  it('shows hard links but counts them as one file', async () => {
    const report = await findDuplicates(MB, 40, [sandbox])
    const group = groupContaining(report, 'original.iso')

    expect(group).toBeDefined()
    expect(group?.files).toHaveLength(2)
    expect(group?.hardLinked).toBe(true)

    // Two names, one inode: deleting one frees nothing, so nothing is claimed.
    expect(group?.distinctCopies).toBe(1)
    expect(group?.reclaimable).toBe(0)
  })

  it('claims only the extra copies, never the original', async () => {
    const report = await findDuplicates(MB, 40, [sandbox])
    const group = groupContaining(report, 'report.pdf')

    // Two copies of 2 MB is 2 MB reclaimable, not 4 MB — one has to stay.
    expect(group?.reclaimable).toBe(group!.bytes * (group!.distinctCopies - 1))
    expect(group?.reclaimable).toBe(2 * MB)
  })

  it('ignores files below the size floor', async () => {
    const report = await findDuplicates(MB, 40, [sandbox])
    expect(groupContaining(report, 'tiny-1.txt')).toBeUndefined()
  })

  it('reads far fewer files than it inspects', async () => {
    const report = await findDuplicates(MB, 40, [sandbox])

    // The point of the three passes: hashing is the expensive part, so almost
    // nothing should reach it.
    expect(report.hashed).toBeLessThan(report.scanned)
    expect(report.totalReclaimable).toBeGreaterThanOrEqual(2 * MB)
  })

  it('never reports a group with a single copy', async () => {
    const report = await findDuplicates(MB, 40, [sandbox])
    for (const group of report.groups) {
      expect(group.files.length).toBeGreaterThan(1)
    }
  })
})
