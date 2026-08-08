import type { CleanupRule } from '../rules/types'
import { minAge, notRunning, writable } from '../rules/guards'

/**
 * M9 — System leftovers.
 *
 * Everything macOS accumulates that no app claims. Most of it is small; the
 * exceptions (Xcode's DerivedData, simulator runtimes, iOS backups) are the
 * largest single items on a developer's machine.
 */

/** Crash logs and diagnostic reports. Never touched by anything else. */
export const logs: CleanupRule = {
  id: 'system.logs',
  moduleId: 'system',
  category: 'system',
  titleKey: 'rules.logs.title',
  explainKey: 'rules.logs.explain',
  risk: 'none',
  roots: ['~/Library/Logs'],
  depth: 1,
  match: { type: 'glob', patterns: ['*'] },
  guards: [minAge(14), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 5 * 1024 * 1024
}

/**
 * Window positions and restore state. Deleting them costs a fresh window layout
 * next launch, which is why the owning app must be closed first — a running app
 * rewrites its state on quit and would simply recreate the file.
 */
export const savedState: CleanupRule = {
  id: 'system.saved-state',
  moduleId: 'system',
  category: 'system',
  titleKey: 'rules.savedState.title',
  explainKey: 'rules.savedState.explain',
  risk: 'low',
  roots: ['~/Library/Saved Application State'],
  depth: 1,
  match: { type: 'glob', patterns: ['*.savedState'] },
  guards: [minAge(30), notRunning(), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 1024 * 1024
}

/**
 * Xcode build intermediates. Rebuilt on the next compile, and routinely the
 * biggest directory on a machine that has ever opened Xcode.
 */
export const derivedData: CleanupRule = {
  id: 'system.xcode-derived-data',
  moduleId: 'system',
  category: 'system',
  titleKey: 'rules.derivedData.title',
  explainKey: 'rules.derivedData.explain',
  risk: 'low',
  roots: ['~/Library/Developer/Xcode/DerivedData'],
  depth: 1,
  match: { type: 'glob', patterns: ['*'] },
  guards: [minAge(7), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 50 * 1024 * 1024
}

/** Xcode archives are release artefacts — the only copy of a shipped build. */
export const xcodeArchives: CleanupRule = {
  id: 'system.xcode-archives',
  moduleId: 'system',
  category: 'system',
  titleKey: 'rules.xcodeArchives.title',
  explainKey: 'rules.xcodeArchives.explain',
  risk: 'high',
  roots: ['~/Library/Developer/Xcode/Archives'],
  depth: 1,
  match: { type: 'glob', patterns: ['*'] },
  guards: [],
  action: 'inspect',
  regenerates: false,
  minBytes: 100 * 1024 * 1024
}

/**
 * Simulator runtimes and devices. Reported only: removing a device by hand
 * leaves CoreSimulator's index inconsistent, and `simctl delete unavailable`
 * is the supported route. Wiring that up is a v0.3 job.
 */
export const simulators: CleanupRule = {
  id: 'system.simulators',
  moduleId: 'system',
  category: 'system',
  titleKey: 'rules.simulators.title',
  explainKey: 'rules.simulators.explain',
  risk: 'medium',
  roots: ['~/Library/Developer/CoreSimulator/Devices'],
  depth: 1,
  match: { type: 'glob', patterns: ['*'] },
  guards: [],
  action: 'inspect',
  regenerates: true,
  minBytes: 100 * 1024 * 1024
}

/**
 * iPhone and iPad backups. These are the user's photos, messages and app data,
 * often the only copy in existence. Reported so the user knows where the space
 * went; never actionable from this app.
 */
export const iosBackups: CleanupRule = {
  id: 'system.ios-backups',
  moduleId: 'system',
  category: 'system',
  titleKey: 'rules.iosBackups.title',
  explainKey: 'rules.iosBackups.explain',
  risk: 'high',
  roots: ['~/Library/Application Support/MobileSync/Backup'],
  depth: 1,
  match: { type: 'glob', patterns: ['*'] },
  guards: [],
  action: 'inspect',
  regenerates: false,
  minBytes: 100 * 1024 * 1024
}

export const rules: CleanupRule[] = [
  logs,
  savedState,
  derivedData,
  xcodeArchives,
  simulators,
  iosBackups
]
