import { opendir, readdir, lstat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { ScannerPort } from './scanner/types'
import type {
  StorageRootKind,
  LargeFile,
  LargeFileReport,
  StorageBreakdown,
  StorageEntry,
  StorageTypeBreakdown
} from '../shared/types'

/**
 * Measures where the user's data actually sits.
 *
 * This is the screen macOS refuses to give you. Settings → Storage lumps
 * everything into "Applications", "Documents" and the infamous "Other", so a
 * single app holding 14 GB of photos is invisible. Here every directory is
 * named, sized and sorted.
 *
 * It measures — it never marks anything for deletion. Several of the biggest
 * entries are irreplaceable user data, and the point is to show them, not to
 * offer a button.
 */

const HOME = homedir()

/** Bounds how much is put in flight at once; mirrors the walker's approach. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

/**
 * Roots whose *children* are measured individually. One level down is where
 * per-app directories live, which is the granularity that answers "what is
 * eating my disk".
 */
const ROOTS: Array<{ path: string; kind: StorageRootKind }> = [
  { path: path.join(HOME, 'Library/Application Support'), kind: 'appSupport' },
  { path: path.join(HOME, 'Library/Group Containers'), kind: 'groupContainers' },
  { path: path.join(HOME, 'Library/Containers'), kind: 'containers' },
  { path: path.join(HOME, 'Library/Caches'), kind: 'caches' }
]

/** Entries smaller than this are folded away; the list is for big fish. */
const MIN_ENTRY_BYTES = 100 * 1024 * 1024

/**
 * Directories holding the user's own irreplaceable content.
 *
 * These are surfaced here rather than as cleanup rules on purpose. WhatsApp's
 * container alone is 66,000 files: measuring it during every scan cost twelve
 * seconds to produce a row that can never be acted on. This view already walks
 * it once, on demand, and can say far more about it — so this is where it lives,
 * flagged so the answer to "why is there no checkbox" is on screen.
 */
const USER_DATA_DIRS = new Set([
  'group.net.whatsapp.WhatsApp.shared',
  'net.whatsapp.WhatsApp',
  'com.microsoft.teams2',
  'ru.keepcoder.Telegram',
  'Telegram Desktop',
  'MobileSync',
  'com.apple.mail',
  'Photos',
  'com.apple.Photos'
])

const KNOWN_LABELS: Record<string, string> = {
  'group.net.whatsapp.WhatsApp.shared': 'WhatsApp',
  'net.whatsapp.WhatsApp': 'WhatsApp',
  'com.docker.docker': 'Docker',
  Claude: 'Claude',
  Google: 'Google Chrome',
  Trae: 'Trae',
  'com.microsoft.teams2': 'Microsoft Teams',
  Homebrew: 'Homebrew'
}

/**
 * Turns a directory name into something a person recognises.
 * `group.net.whatsapp.WhatsApp.shared` → `WhatsApp`.
 */
export function labelFor(name: string): string {
  const known = KNOWN_LABELS[name]
  if (known) return known

  // Strip an Apple team-id prefix: "UBF8T346G9.com.microsoft.teams".
  const base = name.replace(/^[A-Z0-9]{10}\./, '').replace(/^group\./, '')

  if (!base.includes('.')) return base

  const segments = base.split('.').filter(Boolean)
  // Reverse-DNS: the last meaningful segment is usually the product name.
  const skip = new Set(['shared', 'app', 'macos', 'mac', 'desktop', 'osx'])
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]!
    if (!skip.has(segment.toLowerCase())) return segment
  }

  return base
}

/**
 * File-type buckets for the drill-down.
 *
 * `.thumb` gets its own bucket rather than being counted as an image, because
 * a regenerable preview and an original photo are not the same thing to a
 * person deciding what to keep.
 *
 * Measuring the reference machine's WhatsApp container also settled an
 * assumption this code was written on. Thumbnails are by far the most numerous
 * files and among the smallest in total:
 *
 *   video       1,982 files    9.2 GB
 *   photos     19,038 files    5.1 GB
 *   audio       2,131 files    294 MB
 *   thumbnails 42,562 files    187 MB   ← most files, almost no space
 *
 * Which is the argument for this whole view: file count is a terrible proxy
 * for size, and a breakdown that only counted files would point at exactly the
 * wrong thing.
 */
