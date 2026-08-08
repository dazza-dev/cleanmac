import type { BrowserWindow } from 'electron'
import { NodeScanner } from './scanner/node-scanner'
import type { ScannerPort } from './scanner/types'
import { evaluateRule } from './rules/engine'
import { snapshotRunningApps } from './rules/processes'
import type { Finding, RuleResult } from './rules/types'
import type {
  BlockedApp,
  ScanProgress,
  ScanSummary,
  StorageBreakdown,
  StorageTypeBreakdown,
  LargeFileReport,
  DuplicateReport
} from '../shared/types'
import { measureStorage, measureTypes, findLargeFiles } from './storage'
import { findDuplicates } from './duplicates'
import { modules } from './modules'

/**
 * Owns the current scan and the findings it produced.
 *
 * Findings live here, in the main process, keyed by id. The renderer receives
 * copies and sends back only ids — it never names a path. A compromised UI
 * therefore cannot ask for an arbitrary file to be deleted; it can only refer
 * to something this module already decided was a candidate.
 *
 * The shapes that cross IPC come from `src/shared/types.ts`. Declaring them a
 * second time here is what let `blockedApps` be added on one side only.
 */
export type { ScanProgress, ScanSummary }

let scanner: ScannerPort | null = null
let findings = new Map<string, Finding>()
let currentScan: AbortController | null = null
let lastSummary: ScanSummary | null = null
let lastBreakdown: StorageBreakdown | null = null

function ensureScanner(): ScannerPort {
  if (!scanner) scanner = new NodeScanner()
  return scanner
}

export function getFindings(ids: string[]): Finding[] {
  const resolved: Finding[] = []
  for (const id of ids) {
    const finding = findings.get(id)
    if (finding) resolved.push(finding)
  }
  return resolved
}

export function getSummary(): ScanSummary | null {
  return lastSummary
}

/**
 * Groups findings blocked by a running app, largest first. Only findings whose
 * guard identified the app by name qualify — telling someone "something is
 * running" they cannot name is worse than saying nothing.
 */
export function collectBlockedApps(results: RuleResult[]): BlockedApp[] {
  const byApp = new Map<string, BlockedApp>()

  for (const result of results) {
    for (const finding of result.findings) {
      if (finding.skipped?.reasonKey !== 'guard.appRunningNamed') continue

      const name = finding.skipped.detail
      if (!name) continue

      const existing = byApp.get(name) ?? { name, findingIds: [], bytes: 0 }
      existing.findingIds.push(finding.id)
      existing.bytes += Math.max(0, finding.bytes - finding.sharedBytes)
      byApp.set(name, existing)
    }
  }

  return [...byApp.values()].sort((a, b) => b.bytes - a.bytes)
}

/** On-demand storage breakdown. Slow enough that it is never automatic. */
export async function runStorageBreakdown(): Promise<StorageBreakdown> {
  lastBreakdown = await measureStorage(ensureScanner())
  return lastBreakdown
}

/**
 * Per-type drill-down, restricted to paths the last breakdown actually produced.
 *
 * The renderer supplies a path here, which it never does anywhere else. Walking
 * an arbitrary caller-supplied directory would let a compromised UI enumerate
 * the filesystem, so the path has to be one this process already chose.
 */
export async function runStorageTypes(target: string): Promise<StorageTypeBreakdown> {
  const known = lastBreakdown?.entries.some((entry) => entry.path === target)
  if (!known) throw new Error('Unknown storage path')

  return measureTypes(target)
}

/**
 * M10. Bounded by the caller's thresholds rather than a fixed policy, and
 * always explicit: it sweeps the whole home directory.
 */
export async function runLargeFiles(
  minBytes: number,
  olderThanDays: number
): Promise<LargeFileReport> {
  return findLargeFiles(minBytes, olderThanDays)
}

