import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { snapshotRunningApps } from './rules/processes'

const run = promisify(execFile)

/**
 * Quitting the apps that are sitting on reclaimable space.
 *
 * v0.1 measured 1.6 GB on the reference machine that no rule could touch purely
 * because Trae and Zoho Mail were open. Hiding those findings would be dishonest
 * and leaving the user to work out which app to quit is unhelpful, so the app
 * offers to do it.
 *
 * Always a graceful AppleScript `quit`, never a signal: that is the same path as
 * choosing Quit from the menu, so an app with unsaved work gets to put up its
 * own save dialog. Killing a process to free a cache would be the exact kind of
 * collateral damage this project refuses to cause.
 */

/** Escapes a string for safe interpolation into an AppleScript literal. */
function escapeAppleScript(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export class UnknownAppError extends Error {}

/**
 * Asks an application to quit. Resolves once it is gone, or rejects if it is
 * still running after `timeoutMs` — usually because a save dialog is waiting
 * for the user, which is a good reason not to force anything.
 */
export async function quitApp(name: string, timeoutMs = 15_000): Promise<boolean> {
  // Only apps we can actually see running may be named. Without this a
  // compromised renderer could ask us to quit anything at all.
  const running = await snapshotRunningApps()
  const match = [...running.displayNames.values()].find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase()
  )

  if (!match) throw new UnknownAppError(`${name} is not running`)

  await run('/usr/bin/osascript', [
    '-e',
    `tell application "${escapeAppleScript(match)}" to quit`
  ]).catch(() => {
    // A non-zero exit here usually means the app declined or is mid-prompt;
    // the poll below is the real answer either way.
  })

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    const now = await snapshotRunningApps()
    const stillThere = [...now.displayNames.values()].some(
      (candidate) => candidate.toLowerCase() === match.toLowerCase()
    )
    if (!stillThere) return true
  }

  return false
}
