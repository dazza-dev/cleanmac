import { describe, it, expect } from 'vitest'
import { parseDockerSize, dockerPrune } from '../../src/main/modules/docker'
import { InlineScanner } from '../../src/main/scanner/inline-scanner'

describe('parseDockerSize', () => {
  it('parses the units docker system df emits', () => {
    expect(parseDockerSize('1.093GB')).toBe(1_093_000_000)
    expect(parseDockerSize('952.6MB')).toBe(952_600_000)
    expect(parseDockerSize('12kB')).toBe(12_000)
    expect(parseDockerSize('0B')).toBe(0)
  })

  it('ignores the percentage docker appends', () => {
    expect(parseDockerSize('1.093GB (58%)')).toBe(1_093_000_000)
  })

  it('returns zero rather than NaN for anything unexpected', () => {
    expect(parseDockerSize('')).toBe(0)
    expect(parseDockerSize('N/A')).toBe(0)
    expect(parseDockerSize('lots')).toBe(0)
  })
})

describe('docker rule', () => {
  it('delegates to the CLI instead of touching files', () => {
    expect(dockerPrune.action).toBe('command')
    expect(dockerPrune.command?.bin).toBe('docker')
    // Deleting Docker's disk image by hand corrupts the installation.
    expect(dockerPrune.roots).toEqual([])
  })

  it('never prunes volumes', () => {
    // A dangling volume routinely holds a development database.
    expect(dockerPrune.command?.execute).not.toContain('--volumes')
    expect(dockerPrune.command?.execute.join(' ')).toBe('system prune -f')
  })

  it('reports rather than acts when docker is unavailable', async () => {
    const findings = await dockerPrune.provider!({
      running: { bundles: new Set(), displayNames: new Map(), paths: [] },
      now: Date.now(),
      // Docker is measured through its own CLI, so the scanner is never touched.
      scanner: new InlineScanner()
    })

    // Either docker is absent (nothing to say) or the daemon is down, in which
    // case the space is still reported so it is not silently unaccounted for.
    for (const finding of findings) {
      if (finding.bytes === 0) expect(finding.skipped).toBeDefined()
    }
  })
})
