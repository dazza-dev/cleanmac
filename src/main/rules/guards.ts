import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import type { Guard, RuleContext } from './types'
import { runningOwnerOf, findRunningApp } from './processes'

/**
 * Guards are the per-finding veto. A rule may match a path and still be told
 * "not this one, not right now". Every guard must pass for a finding to become
 * actionable; a failure is surfaced in the UI with its reason rather than being
 * silently dropped.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Rejects anything modified more recently than `days` ago. */
export function minAge(days: number): Guard {
  return {
    id: `min-age-${days}d`,
    check(context: RuleContext) {
      const ageMs = context.now - context.stat.mtimeMs
      if (ageMs < days * DAY_MS) {
        const ageDays = Math.max(0, Math.floor(ageMs / DAY_MS))
        return {
          ok: false as const,
          reasonKey: 'guard.tooRecent',
          detail: String(ageDays)
        }
      }
      return { ok: true as const }
    }
  }
}

/**
 * Rejects a finding while the application that owns it is running. Deleting an
 * update payload mid-install, or a cache the owner has memory-mapped, is how
 * cleaners corrupt installations.
 */
/**
 * Blocks a finding while its owning application is running.
 *
 * Pass `appName` whenever the rule knows who owns the data — the name-derived
 * heuristic cannot connect a directory called `Chrome` to an app called
 * `Google Chrome`, and silently failing to notice a running browser is how a
 * cleaner corrupts a profile.
 */
export function notRunning(appName?: string): Guard {
  return {
    id: appName ? `not-running:${appName}` : 'owner-not-running',
    check(context: RuleContext) {
      const owner = appName
        ? findRunningApp(appName, context.running)
        : runningOwnerOf(context.name, context.running)

      if (owner === null) return { ok: true as const }

      // The app name travels in `detail` so the UI can offer to quit it by
      // name instead of leaving the user to guess which app is in the way.
      return owner
        ? { ok: false as const, reasonKey: 'guard.appRunningNamed', detail: owner }
        : { ok: false as const, reasonKey: 'guard.appRunning' }
    }
  }
}

/** Rejects anything the current user cannot actually write to. */
export function writable(): Guard {
  return {
    id: 'writable',
    async check(context: RuleContext) {
      try {
        await access(context.path, constants.W_OK)
        return { ok: true as const }
      } catch {
        return { ok: false as const, reasonKey: 'guard.notWritable' }
      }
    }
  }
}

/**
 * Rejects a finding whose sibling marker file is missing. Used to require a
 * lockfile before offering to delete a dependency directory.
 */
export function siblingExists(...names: string[]): Guard {
  return {
    id: `sibling-${names.join('|')}`,
    async check(context: RuleContext) {
      const parent = path.dirname(context.path)
      for (const name of names) {
        try {
          await access(path.join(parent, name), constants.R_OK)
          return { ok: true as const }
        } catch {
          continue
        }
      }
      return {
        ok: false as const,
        reasonKey: 'guard.missingSibling',
        detail: names.join(', ')
      }
    }
  }
}

export async function runGuards(
  guards: Guard[],
  context: RuleContext
): Promise<{ reasonKey: string; detail?: string } | null> {
  for (const guard of guards) {
    const result = await guard.check(context)
    if (!result.ok) {
      return { reasonKey: result.reasonKey, detail: result.detail }
    }
  }
  return null
}
