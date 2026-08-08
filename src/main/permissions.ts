import { readdir } from 'node:fs/promises'
import { shell } from 'electron'
import { homedir } from 'node:os'
import path from 'node:path'

/**
 * Full Disk Access detection.
 *
 * TCC has no API to ask "do I have this permission?", so the only reliable
 * check is to attempt a read that is impossible without it. `~/Library/
 * Application Support/com.apple.TCC` is the canonical probe: it always exists
 * and is unreadable without Full Disk Access.
 */

const PROBES = [
  path.join(homedir(), 'Library', 'Application Support', 'com.apple.TCC'),
  path.join(homedir(), 'Library', 'Safari')
]

export async function hasFullDiskAccess(): Promise<boolean> {
  for (const probe of PROBES) {
    try {
      await readdir(probe)
      return true
    } catch {
      continue
    }
  }
  return false
}

/**
 * Opens the exact pane the user needs. Granting cannot be automated: macOS
 * requires the user to toggle the app in System Settings themselves, and the
 * app must then restart for the new permission to take effect.
 */
export async function openFullDiskAccessSettings(): Promise<void> {
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
  )
}

export interface PermissionState {
  fullDiskAccess: boolean
  /** Roots that are currently unreadable, for an honest "not scanned" notice. */
  blocked: string[]
}

/*
 * Locations that are genuinely unreadable without Full Disk Access.
 *
 * An earlier version probed `~/Library/Containers` and `~/Library/Group
 * Containers`, which are readable by anyone — it is their *contents* TCC
 * protects. So `blocked` came back empty even with the permission denied, and
 * the UI reported no blind spots while having plenty. These four actually fail.
 */
const OPTIONAL_ROOTS = [
  path.join(homedir(), 'Library', 'Safari'),
  path.join(homedir(), 'Library', 'Mail'),
  path.join(homedir(), 'Library', 'Messages'),
  path.join(homedir(), 'Library', 'Containers', 'com.apple.Safari', 'Data')
]

export async function permissionState(): Promise<PermissionState> {
  const blocked: string[] = []

  for (const root of OPTIONAL_ROOTS) {
    try {
      await readdir(root)
    } catch (error) {
      // A missing directory is not a permission problem — plenty of Macs have
      // never opened Mail. Only EPERM/EACCES counts as a blind spot.
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EPERM' || code === 'EACCES') blocked.push(root)
    }
  }

  return {
    fullDiskAccess: await hasFullDiskAccess(),
    blocked
  }
}
