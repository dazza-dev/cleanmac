import { describe, it, expect } from 'vitest'
import { diskStats } from '../src/main/disk'
import { labelFor } from '../src/main/storage'

/**
 * Runs against the real machine. The headline claim of this project is that its
 * numbers reconcile, so that is what gets asserted — not a mocked value we
 * chose ourselves.
 */
describe('diskStats', () => {
  it('reconciles: yourData + system + free equals total', async () => {
    const stats = await diskStats()

    const sum = stats.yourData + stats.system + stats.free
    // Sub-1% drift is expected: the three figures are sampled from diskutil and
    // statfs microseconds apart on a live filesystem.
    expect(Math.abs(sum - stats.total) / stats.total).toBeLessThan(0.01)
  })

  it('never reports your data as the whole container minus free', async () => {
    const stats = await diskStats()
    if (stats.approximate) return // no diskutil: the fallback is that figure

    // This is the 34 GB lie v0.1 shipped. `total - free` counts Preboot,
    // Recovery, the sealed system volume and VM swap as if they were the user's.
    expect(stats.yourData).toBeLessThan(stats.total - stats.free)
    expect(stats.system).toBeGreaterThan(0)
  })

  it('produces a sane occupancy percentage', async () => {
    const stats = await diskStats()
    expect(stats.usedPercent).toBeGreaterThan(0)
    expect(stats.usedPercent).toBeLessThanOrEqual(100)
  })

  it('never invents purgeable space', async () => {
    const stats = await diskStats()
    // Absent from diskutil means unknown, which is reported as zero rather than
    // guessed at — purgeable is already counted inside `free`.
    expect(stats.purgeable).toBeGreaterThanOrEqual(0)
    expect(stats.purgeable).toBeLessThanOrEqual(stats.free)
  })
})

describe('labelFor', () => {
  it('turns bundle ids into names a person recognises', () => {
    expect(labelFor('group.net.whatsapp.WhatsApp.shared')).toBe('WhatsApp')
    expect(labelFor('com.docker.docker')).toBe('Docker')
    expect(labelFor('com.tinyapp.TablePlus')).toBe('TablePlus')
  })

  it('strips Apple team id prefixes', () => {
    expect(labelFor('UBF8T346G9.com.microsoft.teams')).toBe('teams')
  })

  it('leaves plain directory names alone', () => {
    expect(labelFor('Homebrew')).toBe('Homebrew')
    expect(labelFor('composer')).toBe('composer')
  })
})
