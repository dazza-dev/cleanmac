/// <reference types="vite/client" />

import type { Api } from '../../shared/types'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare global {
  interface Window {
    // Typed from the shared contract, not from the preload implementation:
    // the implementation's inferred signatures are deliberately loose because
    // ipcRenderer.invoke returns `any`.
    api: Api
  }
}
