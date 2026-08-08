import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { bucketFor, measureTypes, measureStorage } from '../src/main/storage'
import { InlineScanner } from '../src/main/scanner/inline-scanner'

/**
 * The drill-down that turns "WhatsApp: 15.7 GB" into something actionable.
 *
 * Measured on the reference machine, it holds 42,562 thumbnails worth 187 MB
 * against 1,982 videos worth 9.2 GB — the most numerous file type is nearly the
 * smallest. Bucketing by size rather than by count is the point.
 */

describe('bucketFor', () => {
  it('separates regenerable previews from originals', () => {
    // The distinction that matters: a .thumb is a preview WhatsApp will
    // recreate, a .jpg is the photo itself.
    expect(bucketFor('IMG_0001.thumb')).toBe('thumbnail')
    expect(bucketFor('IMG_0001.jpg')).toBe('image')
  })

  it('classifies the types messaging apps actually store', () => {
    expect(bucketFor('clip.mp4')).toBe('video')
    expect(bucketFor('note.opus')).toBe('audio')
    expect(bucketFor('ChatStorage.sqlite')).toBe('database')
    expect(bucketFor('invoice.pdf')).toBe('document')
    expect(bucketFor('backup.zip')).toBe('archive')
  })

  it('is case-insensitive', () => {
    expect(bucketFor('CLIP.MP4')).toBe('video')
    expect(bucketFor('Photo.JPEG')).toBe('image')
  })

  it('falls back to other rather than guessing', () => {
    expect(bucketFor('LICENSE')).toBe('other')
    expect(bucketFor('.hidden')).toBe('other')
    expect(bucketFor('data.weirdext')).toBe('other')
  })
})

describe('measureTypes', () => {
  let sandbox: string

  beforeAll(async () => {
    sandbox = await mkdtemp(path.join(homedir(), 'Library', 'Caches', 'clean-mac-types-'))
    await mkdir(path.join(sandbox, 'nested', 'deeper'), { recursive: true })

    await writeFile(path.join(sandbox, 'a.mp4'), Buffer.alloc(40 * 1024))
    await writeFile(path.join(sandbox, 'b.mp4'), Buffer.alloc(40 * 1024))
    await writeFile(path.join(sandbox, 'nested', 'c.jpg'), Buffer.alloc(8 * 1024))
    await writeFile(path.join(sandbox, 'nested', 'deeper', 'd.thumb'), Buffer.alloc(4 * 1024))
    await writeFile(path.join(sandbox, 'readme'), Buffer.alloc(1024))
  })

  afterAll(async () => {
    await rm(sandbox, { recursive: true, force: true })
  })

  it('walks the whole tree and buckets every file', async () => {
    const result = await measureTypes(sandbox)
    const byKey = Object.fromEntries(result.entries.map((entry) => [entry.key, entry]))

    expect(byKey.video?.files).toBe(2)
    expect(byKey.image?.files).toBe(1)
    expect(byKey.thumbnail?.files).toBe(1)
    expect(byKey.other?.files).toBe(1)
  })

  it('orders buckets largest first', async () => {
    const result = await measureTypes(sandbox)
    const sizes = result.entries.map((entry) => entry.bytes)
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes)
    expect(result.entries[0]?.key).toBe('video')
  })

  it('reports a total that matches the buckets', async () => {
    const result = await measureTypes(sandbox)
    const sum = result.entries.reduce((total, entry) => total + entry.bytes, 0)
    expect(result.totalBytes).toBe(sum)
  })

  it('shows the path in home-relative form', async () => {
    const result = await measureTypes(sandbox)
    expect(result.displayPath.startsWith('~/Library/Caches/')).toBe(true)
  })
})

describe('label disambiguation', () => {
  /**
   * An app usually owns several library directories — Chrome keeps data in
   * Application Support and a cache in Caches — so the same label legitimately
   * appears twice and reads as a duplicated row.
   */
  it('flags only the labels that actually collide', async () => {
    const breakdown = await measureStorage(new InlineScanner())

    const counts = new Map<string, number>()
    for (const entry of breakdown.entries) {
      counts.set(entry.label, (counts.get(entry.label) ?? 0) + 1)
    }

    for (const entry of breakdown.entries) {
      const collides = (counts.get(entry.label) ?? 0) > 1
      expect(
        entry.needsQualifier,
        `${entry.label} (${entry.displayPath}) qualifier should be ${collides}`
      ).toBe(collides)
    }
  })

  it('records which library every entry came from', async () => {
    const breakdown = await measureStorage(new InlineScanner())
    const kinds = ['appSupport', 'caches', 'containers', 'groupContainers']

    for (const entry of breakdown.entries) {
      expect(kinds).toContain(entry.rootKind)

      // The qualifier has to match the path it is describing, or it is worse
      // than no qualifier at all.
      const expected =
        entry.displayPath.includes('/Application Support/')
          ? 'appSupport'
          : entry.displayPath.includes('/Group Containers/')
            ? 'groupContainers'
            : entry.displayPath.includes('/Containers/')
              ? 'containers'
              : 'caches'
      expect(entry.rootKind, entry.displayPath).toBe(expected)
    }
  })
})
