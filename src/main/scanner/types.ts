/**
 * The scanner is defined as a port so the Node `worker_threads` implementation
 * shipping in v0.1 can be swapped for a native Rust walker later without any
 * cleanup module noticing. A native (Rust) walker was evaluated and dropped:
 * the bottleneck turned out to be libuv's shared thread pool, not the language.
 * See src/main/uv-threadpool.ts.
 */

export interface SizeReport {
  /** Absolute path that was measured. */
  path: string
  /**
   * Bytes actually occupied on disk (allocated size), not the logical file
   * length. A 1-byte file still consumes a full block, and with tens of
   * thousands of small cache files the difference is significant.
   */
  bytes: number
  /** Logical size, kept so the UI can explain the gap when it is large. */
  logicalBytes: number
  /** Number of regular files counted. */
  files: number
  /**
   * Bytes belonging to inodes that were seen more than once (hard links or
   * APFS clones). Deleting one of the copies does not release this space, so
   * it is reported separately instead of being folded into the headline
   * figure.
   */
  sharedBytes: number
  /** Most recent mtime found anywhere in the tree, in epoch milliseconds. */
  newestMtimeMs: number
  /** Directories that could not be read, usually because of TCC. */
  unreadable: string[]
}

export interface WalkOptions {
  /** Stop descending past this depth. Zero means "the root itself only". */
  maxDepth?: number
  /** Absolute paths to skip entirely. */
  exclude?: string[]
  /** Aborts an in-flight measurement. */
  signal?: AbortSignal
}

export interface ScannerPort {
  /** Recursively measures a single path. */
  size(target: string, options?: WalkOptions): Promise<SizeReport>
  /** Measures several paths concurrently across the worker pool. */
  sizeAll(targets: string[], options?: WalkOptions): Promise<SizeReport[]>
  /** Releases the underlying workers. */
  dispose(): Promise<void>
}

/** Message contract between the pool and its workers. */
export interface WalkRequest {
  id: number
  target: string
  maxDepth: number
  exclude: string[]
}

export type WalkResponse =
  | { id: number; ok: true; report: SizeReport }
  | { id: number; ok: false; error: string }
