import { parentPort } from 'node:worker_threads'
import { walk } from './walk'
import type { WalkRequest, WalkResponse } from './types'

/** Worker shell around `walk`. All measurement logic lives in `walk.ts`. */
parentPort?.on('message', (request: WalkRequest) => {
  walk(request)
    .then((report) => {
      const response: WalkResponse = { id: request.id, ok: true, report }
      parentPort!.postMessage(response)
    })
    .catch((error: unknown) => {
      const response: WalkResponse = {
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
      parentPort!.postMessage(response)
    })
})
