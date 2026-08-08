import { Worker } from 'node:worker_threads'
import { availableParallelism } from 'node:os'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { walk } from './walk'
import type { ScannerPort, SizeReport, WalkOptions, WalkRequest, WalkResponse } from './types'

/**
 * `ScannerPort` backed by a pool of `worker_threads`.
 *
 * The port exists so the walker can be swapped without any rule noticing. A
 * native implementation was planned for v0.4 and turned out not to be needed —
 * see the benchmark note in `walk.ts`.
 */

interface Pending {
  resolve: (report: SizeReport) => void
  reject: (error: Error) => void
}

const WORKER_URL = new URL('./walk-worker.mjs', import.meta.url)

/**
 * The bundled worker only exists in build output. Running from source — tests,
 * or a partial build — falls back to walking inline rather than failing.
 */
const WORKER_AVAILABLE = existsSync(fileURLToPath(WORKER_URL))

export class NodeScanner implements ScannerPort {
  private readonly workers: Worker[] = []
  private readonly idle: Worker[] = []
  private readonly queue: Array<{ request: WalkRequest; pending: Pending }> = []
  private readonly pending = new Map<number, Pending>()
  private nextId = 1
  private disposed = false

  constructor(private readonly poolSize = Math.max(1, availableParallelism() - 1)) {}

  private spawn(): Worker {
    const worker = new Worker(WORKER_URL)

    worker.on('message', (response: WalkResponse) => {
      const pending = this.pending.get(response.id)
      this.pending.delete(response.id)

      if (pending) {
        if (response.ok) pending.resolve(response.report)
        else pending.reject(new Error(response.error))
      }

      this.release(worker)
    })

    worker.on('error', (error) => {
      // A dead worker takes its in-flight job with it. Fail that job, drop the
      // worker, and let the next dispatch spawn a replacement.
      for (const [id, pending] of this.pending) {
        pending.reject(error)
        this.pending.delete(id)
      }
      this.discard(worker)
    })

    this.workers.push(worker)
    return worker
  }

  private discard(worker: Worker): void {
    const poolIndex = this.workers.indexOf(worker)
    if (poolIndex >= 0) this.workers.splice(poolIndex, 1)
    const idleIndex = this.idle.indexOf(worker)
    if (idleIndex >= 0) this.idle.splice(idleIndex, 1)
    void worker.terminate()
  }

  private release(worker: Worker): void {
    const next = this.queue.shift()
    if (next) {
      this.dispatch(worker, next.request, next.pending)
      return
    }
    this.idle.push(worker)
  }

  private dispatch(worker: Worker, request: WalkRequest, pending: Pending): void {
    this.pending.set(request.id, pending)
    worker.postMessage(request)
  }

  private acquire(): Worker | null {
    const free = this.idle.pop()
    if (free) return free
    if (this.workers.length < this.poolSize) return this.spawn()
    return null
  }

  size(target: string, options: WalkOptions = {}): Promise<SizeReport> {
    if (this.disposed) return Promise.reject(new Error('Scanner has been disposed'))

    const request: WalkRequest = {
      id: this.nextId++,
      target,
      maxDepth: options.maxDepth ?? 64,
      exclude: options.exclude ?? []
    }

    // Losing the worker pool should cost speed, not the feature. `walk` is the
    // same code the workers run, so results are identical either way.
    if (!WORKER_AVAILABLE) return walk(request)

    return new Promise<SizeReport>((resolve, reject) => {
      const pending: Pending = { resolve, reject }

      if (options.signal?.aborted) {
        reject(new Error('Scan aborted'))
        return
      }

      options.signal?.addEventListener(
        'abort',
        () => {
          this.pending.delete(request.id)
          reject(new Error('Scan aborted'))
        },
        { once: true }
      )

      const worker = this.acquire()
      if (worker) this.dispatch(worker, request, pending)
      else this.queue.push({ request, pending })
    })
  }

  async sizeAll(targets: string[], options: WalkOptions = {}): Promise<SizeReport[]> {
    return Promise.all(targets.map((target) => this.size(target, options)))
  }

  async dispose(): Promise<void> {
    this.disposed = true
    this.queue.length = 0
    await Promise.all(this.workers.map((worker) => worker.terminate()))
    this.workers.length = 0
    this.idle.length = 0
    this.pending.clear()
  }
}
