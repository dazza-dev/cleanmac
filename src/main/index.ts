// Must be the first import: sizes libuv's fs thread pool before anything can
// trigger its lazy creation. See the module for why it cannot be a plain
// assignment here.
import './uv-threadpool'

import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig, saveConfig } from './config'
import { registerIpc } from './ipc'
import { permissionState } from './permissions'
import { initDatabase, closeDatabase } from './db'
import { createTray, destroyTray } from './tray'
import { resolveLocale, setLocale } from './i18n'
import { buildAppMenu } from './menu'
import { disposeScanner, runScan, runStorageBreakdown } from './scan'
import { initAutoUpdate } from './updater'

const dirname = path.dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function getWindow(): BrowserWindow | null {
  return mainWindow
}

async function persistWindowState(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return
  // getBounds returns a fully typed rect; getSize/getPosition hand back arrays
  // that read as possibly-undefined under noUncheckedIndexedAccess.
  const { x, y, width, height } = mainWindow.getBounds()
  await saveConfig({ window: { width, height, x, y } })
}

async function createWindow(): Promise<BrowserWindow> {
  const config = await loadConfig()

  // Destructured first so TypeScript keeps the narrowing through the spread.
  const { x, y } = config.window
  const position = x !== undefined && y !== undefined ? { x, y } : {}

  const window = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    ...position,
    minWidth: 940,
    minHeight: 620,
    show: false,
    resizable: true,
    maximizable: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 22 },
    /*
     * Opaque, and no vibrancy.
     *
     * Vibrancy tints with whatever sits behind the window, which is exactly
     * wrong for an app whose surface is a fixed branded gradient — the colour
     * would shift depending on the user's wallpaper. The value here matches the
     * deep stop in styles.css so there is no flash before the renderer paints.
     */
    backgroundColor: '#1b0455',
    webPreferences: {
      preload: path.join(dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  window.on('ready-to-show', () => window.show())

  // Renderer errors are otherwise invisible from the terminal, which makes a
  // blank panel impossible to diagnose without opening DevTools by hand.
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') {
      console.error(`[renderer:${event.level}] ${event.message} (${event.sourceId}:${event.lineNumber})`)
    }
  })

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[renderer gone] ${details.reason}`)
  })

  // Closing hides; only the tray's Quit really exits. The Dock icon stays put —
  // app.dock.hide() would make the app feel like it vanished.
  window.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    void persistWindowState()
    window.hide()
  })

  window.on('resized', () => void persistWindowState())
  window.on('moved', () => void persistWindowState())

  // This app never navigates anywhere. External links go to the real browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await window.loadFile(path.join(dirname, '../renderer/index.html'))
  }

  return window
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow().then((window) => {
      mainWindow = window
    })
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

/**
 * `CLEANMAC_DIAGNOSE=1` prints what the app can and cannot see, then exits.
 *
 * Unlike the dev helpers this works in packaged builds, because the question it
 * answers — "why can't it see my files?" — only ever comes up there. TCC grants
 * are per-binary, so the answer differs between a release, a local build and
 * `npm run dev`, and guessing is worse than asking the binary itself.
 */
async function diagnose(): Promise<void> {
  const state = await permissionState()

  console.log(`CleanMac ${app.getVersion()}`)
  console.log(`  bundle:            ${app.getPath('exe')}`)
  console.log(`  packaged:          ${app.isPackaged}`)
  console.log(`  full disk access:  ${state.fullDiskAccess ? 'GRANTED' : 'NOT GRANTED'}`)

  if (state.blocked.length > 0) {
    console.log('  unreadable roots:')
    for (const root of state.blocked) console.log(`    ${root}`)
  } else {
    console.log('  unreadable roots:  none')
  }

  // A permission is only worth having if it changes what the app can see, so
  // the diagnostic reports the numbers it changes rather than just the flag.
  const summary = await runScan(null)
  console.log(`\n  scan:              ${summary.durationMs}ms`)
  console.log(`    reclaimable:     ${(summary.totalReclaimable / 1e9).toFixed(2)} GB`)
  console.log(`    blocked by apps: ${(summary.blockedBytes / 1e9).toFixed(2)} GB`)

  const breakdown = await runStorageBreakdown()
  console.log(`\n  storage:           ${breakdown.durationMs}ms`)
  console.log(`    measured:        ${(breakdown.measuredBytes / 1e9).toFixed(2)} GB`)
  console.log(`    entries:         ${breakdown.entries.length}`)
  console.log(`    unreadable dirs: ${breakdown.unreadable}`)

  await disposeScanner()
  app.exit(state.fullDiskAccess ? 0 : 1)
}

app.whenReady().then(async () => {
  if (process.env.CLEANMAC_DIAGNOSE === '1') return diagnose()

  const config = await loadConfig()
  setLocale(resolveLocale(config.locale, app.getLocale()))

  initDatabase()
  registerIpc(getWindow)

  mainWindow = await createWindow()

  const menuOptions = {
    getWindow,
    show: showWindow,
    scan: () => {
      showWindow()
      void runScan(mainWindow)
    }
  }

  // Without this there is no Edit menu, and ⌘C stops working app-wide.
  buildAppMenu(menuOptions)
  createTray(menuOptions)

  // Development aid: `CLEANMAC_DEV_SCAN=1 npm start` scans on launch and, with
  // CLEANMAC_DEV_ROUTE, opens straight to a view. Useful for iterating on the
  // results UI without re-clicking through the flow every rebuild. Refuses to
  // arm itself in a packaged build.
  if (!app.isPackaged && process.env.CLEANMAC_DEV_SCAN === '1') {
    const route = process.env.CLEANMAC_DEV_ROUTE
    if (route) mainWindow.webContents.send('dev:navigate', route)

    void permissionState().then((state) => {
      console.log(
        `[dev] full disk access: ${state.fullDiskAccess ? 'GRANTED' : 'denied'}` +
          (state.blocked.length > 0 ? ` — blocked: ${state.blocked.join(', ')}` : '')
      )
    })

    void runScan(mainWindow).then((summary) => {
      console.log(
        `[dev] scan finished in ${summary.durationMs}ms — ` +
          `${(summary.totalReclaimable / 1e9).toFixed(2)} GB reclaimable, ` +
          `${(summary.blockedBytes / 1e9).toFixed(2)} GB blocked`
      )
    })
  }

  // Checks for updates and, first, removes the spent archives from previous
  // ones. An app that cleans storage must not leak it — see updater.ts.
  void initAutoUpdate({
    onReady: (version) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update:ready', version)
      }
    }
  })

  app.on('activate', () => showWindow())
})

// Intentionally empty: this app lives in the menu bar and must survive the
// window being closed.
app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  destroyTray()
  closeDatabase()
  void disposeScanner()
})
