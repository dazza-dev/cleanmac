import type { CleanupRule } from '../rules/types'
import { minAge, notRunning, writable } from '../rules/guards'

/**
 * M1 — Auto-update leftovers.
 *
 * Squirrel.Mac (the updater behind most Electron apps) downloads the new
 * version as a zip, installs it, and never cleans up. electron-updater does the
 * same in `<app>-updater/pending`. One copy accumulates per update, forever.
 *
 * Verified contents on a real machine:
 *   ~/Library/Caches/com.trae.app.ShipIt/     ShipItState.plist, a 25 MB
 *                                             stderr log, update.XXXX staging
 *   ~/Library/Caches/zoho-mail-desktop-updater/
 *                                             update.zip, pending/*.zip
 *
 * Deliberately NOT matched: `~/Library/Application Support/*Updater`. Google's
 * `GoogleUpdater` directory holds the installed updater itself (versioned
 * payload, `Current` symlink, prefs) rather than spent downloads — removing it
 * would break Chrome's ability to update.
 */
export const updaterResidue: CleanupRule = {
  id: 'updater.residue',
  moduleId: 'updater-residue',
  category: 'updater-residue',
  titleKey: 'rules.updaterResidue.title',
  explainKey: 'rules.updaterResidue.explain',
  risk: 'none',
  roots: ['~/Library/Caches'],
  depth: 1,
  match: {
    type: 'glob',
    patterns: ['*.ShipIt', '*-updater', '*.ShipIt.*']
  },
  guards: [
    // A rollback can still be in flight right after an update, so anything
    // touched in the last week is left alone.
    minAge(7),
    notRunning(),
    writable()
  ],
  action: 'trash',
  regenerates: false,
  minBytes: 1024 * 1024
}

export const rules: CleanupRule[] = [updaterResidue]
