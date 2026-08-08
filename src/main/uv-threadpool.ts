/**
 * Sizes libuv's filesystem thread pool. **This module must be imported first.**
 *
 * libuv creates the pool lazily, on the first asynchronous fs/dns/crypto call,
 * and reads `UV_THREADPOOL_SIZE` exactly once at that moment. A later
 * assignment is silently ignored — which is why this lives in its own module:
 * ES module imports are hoisted, so an assignment written between `import`
 * statements would still run after every one of them had been evaluated.
 * Import order, on the other hand, is guaranteed.
 *
 * Why it matters here more than in most apps: `worker_threads` do *not* get
 * their own pool. Every walker thread queues its `readdir` and `lstat` calls
 * into this same set of threads, so at the default of four they mostly wait on
 * each other. Measured on the reference machine, a full scan:
 *
 *   pool of  4 (default)   8524 ms
 *   pool of 32             4136 ms
 *   pool of 64             3988 ms
 *
 * Past ~64 the disk, not the scheduler, is the limit. The value is left
 * overridable so anyone profiling can try their own.
 */
process.env.UV_THREADPOOL_SIZE ??= '64'

export const UV_THREADPOOL_SIZE = Number(process.env.UV_THREADPOOL_SIZE)
