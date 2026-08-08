import type { CleanupRule } from '../rules/types'
import { minAge, notRunning, writable } from '../rules/guards'

/**
 * M4 — Browser caches.
 *
 * The rule that matters here is what is *absent*. None of these patterns can
 * ever match `Cookies`, `Login Data`, `History`, `Bookmarks`, `Preferences`,
 * `Web Data`, `Local Storage` or `IndexedDB`. Signing someone out of every site
 * they use, or losing a web app's local data, is the fastest way to have a
 * cleaner uninstalled — and it is what "clear browser data" buttons usually do.
 *
 * Only directories whose entire purpose is caching are named, one at a time.
 */

/**
 * `notRunning` takes the app name explicitly: a cache directory called `Chrome`
 * belongs to an application called `Google Chrome`, and no amount of deriving
 * from the directory name connects the two. Chrome writes its cache while
 * running, so removing it under a live browser corrupts the profile.
 */
export const chromeCache: CleanupRule = {
  id: 'browser.chrome-cache',
  moduleId: 'browsers',
  category: 'browsers',
  titleKey: 'rules.chromeCache.title',
  explainKey: 'rules.chromeCache.explain',
  risk: 'low',
  roots: ['~/Library/Caches/Google'],
  depth: 1,
  match: { type: 'glob', patterns: ['Chrome', 'Chrome Canary'] },
  guards: [notRunning('Google Chrome'), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 50 * 1024 * 1024
}

/**
 * Per-profile caches living inside Application Support rather than Caches.
 * Depth 3 reaches `<profile>/Service Worker/CacheStorage`, which is 1.1 GB on
 * the reference machine and the single largest of them.
 */
export const chromeProfileCaches: CleanupRule = {
  id: 'browser.chrome-profile-caches',
  moduleId: 'browsers',
  category: 'browsers',
  titleKey: 'rules.chromeProfileCaches.title',
  explainKey: 'rules.chromeProfileCaches.explain',
  risk: 'low',
  roots: ['~/Library/Application Support/Google/Chrome'],
  depth: 3,
  match: {
    type: 'glob',
    patterns: [
      'Code Cache',
      'GPUCache',
      'DawnWebGPUCache',
      'DawnGraphiteCache',
      'GrShaderCache',
      'ShaderCache',
      'CacheStorage',
      'ScriptCache'
    ]
  },
  guards: [notRunning('Google Chrome'), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 20 * 1024 * 1024
}

export const safariCache: CleanupRule = {
  id: 'browser.safari-cache',
  moduleId: 'browsers',
  category: 'browsers',
  titleKey: 'rules.safariCache.title',
  explainKey: 'rules.safariCache.explain',
  risk: 'low',
  roots: ['~/Library/Caches'],
  depth: 1,
  match: { type: 'glob', patterns: ['com.apple.Safari'] },
  guards: [notRunning('Safari'), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 20 * 1024 * 1024
}

export const firefoxCache: CleanupRule = {
  id: 'browser.firefox-cache',
  moduleId: 'browsers',
  category: 'browsers',
  titleKey: 'rules.firefoxCache.title',
  explainKey: 'rules.firefoxCache.explain',
  risk: 'low',
  roots: ['~/Library/Caches'],
  depth: 1,
  match: { type: 'glob', patterns: ['Firefox'] },
  guards: [notRunning('Firefox'), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 20 * 1024 * 1024
}

/**
 * Chrome profiles nobody has opened in months. Reported only — a profile holds
 * bookmarks, passwords and history, and "which of your browser identities is
 * disposable" is not a judgement this app gets to make.
 */
export const staleProfiles: CleanupRule = {
  id: 'browser.stale-profiles',
  moduleId: 'browsers',
  category: 'browsers',
  titleKey: 'rules.staleProfiles.title',
  explainKey: 'rules.staleProfiles.explain',
  risk: 'high',
  roots: ['~/Library/Application Support/Google/Chrome'],
  depth: 1,
  match: { type: 'glob', patterns: ['Profile *'] },
  guards: [minAge(120)],
  action: 'inspect',
  regenerates: false,
  minBytes: 100 * 1024 * 1024
}

export const rules: CleanupRule[] = [
  chromeCache,
  chromeProfileCaches,
  safariCache,
  firefoxCache,
  staleProfiles
]
