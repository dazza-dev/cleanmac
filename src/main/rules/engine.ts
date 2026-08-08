import { opendir, lstat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import type { ScannerPort } from '../scanner/types'
import type {
  CleanupRule,
  Finding,
  RuleContext,
  RuleResult,
  RunningApps,
  SkipReason
} from './types'
import { runGuards } from './guards'
import { snapshotRunningApps } from './processes'
import { assertSafeResolved, expandHome, UnsafePathError } from './safe-path'

/**
 * Turns declarative rules into findings. The engine only ever *reports*; the
 * executor is the single place allowed to act on what comes out of here.
 */

const HOME = homedir()

/**
 * Minimal shell-glob matcher over a basename. Only `*` and `?` are supported,
 * which covers every pattern the rule catalogue needs and avoids taking on a
 * dependency for something that must be auditable at a glance.
 */
export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const expanded = escaped.replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${expanded}$`, 'i')
}

export function matchesAny(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(name))
}

/** `/Users/me/Library/Caches/x` -> `~/Library/Caches/x` */
export function displayPath(absolute: string): string {
  return absolute.startsWith(HOME + path.sep) ? `~${absolute.slice(HOME.length)}` : absolute
}

/** Collects entries matching a rule, walking at most `depth` levels down. */
async function collectCandidates(rule: CleanupRule): Promise<string[]> {
  const found: string[] = []

  const descend = async (dir: string, depth: number): Promise<void> => {
    let handle
    try {
      handle = await opendir(dir)
    } catch {
      return // missing root or TCC denial; both are non-fatal
    }

    try {
      for await (const entry of handle) {
        const full = path.join(dir, entry.name)

        if (matchesAny(entry.name, rule.match.patterns)) {
          found.push(full)
          continue // never descend into something already marked
        }

        if (entry.isDirectory() && depth > 1) {
          await descend(full, depth - 1)
        }
      }
    } catch {
      // Directory vanished mid-iteration. Whatever we already collected stands.
    }
  }

  for (const root of rule.roots) {
    await descend(expandHome(root), rule.depth)
  }

  return found
}

export interface EvaluateOptions {
  scanner: ScannerPort
  running?: RunningApps
  signal?: AbortSignal
  onProgress?: (ruleId: string, bytes: number) => void
}

/**
 * Preselection is decided here, in one place: never for `inspect`, never when a
 * guard objected, and never above "low" risk. The UI cannot widen this.
 */
function isSelectable(rule: CleanupRule, skipped: SkipReason | null): boolean {
  if (skipped) return false
  if (rule.action === 'inspect') return false
  return rule.risk === 'none' || rule.risk === 'low'
}

async function evaluateProvider(
  rule: CleanupRule,
  options: EvaluateOptions,
  running: RunningApps,
  now: number
): Promise<Finding[]> {
  const produced = await rule.provider!({ running, now, scanner: options.scanner })
  const findings: Finding[] = []

  for (const item of produced) {
    if (rule.minBytes !== undefined && item.bytes < rule.minBytes) continue

    findings.push({
      id: `${rule.id}::${item.path}`,
      ruleId: rule.id,
      moduleId: rule.moduleId,
      path: item.path,
      displayPath: displayPath(item.path),
      bytes: item.bytes,
      logicalBytes: item.bytes,
      sharedBytes: 0,
      files: item.files ?? 0,
      mtimeMs: item.mtimeMs ?? now,
      risk: rule.risk,
      action: rule.action,
      regenerates: rule.regenerates,
      selected: isSelectable(rule, item.skipped ?? null),
      ...(item.skipped ? { skipped: item.skipped } : {}),
      ...(item.label ? { label: item.label } : {}),
      unreadable: 0
    })
  }

  return findings
}

export async function evaluateRule(
  rule: CleanupRule,
  options: EvaluateOptions
): Promise<RuleResult> {
  const running = options.running ?? (await snapshotRunningApps())
  const now = Date.now()

  const findings: Finding[] = rule.provider
    ? await evaluateProvider(rule, options, running, now)
    : []

  const candidates = rule.provider ? [] : await collectCandidates(rule)

  // Everything cheap happens first: structural safety, stat, guards. Only what
  // survives is measured, and measurement is the expensive part by orders of
  // magnitude — a single node_modules tree is hundreds of thousands of files.
  const viable: Array<{ candidate: string; stat: Stats; skipped: SkipReason | null }> = []

  for (const candidate of candidates) {
    if (options.signal?.aborted) break

    // Only deletions are filtered here: an inspect-only rule is allowed to
    // *report* on data we would never touch, which is what makes rows like the
    // iOS backups possible.
    if (rule.action === 'trash') {
      try {
        assertSafeResolved(path.normalize(candidate))
      } catch (error) {
        if (error instanceof UnsafePathError) continue
        throw error
      }
    }

    let stat
    try {
      stat = await lstat(candidate)
    } catch {
      continue
    }

    const context: RuleContext = {
      path: candidate,
      name: path.basename(candidate),
      stat,
      running,
      now
    }

    viable.push({ candidate, stat, skipped: await runGuards(rule.guards, context) })
  }

  // Measured together so the worker pool is actually used. Sequentially this
  // was the difference between a two-second scan and a thirty-second one.
  const reports = await options.scanner.sizeAll(
    viable.map((entry) => entry.candidate),
    { signal: options.signal }
  )

  for (const [index, entry] of viable.entries()) {
    const report = reports[index]
    if (!report) continue

    if (rule.minBytes !== undefined && report.bytes < rule.minBytes) continue

    findings.push({
      id: `${rule.id}::${entry.candidate}`,
      ruleId: rule.id,
      moduleId: rule.moduleId,
      path: entry.candidate,
      displayPath: displayPath(entry.candidate),
      bytes: report.bytes,
      logicalBytes: report.logicalBytes,
      sharedBytes: report.sharedBytes,
      files: report.files,
      mtimeMs: entry.stat.mtimeMs,
      risk: rule.risk,
      action: rule.action,
      regenerates: rule.regenerates,
      selected: isSelectable(rule, entry.skipped),
      ...(entry.skipped ? { skipped: entry.skipped } : {}),
      unreadable: report.unreadable.length
    })

    options.onProgress?.(rule.id, report.bytes)
  }

  findings.sort((a, b) => b.bytes - a.bytes)

  // Shared bytes are subtracted: those blocks are also referenced elsewhere, so
  // removing this copy would not hand them back. Reporting them in the total
  // is exactly the inflation this project exists to avoid.
  const reclaimable = findings
    .filter((finding) => !finding.skipped && finding.action !== 'inspect')
    .reduce((sum, finding) => sum + Math.max(0, finding.bytes - finding.sharedBytes), 0)

  return {
    ruleId: rule.id,
    moduleId: rule.moduleId,
    titleKey: rule.titleKey,
    explainKey: rule.explainKey,
    risk: rule.risk,
    action: rule.action,
    regenerates: rule.regenerates,
    findings,
    reclaimable
  }
}