/** M11. Reads file contents, so it is always an explicit action. */
export async function runDuplicates(minBytes: number): Promise<DuplicateReport> {
  return findDuplicates(minBytes)
}

export function abortScan(): void {
  currentScan?.abort()
  currentScan = null
}

/**
 * Runs every rule, emitting results incrementally. Reporting each module the
 * moment it finishes rather than waiting for the whole pass is what lets the
 * user see value two seconds in instead of forty.
 */
export async function runScan(window: BrowserWindow | null): Promise<ScanSummary> {
  abortScan()

  const controller = new AbortController()
  currentScan = controller

  const startedAt = Date.now()
  const running = await snapshotRunningApps()
  const results: RuleResult[] = []
  const timings: Array<{ ruleId: string; ms: number }> = []
  let bytesSoFar = 0

  findings = new Map()

  const emit = (progress: ScanProgress): void => {
    if (!window || window.isDestroyed()) return
    window.webContents.send('scan:progress', progress)
  }

  const scheduled = modules.flatMap((module) =>
    module.rules.map((rule) => ({ moduleId: module.id, rule }))
  )

  // Announced up front so the progress list is complete from the first frame
  // and rows tick over in place as they land.
  for (const { moduleId, rule } of scheduled) {
    emit({ moduleId, ruleId: rule.id, titleKey: rule.titleKey, state: 'started', bytesSoFar })
  }

  /*
   * Rules run concurrently.
   *
   * Sequentially the worker pool sat idle behind whichever rule was walking a
   * large tree: measured on the reference machine, one dependency-directory
   * rule accounted for fourteen of thirty seconds while six workers did
   * nothing. Results still arrive one rule at a time, so the incremental
   * feedback is unchanged — only the waiting is gone.
   */
  await Promise.all(
    scheduled.map(async ({ moduleId, rule }) => {
      if (controller.signal.aborted) return

      const ruleStarted = Date.now()
      const result = await evaluateRule(rule, {
        scanner: ensureScanner(),
        running,
        signal: controller.signal
      })
      timings.push({ ruleId: rule.id, ms: Date.now() - ruleStarted })

      for (const finding of result.findings) {
        findings.set(finding.id, finding)
      }

      results.push(result)
      bytesSoFar += result.reclaimable

      emit({
        moduleId,
        ruleId: rule.id,
        titleKey: rule.titleKey,
        state: 'finished',
        result,
        bytesSoFar
      })
    })
  )

  // Concurrency means completion order is arbitrary; the catalogue order is
  // what the user should see.
  const order = new Map(scheduled.map(({ rule }, index) => [rule.id, index]))
  results.sort((a, b) => (order.get(a.ruleId) ?? 0) - (order.get(b.ruleId) ?? 0))

  // Slowest rules, for anyone profiling why a scan feels slow. The breadth-first
  // rules — dependency directories and browser caches — dominate; everything
  // else lands in under a second.
  if (process.env.CLEANMAC_DEV_SCAN === '1') {
    const slowest = [...timings].sort((a, b) => b.ms - a.ms).slice(0, 6)
    console.log('[dev] slowest rules: ' + slowest.map((t) => `${t.ruleId}=${t.ms}ms`).join(' '))
  }

  const blockedApps = collectBlockedApps(results)

  const summary: ScanSummary = {
    results,
    totalReclaimable: bytesSoFar,
    blockedApps,
    blockedBytes: blockedApps.reduce((sum, app) => sum + app.bytes, 0),
    startedAt,
    durationMs: Date.now() - startedAt
  }

  lastSummary = summary
  currentScan = null

  // Broadcast rather than relying on the caller's return value: a scan started
  // from the tray never passes through the renderer, so without this the UI
  // would show results with nothing preselected and no blocked-app panel.
  if (window && !window.isDestroyed()) {
    window.webContents.send('scan:complete', summary)
  }

  return summary
}

export async function disposeScanner(): Promise<void> {
  await scanner?.dispose()
  scanner = null
}
