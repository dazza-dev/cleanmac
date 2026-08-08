import { contextBridge, ipcRenderer } from 'electron'

/**
 * The entire surface the renderer gets. Everything is a named function over a
 * fixed channel — no generic `invoke(channel, …)` escape hatch, because that
 * would hand the renderer back the whole IPC namespace.
 *
 * `platform` is a plain value rather than a promise so the first paint can
 * already carry the right platform class and nothing flickers.
 */

const api = {
  platform: process.platform,

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (patch: unknown) => ipcRenderer.invoke('config:set', patch)
  },

  system: {
    disk: () => ipcRenderer.invoke('system:disk'),
    systemData: () => ipcRenderer.invoke('system:systemData'),
    devRoute: () => ipcRenderer.invoke('system:devRoute'),
    permissions: () => ipcRenderer.invoke('system:permissions'),
    openFullDiskAccess: () => ipcRenderer.invoke('system:openFullDiskAccess'),
    version: () => ipcRenderer.invoke('system:version'),
    revealInFinder: (path: string) => ipcRenderer.invoke('system:revealInFinder', path)
  },

  modules: {
    list: () => ipcRenderer.invoke('modules:list')
  },

  scan: {
    run: () => ipcRenderer.invoke('scan:run'),
    abort: () => ipcRenderer.invoke('scan:abort'),
    summary: () => ipcRenderer.invoke('scan:summary'),
    storage: () => ipcRenderer.invoke('scan:storage'),
    storageTypes: (path: string) => ipcRenderer.invoke('scan:storageTypes', path),
    largeFiles: (minBytes: number, olderThanDays: number) =>
      ipcRenderer.invoke('scan:largeFiles', minBytes, olderThanDays),
    duplicates: (minBytes: number) => ipcRenderer.invoke('scan:duplicates', minBytes)
  },

  apps: {
    quit: (name: string) => ipcRenderer.invoke('apps:quit', name)
  },

  cleanup: {
    // Findings are referenced by id. The renderer never sends a filesystem path
    // to anything that can delete.
    preview: (ids: string[]) => ipcRenderer.invoke('cleanup:preview', ids),
    previewCommand: (ruleId: string) => ipcRenderer.invoke('cleanup:previewCommand', ruleId),
    execute: (ids: string[]) => ipcRenderer.invoke('cleanup:execute', ids)
  },

  trash: {
    size: () => ipcRenderer.invoke('trash:size'),
    empty: () => ipcRenderer.invoke('trash:empty')
  },

  history: {
    runs: () => ipcRenderer.invoke('history:runs'),
    items: (runId: number) => ipcRenderer.invoke('history:items', runId),
    total: () => ipcRenderer.invoke('history:total'),
    restore: (runId: number) => ipcRenderer.invoke('history:restore', runId)
  },

  on: {
    scanProgress: (callback: (progress: unknown) => void) => {
      const listener = (_: unknown, progress: unknown): void => callback(progress)
      ipcRenderer.on('scan:progress', listener)
      return () => ipcRenderer.removeListener('scan:progress', listener)
    },
    updateReady: (callback: (version: string) => void) => {
      const listener = (_: unknown, version: string): void => callback(version)
      ipcRenderer.on('update:ready', listener)
      return () => ipcRenderer.removeListener('update:ready', listener)
    },
    menuCommand: (callback: (command: 'settings' | 'clean') => void) => {
      const settings = (): void => callback('settings')
      const clean = (): void => callback('clean')
      ipcRenderer.on('menu:settings', settings)
      ipcRenderer.on('menu:clean', clean)
      return () => {
        ipcRenderer.removeListener('menu:settings', settings)
        ipcRenderer.removeListener('menu:clean', clean)
      }
    },
    scanComplete: (callback: (summary: unknown) => void) => {
      const listener = (_: unknown, summary: unknown): void => callback(summary)
      ipcRenderer.on('scan:complete', listener)
      return () => ipcRenderer.removeListener('scan:complete', listener)
    },
    error: (callback: (payload: { channel: string; message: string }) => void) => {
      const listener = (_: unknown, payload: { channel: string; message: string }): void =>
        callback(payload)
      ipcRenderer.on('app:error', listener)
      return () => ipcRenderer.removeListener('app:error', listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
