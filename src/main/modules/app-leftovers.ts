import { readdir, readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import path from 'node:path'

const run = promisify(execFile)
import type { CleanupRule, ProviderContext, ProviderFinding } from '../rules/types'

/**
 * M7 — Support files belonging to applications that are no longer installed.
 *
 * Dragging an app to the Trash leaves everything else behind: preferences,
 * caches, saved state, container directories. Finding them means proving a
 * negative — "no installed application claims this bundle id" — and proving it
 * wrongly deletes the settings of an app the user still uses.
 *
 * This is the module with the highest false-positive risk in the catalogue,
 * which is why it was written last and why it is deliberately timid:
 *
 *  - Bundle ids are read from every app's `Info.plist`, never guessed from the
 *    application's display name.
 *  - A directory is only a candidate if its name *is* a reverse-DNS bundle id.
 *  - If any installed app shares the vendor prefix (`com.google.*`), nothing
 *    under that vendor is reported at all. Vendors ship helpers, extensions and
 *    daemons that have no `.app` of their own, and mistaking one of those for
 *    an abandoned app is exactly the failure mode to avoid.
 *  - Apple's own bundle ids are never touched.
 *  - Nothing here is ever preselected. The user reads the path and decides.
 *
 * The cost of all that caution is that some genuine leftovers go unreported.
 * That is the correct direction for this trade.
 */

const HOME = homedir()

/** Everywhere an application can legitimately live. */
const APP_DIRS = [
  '/Applications',
  '/Applications/Utilities',
  '/System/Applications',
  '/System/Applications/Utilities',
  path.join(HOME, 'Applications'),
  '/Applications/Setapp'
]

/** Library directories whose children are named after a bundle id. */
const SUPPORT_DIRS = [
  'Library/Application Support',
  'Library/Caches',
  'Library/Containers',
  'Library/HTTPStorages',
  'Library/WebKit',
  'Library/Saved Application State'
]

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_AGE_DAYS = 90

/** Vendors whose data is never reported, whatever the inventory says. */
const PROTECTED_PREFIXES = ['com.apple.', 'group.com.apple.', 'com.microsoft.autoupdate']

/** `com.example.app.savedState` → `com.example.app` */
function normaliseBundleId(name: string): string | null {
  let id = name
    .replace(/\.savedState$/, '')
    .replace(/\.binarycookies$/, '')
    .replace(/^[A-Z0-9]{10}\./, '') // Apple team id prefix on group containers
    .replace(/^group\./, '')

  // Must actually look like a reverse-DNS identifier. Anything else — "Google",
  // "Homebrew", "node-gyp" — is a plain directory name and out of scope here.
  const segments = id.split('.')
  if (segments.length < 3) return null
  if (segments.some((segment) => segment.length === 0)) return null
  if (!/^[a-zA-Z0-9.\-_]+$/.test(id)) return null

  id = segments.join('.')
  return id
}

/** `com.google.Chrome` → `com.google` */
function vendorOf(bundleId: string): string {
  return bundleId.split('.').slice(0, 2).join('.')
}

/**
 * Reads an application's bundle identifier.
 *
 * **`Info.plist` is frequently a binary property list, not XML.** On the
 * reference machine 4 of 19 applications ship one — WhatsApp among them. An
 * XML-only regex silently returns null for those, which makes an installed app
 * look uninstalled and turns its container into a deletion candidate. That is
 * the single worst failure this module can have, and it happened: the first
 * implementation flagged a running WhatsApp's 900 MB container, saved only by
 * an unrelated age guard.
 *
 * The regex stays as a fast path because it avoids a subprocess for the common
 * case; `plutil` handles every format and is the authority when it fails.
 */
export async function bundleIdOf(appPath: string): Promise<string | null> {
  const plistPath = path.join(appPath, 'Contents', 'Info.plist')

  try {
    const plist = await readFile(plistPath, 'utf8')
    const match = plist.match(/<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/)
    if (match?.[1]) return match[1].trim()
  } catch {
    // Unreadable as text, or not there. plutil gets the next word.
  }

  try {
    const { stdout } = await run('/usr/bin/plutil', [
      '-extract',
      'CFBundleIdentifier',
      'raw',
      '-o',
      '-',
      plistPath
    ])
    const id = stdout.trim()
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}

/** Every bundle id currently installed, and every vendor that owns one. */
export async function installedBundleIds(): Promise<{
  ids: Set<string>
  vendors: Set<string>
}> {
  const ids = new Set<string>()
  const vendors = new Set<string>()

  for (const dir of APP_DIRS) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    const apps = entries
      .filter((entry) => entry.name.endsWith('.app'))
      .map((entry) => path.join(dir, entry.name))

    for (const id of await Promise.all(apps.map(bundleIdOf))) {
      if (!id) continue
      ids.add(id.toLowerCase())
      vendors.add(vendorOf(id).toLowerCase())
    }
  }

  return { ids, vendors }
}

async function provider(context: ProviderContext): Promise<ProviderFinding[]> {
  const installed = await installedBundleIds()

  // An empty inventory means something went wrong reading /Applications.
  // Reporting every support directory as orphaned would be catastrophic, so we
  // report nothing instead.
  if (installed.ids.size === 0) return []

  const candidates: Array<{ full: string; bundleId: string }> = []

  for (const relative of SUPPORT_DIRS) {
    const root = path.join(HOME, relative)

    let entries
    try {
      entries = await readdir(root, { withFileTypes: true })
    } catch {
      continue // missing, or TCC denied
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const bundleId = normaliseBundleId(entry.name)
      if (!bundleId) continue

      const lower = bundleId.toLowerCase()
      if (PROTECTED_PREFIXES.some((prefix) => lower.startsWith(prefix))) continue
      if (installed.ids.has(lower)) continue

      // The conservative bit: one installed app from this vendor is enough to
      // leave everything of theirs alone.
      if (installed.vendors.has(vendorOf(lower))) continue

      candidates.push({ full: path.join(root, entry.name), bundleId })
    }
  }

  const reports = await context.scanner.sizeAll(candidates.map((entry) => entry.full))

  return candidates.flatMap((candidate, index) => {
    const report = reports[index]
    if (!report) return []

    const ageDays = Math.floor((context.now - report.newestMtimeMs) / DAY_MS)

    return [
      {
        path: candidate.full,
        bytes: report.bytes,
        files: report.files,
        mtimeMs: report.newestMtimeMs,
        label: candidate.bundleId,
        ...(ageDays < MIN_AGE_DAYS
          ? { skipped: { reasonKey: 'guard.recentlyUsed', detail: String(ageDays) } }
          : {})
      }
    ]
  })
}

export const appLeftovers: CleanupRule = {
  id: 'system.app-leftovers',
  moduleId: 'app-leftovers',
  category: 'app-leftovers',
  titleKey: 'rules.appLeftovers.title',
  explainKey: 'rules.appLeftovers.explain',
  // Medium so it is never preselected, however confident the matching looks.
  risk: 'medium',
  roots: [],
  depth: 0,
  match: { type: 'glob', patterns: [] },
  guards: [],
  action: 'trash',
  regenerates: false,
  provider,
  minBytes: 5 * 1024 * 1024
}

export const rules: CleanupRule[] = [appLeftovers]
