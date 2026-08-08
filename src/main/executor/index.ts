import { shell } from 'electron'
import { lstat, rename, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import path from 'node:path'
import type { Finding, RunningApps } from '../rules/types'
import { findRule } from '../modules'
import { runGuards } from '../rules/guards'
import { snapshotRunningApps } from '../rules/processes'
import { assertSafeToTrash, UnsafePathError } from '../rules/safe-path'
import { finishRun, recordItem, startRun, listItems } from '../db'

const run = promisify(execFile)

/**
 * The only place in this codebase permitted to modify the filesystem.
 *
 * `fs.rm` and friends appear nowhere: every removal goes through
 * `shell.trashItem`, which hands the item to the system Trash and leaves the
 * user a Put Back. Emptying the Trash is a separate action the user approves
 * on its own.
 */

export interface ExecutionItem {
  path: string
  displayPath: string
  bytes: number
  ok: boolean
  reasonKey?: string
  detail?: string
}

export interface ExecutionReport {
  runId: number
  trashed: ExecutionItem[]
  skipped: ExecutionItem[]
  failed: ExecutionItem[]
  bytesReclaimed: number
}

async function revalidate(
  finding: Finding,
  running: RunningApps
): Promise<{ ok: true } | { ok: false; reasonKey: string; detail?: string }> {
  const rule = findRule(finding.ruleId)
  if (!rule) return { ok: false, reasonKey: 'skip.unknownRule' }

  let stat
  try {
    stat = await lstat(finding.path)
  } catch {
    return { ok: false, reasonKey: 'skip.vanished' }
  }

  // Minutes can pass between the scan and the click. Anything that changed in
  // the meantime is no longer the thing the user approved.
  if (stat.mtimeMs > finding.mtimeMs) {
    return { ok: false, reasonKey: 'skip.modifiedSinceScan' }
  }

  const guardFailure = await runGuards(rule.guards, {
    path: finding.path,
    name: path.basename(finding.path),
    stat,
    running,
    now: Date.now()
  })

  if (guardFailure) {
    return { ok: false, reasonKey: guardFailure.reasonKey, detail: guardFailure.detail }
  }

  return { ok: true }
}

async function trashOne(finding: Finding): Promise<void> {
  // Resolves symlinks and re-checks the allowlist. This runs on every single
  // item, immediately before the deletion — not once when the rule was written.
  await assertSafeToTrash(finding.path)
  await shell.trashItem(finding.path)
}

async function which(bin: string): Promise<string | null> {
  try {
    const { stdout } = await run('/usr/bin/which', [bin])
    const resolved = stdout.trim()
    return resolved.length > 0 ? resolved : null
  } catch {
    return null
  }
}

/** Runs a rule's reporting command so the UI can show what it would do. */
export async function previewCommand(ruleId: string): Promise<string> {
  const rule = findRule(ruleId)
  if (!rule?.command) throw new Error(`Rule ${ruleId} has no command`)

  const bin = await which(rule.command.bin)
  if (!bin) throw new Error(`${rule.command.bin} is not installed`)

  const { stdout, stderr } = await run(bin, rule.command.dryRun, {
    maxBuffer: 4 * 1024 * 1024,
    timeout: 60_000
  })
  return (stdout + stderr).trim()
}

async function executeCommand(finding: Finding): Promise<string> {
  const rule = findRule(finding.ruleId)
  if (!rule?.command) throw new Error(`Rule ${finding.ruleId} has no command`)

  const bin = await which(rule.command.bin)
  if (!bin) throw new Error(`${rule.command.bin} is not installed`)

  const { stdout, stderr } = await run(bin, rule.command.execute, {
    maxBuffer: 4 * 1024 * 1024,
    timeout: 10 * 60_000
  })
  return (stdout + stderr).trim()
}

export async function execute(findings: Finding[]): Promise<ExecutionReport> {
  const running = await snapshotRunningApps()
  const runId = startRun()

  const report: ExecutionReport = {
    runId,
    trashed: [],
    skipped: [],
    failed: [],
    bytesReclaimed: 0
  }

  for (const finding of findings) {
    const base: ExecutionItem = {
      path: finding.path,
      displayPath: finding.displayPath,
      bytes: finding.bytes,
      ok: false
    }

    if (finding.action === 'inspect') {
      report.skipped.push({ ...base, reasonKey: 'skip.inspectOnly' })
      recordItem(runId, finding, 'skipped', 'inspect-only')
      continue
    }

    const valid = await revalidate(finding, running)
    if (!valid.ok) {
      report.skipped.push({ ...base, reasonKey: valid.reasonKey, detail: valid.detail })
      recordItem(runId, finding, 'skipped', valid.reasonKey)
      continue
    }

    try {
      if (finding.action === 'command') {
        const output = await executeCommand(finding)
        report.trashed.push({ ...base, ok: true, detail: output.slice(0, 2000) })
        recordItem(runId, finding, 'trashed', 'command')
      } else {
        await trashOne(finding)
        report.trashed.push({ ...base, ok: true })
        recordItem(runId, finding, 'trashed')
      }

      // Shared blocks stay alive elsewhere, so they are not counted as freed.
      report.bytesReclaimed += Math.max(0, finding.bytes - finding.sharedBytes)
    } catch (error) {
      const message =
        error instanceof UnsafePathError
          ? error.reason
          : error instanceof Error
            ? error.message
            : String(error)

      report.failed.push({ ...base, reasonKey: 'skip.failed', detail: message })
      recordItem(runId, finding, 'failed', message)
    }
  }

  finishRun(runId, report.bytesReclaimed, report.trashed.length)
  return report
}

/**
 * Best-effort undo. `shell.trashItem` does not report where the item landed,
 * so the original basename is looked up in ~/.Trash. macOS renames on
 * collision, so an item whose name was taken cannot be restored automatically —
 * that case is reported rather than guessed at.
 */
export async function restoreRun(runId: number): Promise<{ restored: number; failed: number }> {
  const trashDir = path.join(homedir(), '.Trash')
  let restored = 0
  let failed = 0

  for (const item of listItems(runId)) {
    if (item.outcome !== 'trashed') continue

    const candidate = path.join(trashDir, path.basename(item.path))

    try {
      await access(candidate, constants.F_OK)
      await access(item.path, constants.F_OK).then(
        () => {
          throw new Error('destination already exists')
        },
        () => undefined
      )
      await rename(candidate, item.path)
      restored += 1
    } catch {
      failed += 1
    }
  }

  return { restored, failed }
}

/** Empties the Trash. Always a separate, explicitly approved step. */
export async function emptyTrash(): Promise<void> {
  await run('/usr/bin/osascript', [
    '-e',
    'tell application "Finder" to empty the trash'
  ])
}

/** Total bytes currently sitting in the Trash. */
export async function trashSize(): Promise<number> {
  try {
    const { stdout } = await run('/usr/bin/du', ['-sk', path.join(homedir(), '.Trash')])
    const kilobytes = Number.parseInt(stdout.trim().split(/\s+/)[0] ?? '0', 10)
    return Number.isFinite(kilobytes) ? kilobytes * 1024 : 0
  } catch {
    return 0
  }
}
