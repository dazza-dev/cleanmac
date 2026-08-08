/**
 * Types shared by the main process, the preload bridge and the renderer.
 *
 * They live outside all three so nobody has to import across a process
 * boundary to describe a value that crosses it. Anything here must be
 * structured-clone friendly — it travels over IPC.
 */

export type Risk = 'none' | 'low' | 'medium' | 'high'
export type ActionKind = 'trash' | 'command' | 'inspect'

export interface SkipReason {
  reasonKey: string
  detail?: string
}

export interface Finding {
  id: string
  ruleId: string
  moduleId: string
  path: string
  displayPath: string
  bytes: number
  logicalBytes: number
  sharedBytes: number
  files: number
  mtimeMs: number
  risk: Risk
  action: ActionKind
  regenerates: boolean
  selected: boolean
  skipped?: SkipReason
  unreadable: number
  /** Row-specific label, used by rules whose findings are not plain directories. */
  label?: string
}

export interface RuleResult {
  ruleId: string
  moduleId: string
  titleKey: string
  explainKey: string
  risk: Risk
  action: ActionKind
  regenerates: boolean
  findings: Finding[]
  reclaimable: number
}

export interface ScanSummary {
  results: RuleResult[]
  totalReclaimable: number
  /**
   * Space that a rule matched but could not act on because its owning app is
   * open. Surfaced separately so the UI can offer to quit them instead of
   * quietly showing a smaller number.
   */
  blockedApps: BlockedApp[]
  blockedBytes: number
  startedAt: number
  durationMs: number
}

export interface ScanProgress {
  moduleId: string
  ruleId: string
  /** Carried on both events so the UI can name a rule before it finishes. */
  titleKey: string
  state: 'started' | 'finished'
  result?: RuleResult
  bytesSoFar: number
}

export interface SystemVolume {
  /** APFS role: Data, VM, Preboot, Recovery, System. */
  role: string
  bytes: number
  /** i18n key explaining what this volume is for, when there is one. */
  noteKey?: string
}

/**
 * The contents of what macOS calls "System Data". Inspection only — every
 * figure here is either a whole APFS volume or an operating-system file, and
 * none of it is a cleaner's to delete.
 */
export interface SystemDataReport {
  volumes: SystemVolume[]
  /** Everything in the container that is not the data volume. */
  outsideData: number
  vmBytes: number
  swapTotal: number
  swapUsed: number
  sleepImageBytes: number
  uptimeSeconds: number
  /** Local Time Machine snapshots, invisible in the Finder. */
  snapshots: string[]
  /** What a restart would release. Swap only grows between reboots. */
  rebootWouldFree: number
}

export interface DiskStats {
  /** Size of the whole APFS container. */
  total: number
  /**
   * Space used by the data volume — the user's own files. This is the number
   * that means something to a person, and it is NOT `total - free`.
   */
  yourData: number
  /**
   * The other volumes sharing the container: Preboot, Recovery, the sealed
   * system volume and VM swap. Real, occupied, and not the user's to delete.
   * Reported so `yourData + system + free` reconciles with `total`.
   */
  system: number
  free: number
  /**
   * Caches macOS would release under pressure. Already counted inside `free`,
   * so it is never added to a reclaimable total. Zero when macOS does not
   * report it.
   */
  purgeable: number
  /** Container occupancy — what actually governs APFS degradation. */
  usedPercent: number
  /** True when the figures came from statfs because diskutil was unavailable. */
  approximate: boolean
}

/** Which library a storage entry came from. */
export type StorageRootKind = 'appSupport' | 'caches' | 'containers' | 'groupContainers'

/** One measured directory in the storage breakdown. */
export interface StorageEntry {
  path: string
  displayPath: string
  /** Human label, e.g. "WhatsApp" — derived from the bundle id when possible. */
  label: string
  bytes: number
  files: number
  rootKind: StorageRootKind
  /**
   * True when another entry shares this label, so the UI should say which
   * library it came from. False when the label is already unambiguous.
   */
  needsQualifier: boolean
  /** Directories that could not be read, almost always TCC. */
  unreadable: number
  /**
   * Holds the user's own irreplaceable content. Flagged so the UI can say why
   * there is no delete button rather than leaving its absence unexplained.
   */
  userData: boolean
}

export interface StorageTypeEntry {
  /** i18n key suffix: video, image, audio, thumbnail, database, document… */
  key: string
  bytes: number
  files: number
}

/** Per-file-type drill-down of a single directory. */
export interface StorageTypeBreakdown {
  path: string
  displayPath: string
  entries: StorageTypeEntry[]
  totalBytes: number
  unreadable: number
  durationMs: number
}

/** One oversized, untouched file. Reported only — never actionable. */
export interface LargeFile {
  path: string
  displayPath: string
  bytes: number
  mtimeMs: number
}

