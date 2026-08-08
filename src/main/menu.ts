import { Menu, app, shell, type BrowserWindow } from 'electron'
import { t } from './i18n'

/**
 * The application menu.
 *
 * Not optional on macOS: without one, Electron gives you no Edit menu, and
 * ⌘C / ⌘V / ⌘A stop working everywhere in the app — including in the one place
 * users most want them, which is copying a path out of the results list. The
 * standard roles also supply ⌘Q, ⌘W and ⌘M for free.
 *
 * Only two items are ours: scanning and cleaning. Everything else is a role, so
 * macOS localises and behaves exactly as the user expects.
 */
export function buildAppMenu(options: {
  getWindow: () => BrowserWindow | null
  show: () => void
  scan: () => void
}): void {
  const send = (channel: string): void => {
    const window = options.getWindow()
    if (window && !window.isDestroyed()) window.webContents.send(channel)
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      role: 'appMenu',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: t('preferences'),
          accelerator: 'Cmd+,',
          click: () => {
            options.show()
            send('menu:settings')
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: t('scanMenu'),
      submenu: [
        {
          label: t('scan'),
          accelerator: 'Cmd+R',
          click: () => {
            options.show()
            options.scan()
          }
        },
        {
          label: t('cleanSelected'),
          // ⌘⌫ is the macOS idiom for "move to Trash", which is exactly what
          // this does — so it is the shortcut users will already try.
          accelerator: 'Cmd+Backspace',
          click: () => {
            options.show()
            send('menu:clean')
          }
        }
      ]
    },
    /*
     * Supplies ⌘C, ⌘V, ⌘X and ⌘A. Paths in the results list are selectable
     * text precisely so this menu can copy them.
     *
     * The titles are set explicitly because Electron ships its own English
     * strings for built-in roles and macOS will not localise them — adding
     * CFBundleLocalizations to the bundle does not help. The *items* inside
     * (Undo, Cut, Paste…) stay in English for the same reason; overriding all
     * of them is not worth the maintenance for menus users navigate by
     * position and shortcut.
     */
    { label: t('editMenu'), role: 'editMenu' },
    { label: t('windowMenu'), role: 'windowMenu' },
    {
      label: t('helpMenu'),
      role: 'help',
      submenu: [
        {
          label: t('sourceCode'),
          click: () => void shell.openExternal('https://github.com/dazza-dev/cleanmac')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Rebuilt on locale change so our own items follow the chosen language. */
export function refreshAppMenu(options: Parameters<typeof buildAppMenu>[0]): void {
  if (!app.isReady()) return
  buildAppMenu(options)
}
