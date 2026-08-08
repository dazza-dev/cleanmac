import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  BlockedApp,
  ExecutionReport,
  Finding,
  RuleResult,
  ScanProgress,
  ScanSummary,
  StorageBreakdown,
  StorageTypeBreakdown,
  LargeFileReport,
  DuplicateReport
} from '../../../shared/types'

/** One row of the live progress list. */
export interface ScanStep {
  ruleId: string
  titleKey: string
  state: 'started' | 'finished'
  bytes: number
}

export const useScanStore = defineStore('scan', () => {
  const results = ref<RuleResult[]>([])
  const selectedIds = ref<Set<string>>(new Set())
  const scanning = ref(false)
  const activeRuleId = ref<string | null>(null)
  const bytesSoFar = ref(0)
  const durationMs = ref(0)
  const lastReport = ref<ExecutionReport | null>(null)
  const hasScanned = ref(false)
  const steps = ref<ScanStep[]>([])
  const blockedApps = ref<BlockedApp[]>([])
  const blockedBytes = ref(0)
  const storage = ref<StorageBreakdown | null>(null)
  const measuringStorage = ref(false)
  const types = ref<Record<string, StorageTypeBreakdown>>({})
  const typingPath = ref<string | null>(null)
  const largeFiles = ref<LargeFileReport | null>(null)
  const findingLarge = ref(false)
  const duplicates = ref<DuplicateReport | null>(null)
  const findingDuplicates = ref(false)

  const totalReclaimable = computed(() =>
    results.value.reduce((sum, result) => sum + result.reclaimable, 0)
  )

  const allFindings = computed<Finding[]>(() =>
    results.value.flatMap((result) => result.findings)
  )

  const actionable = computed(() =>
    allFindings.value.filter((finding) => !finding.skipped && finding.action !== 'inspect')
  )

  const selectedFindings = computed(() =>
    actionable.value.filter((finding) => selectedIds.value.has(finding.id))
  )

  const selectedBytes = computed(() =>
    selectedFindings.value.reduce(
      (sum, finding) => sum + Math.max(0, finding.bytes - finding.sharedBytes),
      0
    )
  )

  function isSelected(id: string): boolean {
    return selectedIds.value.has(id)
  }

  function toggle(id: string): void {
    // A new Set is assigned rather than mutated so computed properties that
    // depend on it actually re-evaluate.
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function setSelection(ids: string[]): void {
    selectedIds.value = new Set(ids)
  }

  function selectAll(): void {
    setSelection(actionable.value.map((finding) => finding.id))
  }

  function deselectAll(): void {
    selectedIds.value = new Set()
  }

  function upsertStep(progress: ScanProgress, bytes: number): void {
    const next = steps.value.filter((step) => step.ruleId !== progress.ruleId)
    next.push({
      ruleId: progress.ruleId,
      titleKey: progress.titleKey,
      state: progress.state,
      bytes
    })
    steps.value = next
  }

  /**
   * Applies a finished scan wherever it came from. Preselection is taken from
   * the engine's own `selected` flag — the UI never widens it.
   */
  function applySummary(summary: ScanSummary): void {
    results.value = summary.results
    durationMs.value = summary.durationMs
    hasScanned.value = true
    blockedApps.value = summary.blockedApps
    blockedBytes.value = summary.blockedBytes
    scanning.value = false
    activeRuleId.value = null

    setSelection(
      summary.results
        .flatMap((result) => result.findings)
        .filter((finding) => finding.selected)
        .map((finding) => finding.id)
    )
  }

  function bindProgress(): void {
    // A scan started from the tray never passes through this store, so the
    // completion event is what keeps the UI honest in that path.
    window.api.on.scanComplete(applySummary)

    window.api.on.scanProgress((progress: ScanProgress) => {
      // Progress arriving without a local run() means something else started
      // the scan; reflect that so the UI shows it as running.
      scanning.value = true
      bytesSoFar.value = progress.bytesSoFar

      if (progress.state === 'started') {
        activeRuleId.value = progress.ruleId
        upsertStep(progress, 0)
        return
      }

      upsertStep(progress, progress.result?.reclaimable ?? 0)

      if (progress.result) {
        // Results stream in one rule at a time so the user sees a number within
        // seconds instead of staring at a spinner for the whole pass.
        results.value = [
          ...results.value.filter((existing) => existing.ruleId !== progress.result!.ruleId),
          progress.result
        ]
      }
    })
  }

  /**
   * The storage breakdown walks ~190k files, so it is never automatic. It is
   * the screen that reveals a single app holding 14 GB, which macOS files under
   * "Other" and never explains.
   */
  async function measureStorage(): Promise<void> {
    measuringStorage.value = true
    try {
      storage.value = await window.api.scan.storage()
      types.value = {}
    } finally {
      measuringStorage.value = false
    }
  }

  /**
   * Per-type drill-down of one directory. This is what turns "WhatsApp: 14 GB"
   * into "9 GB of video, 3 GB of photos, 1.4 GB of regenerable thumbnails" —
   * the difference between a number and something you can act on.
   */
  async function measureTypes(path: string): Promise<void> {
    typingPath.value = path
    try {
      types.value = { ...types.value, [path]: await window.api.scan.storageTypes(path) }
    } finally {
      typingPath.value = null
    }
  }

  /**
   * M10. Sweeps the whole home directory, so it is always an explicit action
   * and never part of a scan.
   */
  async function findLargeFilesAction(): Promise<void> {
    findingLarge.value = true
    try {
      largeFiles.value = await window.api.scan.largeFiles(100 * 1000 * 1000, 90)
    } finally {
      findingLarge.value = false
    }
  }

  /**
   * M11. Reads file contents, so it is always an explicit action — and the
   * figure it returns is an upper bound, never a promise.
   */
  async function findDuplicatesAction(): Promise<void> {
    findingDuplicates.value = true
    try {
      duplicates.value = await window.api.scan.duplicates(1024 * 1024)
    } finally {
      findingDuplicates.value = false
    }
  }

  async function run(): Promise<void> {
    scanning.value = true
    results.value = []
    steps.value = []
    bytesSoFar.value = 0
    lastReport.value = null

    try {
      applySummary(await window.api.scan.run())
    } finally {
      scanning.value = false
      activeRuleId.value = null
    }
  }

  async function execute(): Promise<ExecutionReport> {
    const ids = selectedFindings.value.map((finding) => finding.id)
    const report = await window.api.cleanup.execute(ids)
    lastReport.value = report

    // Anything acted on is gone from this scan's results; keeping it visible
    // would invite a second attempt on a path that no longer exists.
    const consumed = new Set([
      ...report.trashed.map((item) => item.path),
      ...report.failed.map((item) => item.path)
    ])

    results.value = results.value.map((result) => ({
      ...result,
      findings: result.findings.filter((finding) => !consumed.has(finding.path))
    }))

    deselectAll()
    return report
  }

  return {
    results,
    scanning,
    activeRuleId,
    bytesSoFar,
    durationMs,
    lastReport,
    hasScanned,
    steps,
    blockedApps,
    blockedBytes,
    storage,
    measuringStorage,
    types,
    typingPath,
    largeFiles,
    findingLarge,
    duplicates,
    findingDuplicates,
    totalReclaimable,
    allFindings,
    actionable,
    selectedFindings,
    selectedBytes,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    setSelection,
    bindProgress,
    measureStorage,
    measureTypes,
    findLargeFiles: findLargeFilesAction,
    findDuplicates: findDuplicatesAction,
    run,
    execute
  }
})
