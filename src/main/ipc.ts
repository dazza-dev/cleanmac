import { ipcMain, shell, BrowserWindow, app } from 'electron'
import { loadConfig, saveConfig, type AppConfig } from './config'
import { diskStats } from './disk'
import { systemDataReport } from './system-data'
import { resolveDevRoute } from './dev-route'
import { openFullDiskAccessSettings, permissionState } from './permissions'
import {
  runScan,
  abortScan,
  getFindings,
  getSummary,
  runStorageBreakdown,
  runStorageTypes,
  runLargeFiles,
  runDuplicates
} from './scan'
import { quitApp } from './apps'
import { execute, previewCommand, emptyTrash, trashSize, restoreRun } from './executor'
import { listRuns, listItems, totalReclaimed } from './db'
import { modules } from './modules'
import { setLocale, type Locale } from './i18n'

/**
 * IPC surface.
 *
 * Two rules hold this together:
 *  1. The renderer sends finding *ids*, never paths.
 *  2. Every handler is wrapped so a thrown error reaches the user as a banner
 *     instead of an unhandled rejection in a process they cannot see.
 */

function handle<T>(channel: string, fn: (...args: never[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await fn(...(args as never[]))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      BrowserWindow.fromWebContents(event.sender)?.webContents.send('app:error', {
        channel,
        message
      })
      throw error
    }
  })
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  handle('config:get', () => loadConfig())
  handle('config:set', async (patch: Partial<AppConfig>) => {
    const next = await saveConfig(patch)
    if (patch.locale) setLocale(patch.locale as Locale)
    return next
  })

  handle('system:disk', () => diskStats())
  handle('system:systemData', () => systemDataReport())

  /*
   * The dev route is pulled by the renderer, not pushed to it. See dev-route.ts
   * for why — the push raced against Vue mounting and lost, silently.
   */
  handle('system:devRoute', () => resolveDevRoute(app.isPackaged))
  handle('system:permissions', () => permissionState())
  handle('system:openFullDiskAccess', () => openFullDiskAccessSettings())
  handle('system:version', () => app.getVersion())
  handle('system:revealInFinder', (path: string) => {
    // Reveals only. `showItemInFolder` cannot modify anything, so passing a
    // renderer-supplied path here is safe.
    shell.showItemInFolder(path)
  })

  handle('modules:list', () =>
    modules.map((module) => ({
      id: module.id,
      titleKey: module.titleKey,
      descriptionKey: module.descriptionKey,
      order: module.order,
      ruleIds: module.rules.map((rule) => rule.id)
    }))
  )

  handle('scan:run', () => runScan(getWindow()))
  handle('scan:abort', () => abortScan())
  handle('scan:summary', () => getSummary())
  handle('scan:storage', () => runStorageBreakdown())
  handle('scan:storageTypes', (target: string) => runStorageTypes(target))
  handle('scan:largeFiles', (minBytes: number, olderThanDays: number) =>
    runLargeFiles(minBytes, olderThanDays)
  )
  handle('scan:duplicates', (minBytes: number) => runDuplicates(minBytes))

  // Quitting is restricted to apps that are actually running and is always a
  // graceful AppleScript quit — see src/main/apps.ts.
  handle('apps:quit', (name: string) => quitApp(name))

  handle('cleanup:preview', (ids: string[]) => {
    const findings = getFindings(ids)
    return {
      count: findings.length,
      bytes: findings.reduce(
        (sum, finding) => sum + Math.max(0, finding.bytes - finding.sharedBytes),
        0
      ),
      paths: findings.map((finding) => finding.displayPath)
    }
  })

  handle('cleanup:previewCommand', (ruleId: string) => previewCommand(ruleId))
  handle('cleanup:execute', (ids: string[]) => execute(getFindings(ids)))

  handle('trash:size', () => trashSize())
  handle('trash:empty', () => emptyTrash())

  handle('history:runs', () => listRuns())
  handle('history:items', (runId: number) => listItems(runId))
  handle('history:total', () => totalReclaimed())
  handle('history:restore', (runId: number) => restoreRun(runId))
}