const TYPE_BUCKETS: Array<{ key: string; extensions: string[] }> = [
  { key: 'video', extensions: ['mp4', 'mov', 'm4v', 'avi', '3gp', 'webm', 'mkv'] },
  { key: 'image', extensions: ['jpg', 'jpeg', 'png', 'heic', 'gif', 'webp', 'tiff', 'bmp'] },
  { key: 'audio', extensions: ['opus', 'm4a', 'mp3', 'wav', 'caf', 'aac', 'ogg', 'amr'] },
  { key: 'thumbnail', extensions: ['thumb', 'thumbnail', 'favicon'] },
  { key: 'database', extensions: ['sqlite', 'db', 'sqlite-wal', 'sqlite-shm', 'realm'] },
  { key: 'document', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'] },
  { key: 'archive', extensions: ['zip', 'gz', 'tar', 'rar', '7z', 'bz2'] }
]

const EXTENSION_TO_BUCKET = new Map<string, string>(
  TYPE_BUCKETS.flatMap((bucket) => bucket.extensions.map((ext) => [ext, bucket.key]))
)

export function bucketFor(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return 'other'
  return EXTENSION_TO_BUCKET.get(fileName.slice(dot + 1).toLowerCase()) ?? 'other'
}

/**
 * Buckets one directory tree by file type.
 *
 * On-demand only: WhatsApp's container alone is 66,000 files, which has no
 * business running inside every cleanup scan.
 */
export async function measureTypes(
  root: string,
  signal?: AbortSignal
): Promise<StorageTypeBreakdown> {
  const started = Date.now()
  const totals = new Map<string, { bytes: number; files: number }>()
  let unreadable = 0

  const stack: string[] = [root]

  while (stack.length > 0) {
    if (signal?.aborted) break
    const current = stack.pop()!

    let dir
    try {
      dir = await opendir(current)
    } catch {
      unreadable += 1
      continue
    }

    try {
      for await (const entry of dir) {
        const full = path.join(current, entry.name)

        if (entry.isDirectory()) {
          stack.push(full)
          continue
        }

        if (!entry.isFile()) continue

        let info
        try {
          info = await lstat(full)
        } catch {
          continue
        }

        const key = bucketFor(entry.name)
        const bucket = totals.get(key) ?? { bytes: 0, files: 0 }
        bucket.bytes += info.blocks * 512
        bucket.files += 1
        totals.set(key, bucket)
      }
    } catch {
      unreadable += 1
    }
  }

  const entries = [...totals.entries()]
    .map(([key, value]) => ({ key, bytes: value.bytes, files: value.files }))
    .sort((a, b) => b.bytes - a.bytes)

  return {
    path: root,
    displayPath: root.startsWith(HOME + path.sep) ? `~${root.slice(HOME.length)}` : root,
    entries,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    unreadable,
    durationMs: Date.now() - started
  }
}

/**
 * M10 — the biggest individual files in the home directory.
 *
 * A breadth-first sweep, which is why it is on demand and not part of a scan:
 * it crosses the whole home directory rather than a handful of known roots.
 *
 * Reported only. These are, by construction, the user's own files — installer
 * disk images, video exports, database dumps — and the app has no way to know
 * which of them matter. `~/Library` is skipped entirely: everything in there is
 * already covered by rules that understand what it is.
 */
const LARGE_FILE_EXCLUDES = new Set([
  'Library',
  '.Trash',
  'node_modules',
  '.git',
  'Applications'
])

export async function findLargeFiles(
  minBytes: number,
  olderThanDays: number,
  limit = 60
): Promise<LargeFileReport> {
  const started = Date.now()
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  const found: LargeFile[] = []
  let scanned = 0
  let unreadable = 0

  let level = [HOME]
  let depth = 0
  const MAX_DEPTH = 8

  while (level.length > 0 && depth <= MAX_DEPTH) {
    const nextLevel: string[] = []

    for (const dirs of chunk(level, 64)) {
      const listings = await Promise.all(
        dirs.map(async (dir) => {
          try {
            return { dir, entries: await readdir(dir, { withFileTypes: true }) }
          } catch {
            unreadable += 1
            return null
          }
        })
      )

      const files: string[] = []

      for (const listing of listings) {
        if (!listing) continue

        for (const entry of listing.entries) {
          if (LARGE_FILE_EXCLUDES.has(entry.name)) continue
          // Bundles (.app, .photoslibrary) are single items to a person, not
          // trees to rummage through.
          if (entry.name.startsWith('.') || entry.name.includes('.app')) continue

          const full = path.join(listing.dir, entry.name)
          if (entry.isDirectory()) nextLevel.push(full)
          else if (entry.isFile()) files.push(full)
        }
      }

      for (const batch of chunk(files, 512)) {
        const stats = await Promise.all(
          batch.map(async (file) => ({ file, stat: await lstat(file).catch(() => null) }))
        )

        for (const { file, stat } of stats) {
          if (!stat) continue
          scanned += 1

          const bytes = stat.blocks * 512
          if (bytes < minBytes) continue
          // `atime` is unreliable on macOS (noatime-ish), so last modification
          // is the honest signal for "you have not used this".
          if (stat.mtimeMs > cutoff) continue

          found.push({
            path: file,
            displayPath: file.startsWith(HOME + path.sep) ? `~${file.slice(HOME.length)}` : file,
            bytes,
            mtimeMs: stat.mtimeMs
          })
        }
      }
    }

    level = nextLevel
    depth += 1
  }

  found.sort((a, b) => b.bytes - a.bytes)

  return {
    files: found.slice(0, limit),
    totalFound: found.length,
    totalBytes: found.reduce((sum, file) => sum + file.bytes, 0),
    scanned,
    unreadable,
    durationMs: Date.now() - started
  }
}

async function childrenOf(
  root: { path: string; kind: StorageRootKind }
): Promise<Array<{ path: string; kind: StorageRootKind }>> {
  try {
    const dir = await opendir(root.path)
    const children: Array<{ path: string; kind: StorageRootKind }> = []
    for await (const entry of dir) {
      if (entry.isDirectory()) {
        children.push({ path: path.join(root.path, entry.name), kind: root.kind })
      }
    }
    return children
  } catch {
    return [] // missing root or TCC denial
  }
}

export async function measureStorage(
  scanner: ScannerPort,
  signal?: AbortSignal
): Promise<StorageBreakdown> {
  const started = Date.now()

  const targets = (await Promise.all(ROOTS.map(childrenOf))).flat()
  const reports = await scanner.sizeAll(
    targets.map((target) => target.path),
    { signal }
  )

  const entries: StorageEntry[] = []
  let unreadable = 0
  let measuredBytes = 0

  for (const [index, report] of reports.entries()) {
    unreadable += report.unreadable.length
    measuredBytes += report.bytes

    if (report.bytes < MIN_ENTRY_BYTES) continue

    const name = path.basename(report.path)
    entries.push({
      path: report.path,
      displayPath: report.path.startsWith(HOME + path.sep)
        ? `~${report.path.slice(HOME.length)}`
        : report.path,
      label: labelFor(name),
      rootKind: targets[index]?.kind ?? 'appSupport',
      needsQualifier: false,
      bytes: report.bytes,
      files: report.files,
      unreadable: report.unreadable.length,
      userData: USER_DATA_DIRS.has(name)
    })
  }

  /*
   * An app usually owns several of these directories — Chrome keeps data in
   * Application Support and a cache in Caches — so the same label legitimately
   * appears twice. Read quickly that looks like a duplicate row, so the ones
   * that collide get told apart by which library they came from. Entries with a
   * unique label are left alone rather than all carrying a qualifier nobody
   * needs.
   */
  const labelCounts = new Map<string, number>()
  for (const entry of entries) {
    labelCounts.set(entry.label, (labelCounts.get(entry.label) ?? 0) + 1)
  }
  for (const entry of entries) {
    entry.needsQualifier = (labelCounts.get(entry.label) ?? 0) > 1
  }

  entries.sort((a, b) => b.bytes - a.bytes)

  return {
    entries,
    measuredBytes,
    unreadable,
    durationMs: Date.now() - started,
    measuredAt: Date.now()
  }
}
