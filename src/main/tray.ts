import { Tray, Menu, nativeImage, app, type BrowserWindow } from 'electron'
import { diskStats } from './disk'
import { loadConfig } from './config'
import { t } from './i18n'

/**
 * Menu bar presence. On macOS the disk percentage sits next to the clock, which
 * is the whole point of the background mode: the number is visible before it
 * becomes a problem.
 */

let tray: Tray | null = null
let timer: NodeJS.Timeout | null = null

const REFRESH_MS = 5 * 60 * 1000

/**
 * A 16pt template image. Template images are recoloured by macOS to match the
 * menu bar (light, dark, and inverted when the bar is highlighted), so it must
 * be pure black with an alpha channel and nothing else.
 */
function trayIcon(): Electron.NativeImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <path fill="black" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"/>
    <path fill="black" d="M8 0a8 8 0 0 1 8 8h-2a6 6 0 0 0-6-6V0Z"/>
  </svg>`

  const image = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  )
  image.setTemplateImage(true)
  return image
}

async function refresh(show: () => void, scan: () => void): Promise<void> {
  if (!tray) return

  const [stats, config] = await Promise.all([diskStats(), loadConfig()])
  const percent = Math.round(stats.usedPercent)
  const over = percent >= config.warnThresholdPercent

  // Only the percentage is shown, and only once it matters. A permanent label
  // next to the clock is noise; a number that appears at 85% is a signal.
  tray.setTitle(over ? `${percent}%` : '')
  tray.setToolTip(`CleanMac — ${percent}% ${t('diskUsed')}`)

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `${percent}% ${t('diskUsed')}`, enabled: false },
      { type: 'separator' },
      { label: t('show'), click: show },
      { label: t('scan'), click: scan },
      { type: 'separator' },
      { label: t('quit'), click: () => app.quit() }
    ])
  )
}

export function createTray(options: {
  getWindow: () => BrowserWindow | null
  show: () => void
  scan: () => void
}): void {
  if (tray) return

  tray = new Tray(trayIcon())
  tray.on('click', options.show)

  void refresh(options.show, options.scan)
  timer = setInterval(() => void refresh(options.show, options.scan), REFRESH_MS)
}

export function refreshTray(show: () => void, scan: () => void): void {
  void refresh(show, scan)
}

export function destroyTray(): void {
  if (timer) clearInterval(timer)
  timer = null
  tray?.destroy()
  tray = null
}
