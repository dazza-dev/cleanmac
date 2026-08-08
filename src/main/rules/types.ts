import type { Stats } from 'node:fs'
import type { Risk, ActionKind, SkipReason, Finding, RuleResult } from '../../shared/types'
import type { ScannerPort } from '../scanner/types'

/**
 * Types that cross the IPC boundary live in `src/shared/types.ts` and are
 * re-exported here so rule authors have a single import. Everything defined
 * below is main-process only — it references `fs.Stats` and functions, neither
 * of which can be structured-cloned to the renderer.
 *
 * `Risk`   — how much the user stands to lose if a finding is removed.
 * `Action` — `trash` moves to the system Trash, `command` delegates to the tool
 *            that owns the data (brew, docker), `inspect` never deletes.
 */
export type { Risk, ActionKind, SkipReason, Finding, RuleResult }

export interface RunningApps {
  /** Lowercased `.app` bundle names currently running. */
  bundles: Set<string>
  /**
   * Lowercased bundle name → the name as macOS spells it, so the UI can say
   * "Quit Trae" rather than "quit trae".
   */
  displayNames: Map<string, string>
  /** Lowercased full executable paths, for matching helpers without a bundle. */
  paths: string[]
}

export interface RuleContext {
  /** Absolute path of the candidate. */
  path: string
  /** Basename of the candidate. */
  name: string
  stat: Stats
  running: RunningApps
  now: number
}

export type GuardResult = { ok: true } | { ok: false; reasonKey: string; detail?: string }

export interface Guard {
  id: string
  check(context: RuleContext): Promise<GuardResult> | GuardResult
}

export interface Matcher {
  type: 'glob'
  /** Shell-style patterns matched against the entry basename. */
  patterns: string[]
}

export interface CommandSpec {
  /** Executable, looked up on PATH before the rule is offered. */
  bin: string
  /** Arguments that only report what would happen. */
  dryRun: string[]
  /** Arguments that actually reclaim the space. */
  execute: string[]
}

export interface CleanupRule {
  id: string
  moduleId: string
  category: string
  /** i18n keys — every user-facing string is translated. */
  titleKey: string
  explainKey: string
  risk: Risk
  /** Roots to search, `~` allowed. */
  roots: string[]
  match: Matcher
  /** How far below each root to look for matches. 1 = direct children. */
  depth: number
  guards: Guard[]
  action: ActionKind
  /** Whether the data comes back on its own after deletion. */
  regenerates: boolean
  /** Findings below this size are dropped — not worth a row or the risk. */
  minBytes?: number
  /** Required when `action` is `command`. */
  command?: CommandSpec
  /**
   * Escape hatch for data that is not a set of directories under a root —
   * Docker's layers, for instance, which only its own CLI can measure. When
   * present the engine calls this instead of walking the filesystem.
   *
   * A provider still produces ordinary findings, so guards, preselection rules
   * and the executor's path safety all apply unchanged.
   */
  provider?: (context: ProviderContext) => Promise<ProviderFinding[]>
}

export interface ProviderContext {
  running: RunningApps
  now: number
  /** Providers that produce filesystem findings need to measure them. */
  scanner: ScannerPort
}

/** What a provider returns; the engine fills in the rest of the `Finding`. */
export interface ProviderFinding {
  /** Absolute path for display and, when the action is `trash`, for deletion. */
  path: string
  bytes: number
  files?: number
  mtimeMs?: number
  /** Set when the provider itself decided this one cannot be acted on. */
  skipped?: SkipReason
  /** Overrides the rule's title for this specific row. */
  label?: string
}

