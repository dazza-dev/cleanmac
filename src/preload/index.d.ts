import type { Api } from '../shared/types'

export type * from '../shared/types'

declare global {
  interface Window {
    api: Api
  }
}
