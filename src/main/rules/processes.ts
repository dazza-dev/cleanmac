import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { RunningApps } from './types'

const run = promisify(execFile)

/**
 * Snapshot of what is currently running, taken once per scan and shared by
 * every guard. Shelling out per finding would be far slower and could return
 * inconsistent answers within a single pass.
 */
export async function snapshotRunningApps(): Promise<RunningApps> {
  const bundles = new Set<string>()
  const displayNames = new Map<string, string>()
  const paths: string[] = []

  try {
    // `comm=` prints the full executable path with no header line.
    const { stdout } = await run('/bin/ps', ['-Axo', 'comm='], {
      maxBuffer: 8 * 1024 * 1024
    })

    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue

      paths.push(trimmed.toLowerCase())

      // /Applications/Trae.app/Contents/MacOS/Trae -> "Trae"
      const match = trimmed.match(/\/([^/]+)\.app\//)
      const original = match?.[1]
      if (!original) continue

      const key = original.toLowerCase()
      bundles.add(key)

      // Helper processes ("Trae Helper (Renderer)") are how the same app shows
      // up many times. The shortest spelling is the real application name, and
      // it is the one the user would quit.
      const existing = displayNames.get(key)
      if (!existing || original.length < existing.length) {
        displayNames.set(key, original)
      }
    }
  } catch {
    // If ps is unavailable we return an empty snapshot. Guards treat that as
    // "cannot confirm", and the ones that matter also require a minimum age,
    // so nothing recently touched is removed on the strength of this alone.
  }

  return { bundles, displayNames, paths }
}

const GENERIC_SEGMENTS = new Set([
  'com',
  'org',
  'io',
  'net',
  'co',
  'app',
  'desktop',
  'mac',
  'macos',
  'osx',
  'inc',
  'ltd',
  'software',
  'labs'
])

const UPDATER_SUFFIXES = [
  '.shipit',
  '-shipit',
  '.updater',
  '-updater',
  '.update',
  '-update',
  'updater'
]

/**
 * Derives the vendor token that identifies which app owns a cache directory.
 *
 *   com.trae.app.ShipIt        -> "trae"
 *   zoho-mail-desktop-updater  -> "zoho"
 *   com.postmanlabs.mac.ShipIt -> "postmanlabs"
 *
 * Only the first meaningful segment is used. Matching on every segment would
 * make a directory like `zoho-mail-…` collide with Apple Mail and block a
 * perfectly safe deletion.
 */
export function ownerToken(entryName: string): string | null {
  let base = entryName.toLowerCase()

  for (const suffix of UPDATER_SUFFIXES) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length)
      break
    }
  }

  const segments = base.split(/[.\-_\s]+/).filter(Boolean)
  const meaningful = segments.filter((segment) => !GENERIC_SEGMENTS.has(segment))

  return meaningful[0] ?? segments[0] ?? null
}

const alnum = (value: string): string => value.replace(/[^a-z0-9]/g, '')

const MIN_TOKEN_LENGTH = 4

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length)
  let index = 0
  while (index < limit && a[index] === b[index]) index += 1
  return index
}

/**
 * True when a process that plausibly owns `entryName` is running right now.
 *
 * Matching is on the longest common prefix rather than containment. Neither
 * string reliably contains the other: `com.postmanlabs.mac.ShipIt` yields
 * "postmanlabs" while the running bundle is "Postman Helper" — no containment
 * in either direction, yet obviously the same vendor. The shared prefix
 * ("postman") is what actually identifies them.
 *
 * A four-character floor keeps unrelated apps apart ("zoho" vs "zoom" share
 * only two) while erring toward a false "running" when in doubt: the cost of
 * that is a finding the user unlocks by quitting an app, versus deleting an
 * update payload out from under a live process.
 */
export function runningOwnerOf(entryName: string, running: RunningApps): string | null {
  const token = ownerToken(entryName)
  if (!token || token.length < MIN_TOKEN_LENGTH) return null

  const needle = alnum(token)
  if (needle.length < MIN_TOKEN_LENGTH) return null

  let best: { name: string; score: number } | null = null

  for (const bundle of running.bundles) {
    const candidate = alnum(bundle)
    if (candidate.length < MIN_TOKEN_LENGTH) continue

    const score = commonPrefixLength(candidate, needle)
    if (score >= MIN_TOKEN_LENGTH && (!best || score > best.score)) {
      best = { name: running.displayNames.get(bundle) ?? bundle, score }
    }
  }

  if (best) return best.name

  // A helper without its own .app bundle: we know something owns it, but not
  // what to call it, so the UI falls back to the generic message.
  return running.paths.some((processPath) => processPath.includes(`/${token}`)) ? '' : null
}

/** True when a process that plausibly owns `entryName` is running right now. */
export function isOwnerRunning(entryName: string, running: RunningApps): boolean {
  return runningOwnerOf(entryName, running) !== null
}

/**
 * Looks up a running app by the name a rule declares explicitly.
 *
 * The prefix heuristic in `runningOwnerOf` derives the owner from the directory
 * name, which works for vendor-prefixed bundle ids but not when the two simply
 * differ: a cache directory called `Chrome` belongs to an app called `Google
 * Chrome`, and those share no prefix at all. Rules that know their owner say so
 * and get an exact answer.
 */
export function findRunningApp(appName: string, running: RunningApps): string | null {
  const needle = appName.toLowerCase()

  for (const [key, display] of running.displayNames) {
    // Matches "Google Chrome" and its "Google Chrome Helper" processes, but not
    // an unrelated app that merely contains the word.
    if (key === needle || key.startsWith(needle + ' ')) return display
  }

  return null
}
