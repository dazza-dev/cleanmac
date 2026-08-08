import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

/** User preferences and window state. Lives in userData, never in the repo. */

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
}

export interface AppConfig {
  locale: string | null
  window: WindowState
  /** Disk usage percentage at which the menu bar starts nagging. */
  warnThresholdPercent: number
  /** Whether the onboarding permission prompt has been dismissed. */
  permissionPromptDismissed: boolean
}

const DEFAULTS: AppConfig = {
  locale: null,
  window: { width: 1100, height: 720 },
  warnThresholdPercent: 85,
  permissionPromptDismissed: false
}

let cached: AppConfig | null = null

function configPath(): string {
  return path.join(app.getPath('userData'), 'clean-mac-config.json')
}

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached

  try {
    const raw = await readFile(configPath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    cached = {
      ...DEFAULTS,
      ...parsed,
      window: { ...DEFAULTS.window, ...(parsed.window ?? {}) }
    }
  } catch {
    // Missing or corrupt config is not an error worth surfacing — defaults are
    // always valid and the file is rewritten on the next save.
    cached = { ...DEFAULTS }
  }

  return cached
}

export async function saveConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await loadConfig()
  cached = { ...current, ...patch, window: { ...current.window, ...(patch.window ?? {}) } }

  await mkdir(path.dirname(configPath()), { recursive: true })
  await writeFile(configPath(), JSON.stringify(cached, null, 2), 'utf8')

  return cached
}
