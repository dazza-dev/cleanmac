import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // The filesystem walker runs in worker_threads and therefore needs its
        // own entry point that can be resolved by path at runtime.
        input: {
          index: resolve('src/main/index.ts'),
          'walk-worker': resolve('src/main/scanner/walk-worker.ts')
        },
        output: {
          entryFileNames: '[name].mjs'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          // A sandboxed preload MUST be CommonJS — Electron's sandbox loader
          // cannot evaluate ESM, and an .mjs preload fails with "Cannot use
          // import statement outside a module", leaving window.api undefined.
          // Keeping `sandbox: true` is worth more than matching the ESM output
          // of the rest of the build.
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html')
      }
    },
    plugins: [vue()]
  }
})
