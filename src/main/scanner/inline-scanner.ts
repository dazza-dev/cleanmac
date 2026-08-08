import { walk } from './walk'
import type { ScannerPort, SizeReport, WalkOptions } from './types'

/**
 * `ScannerPort` that measures on the calling thread.
 *
 * Used by the test suite so rules can be exercised against a real filesystem
 * fixture without spawning workers, and as the fallback if worker creation ever
 * fails at runtime.

 */
export class InlineScanner implements ScannerPort {
  private id = 1

  async size(target: string, options: WalkOptions = {}): Promise<SizeReport> {
    return walk({
      id: this.id++,
      target,
      maxDepth: options.maxDepth ?? 64,
      exclude: options.exclude ?? []
    })
  }

  async sizeAll(targets: string[], options: WalkOptions = {}): Promise<SizeReport[]> {
    const reports: SizeReport[] = []
    for (const target of targets) {
      reports.push(await this.size(target, options))
    }
    return reports
  }

  async dispose(): Promise<void> {
    // Nothing to release.
  }
}