export interface LargeFileReport {
  files: LargeFile[]
  totalFound: number
  totalBytes: number
  scanned: number
  unreadable: number
  durationMs: number
}

/** One name for a byte-identical file. */
export interface DuplicateFile {
  path: string
  displayPath: string
  /** `dev:ino`. Two entries sharing this are one file with two names. */
  inode: string
}

export interface DuplicateGroup {
  /** Size of a single copy. */
  bytes: number
  files: DuplicateFile[]
  /** Distinct inodes — how many copies really exist on disk. */
  distinctCopies: number
  /**
   * Upper bound on what deleting the extra copies would free. APFS clones are
   * invisible to `stat`, so the real figure can be lower. Never a promise.
   */
  reclaimable: number
  /** Some entries are the same inode, so they free nothing at all. */
  hardLinked: boolean
}

export interface DuplicateReport {
  groups: DuplicateGroup[]
  totalGroups: number
  totalReclaimable: number
  scanned: number
  /** Distinct files that had to be opened — the cost the passes exist to cut. */
  hashed: number
  unreadable: number
  durationMs: number
}

export interface StorageBreakdown {
  entries: StorageEntry[]
  measuredBytes: number
  /** Total directories skipped for lack of permission, across every root. */
  unreadable: number
  durationMs: number
  measuredAt: number
}

/** An app holding findings hostage by being open. */
export interface BlockedApp {
  /** Display name shown to the user, e.g. "Trae". */
  name: string
  /** Findings blocked by this app. */
  findingIds: string[]
  bytes: number
}

export interface PermissionState {
  fullDiskAccess: boolean
  blocked: string[]
}

export interface ModuleInfo {
  id: string
  titleKey: string
  descriptionKey: string
  order: number
  ruleIds: string[]
}

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
}

export interface AppConfig {
  locale: string | null
  window: WindowState
  warnThresholdPercent: number
  permissionPromptDismissed: boolean
}

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

export interface RunRecord {
  id: number
  startedAt: string
  finishedAt: string | null
  bytesReclaimed: number
  itemCount: number
}

export type ItemOutcome = 'trashed' | 'skipped' | 'failed' | 'restored'

export interface ItemRecord {
  id: number
  runId: number
  ruleId: string
  path: string
  bytes: number
  outcome: ItemOutcome
  detail: string | null
  createdAt: string
}

export interface CleanupPreview {
  count: number
  bytes: number
  paths: string[]
}

/** Exactly what `window.api` exposes. */
export interface Api {
  platform: string
  config: {
    get(): Promise<AppConfig>
    set(patch: Partial<AppConfig>): Promise<AppConfig>
  }
  system: {
    disk(): Promise<DiskStats>
    systemData(): Promise<SystemDataReport>
    /** Development only; null in a packaged build. */
    devRoute(): Promise<string | null>
    permissions(): Promise<PermissionState>
    openFullDiskAccess(): Promise<void>
    version(): Promise<string>
    revealInFinder(path: string): Promise<void>
  }
  modules: {
    list(): Promise<ModuleInfo[]>
  }
  scan: {
    run(): Promise<ScanSummary>
    abort(): Promise<void>
    summary(): Promise<ScanSummary | null>
    storage(): Promise<StorageBreakdown>
    /** Drill-down by file type. Only paths from the last breakdown are accepted. */
    storageTypes(path: string): Promise<StorageTypeBreakdown>
    largeFiles(minBytes: number, olderThanDays: number): Promise<LargeFileReport>
    duplicates(minBytes: number): Promise<DuplicateReport>
  }
  apps: {
    /** Resolves true when the app actually quit, false if it is still up. */
    quit(name: string): Promise<boolean>
  }
  cleanup: {
    preview(ids: string[]): Promise<CleanupPreview>
    previewCommand(ruleId: string): Promise<string>
    execute(ids: string[]): Promise<ExecutionReport>
  }
  trash: {
    size(): Promise<number>
    empty(): Promise<void>
  }
  history: {
    runs(): Promise<RunRecord[]>
    items(runId: number): Promise<ItemRecord[]>
    total(): Promise<number>
    restore(runId: number): Promise<{ restored: number; failed: number }>
  }
  on: {
    scanProgress(callback: (progress: ScanProgress) => void): () => void
    /** Fires for every scan, including ones started from the tray. */
    scanComplete(callback: (summary: ScanSummary) => void): () => void
    /** An update is downloaded and will install on quit. */
    updateReady(callback: (version: string) => void): () => void
    /** Menu items that need the renderer to act. */
    menuCommand(callback: (command: 'settings' | 'clean') => void): () => void
    /** Development only — never emitted by a packaged build. */
    error(callback: (payload: { channel: string; message: string }) => void): () => void
  }
}
