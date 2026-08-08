import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import path from 'node:path'
import type { CleanupRule, ProviderFinding } from '../rules/types'

const run = promisify(execFile)

/**
 * M5 — Docker.
 *
 * Docker keeps everything inside a single disk image. Deleting files in
 * `~/Library/Containers/com.docker.docker` by hand corrupts the installation,
 * so this module never touches the filesystem: it asks Docker what it is
 * holding and asks Docker to let go.
 *
 * Volumes are deliberately excluded from the prune. A dangling volume very
 * often holds a development database the user forgot about, and "it deleted my
 * local Postgres" is not a recoverable reputation.
 */

const DOCKER_DATA = path.join(homedir(), 'Library/Containers/com.docker.docker')

interface DockerUsageRow {
  Type: string
  Reclaimable: string
  Size: string
}

/** `docker system df` prints sizes like "1.093GB (58%)" or "952.6MB". */
export function parseDockerSize(value: string): number {
  const match = value.trim().match(/^([\d.]+)\s*([KMGT]?)B/i)
  if (!match?.[1]) return 0

  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return 0

  const multiplier =
    { '': 1, K: 1e3, M: 1e6, G: 1e9, T: 1e12 }[(match[2] ?? '').toUpperCase()] ?? 1

  return Math.round(amount * multiplier)
}

async function dockerAvailable(): Promise<boolean> {
  try {
    await run('/usr/bin/which', ['docker'])
    return true
  } catch {
    return false
  }
}

async function dockerUsage(): Promise<DockerUsageRow[] | null> {
  try {
    const { stdout } = await run('docker', ['system', 'df', '--format', 'json'], {
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024
    })

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DockerUsageRow)
  } catch {
    // Either the CLI is missing or the daemon is not running. Both are handled
    // by the caller, which still reports the space so the user knows it exists.
    return null
  }
}

async function provider(): Promise<ProviderFinding[]> {
  if (!(await dockerAvailable())) return []

  const usage = await dockerUsage()

  if (!usage) {
    // The daemon is down. The disk image is still there, and hiding it would
    // leave several gigabytes unaccounted for, so it is reported as blocked
    // rather than omitted.
    return [
      {
        path: DOCKER_DATA,
        bytes: 0,
        label: 'Docker',
        skipped: { reasonKey: 'guard.dockerNotRunning' }
      }
    ]
  }

  const reclaimable = usage.reduce((sum, row) => sum + parseDockerSize(row.Reclaimable), 0)
  if (reclaimable <= 0) return []

  return [
    {
      path: DOCKER_DATA,
      bytes: reclaimable,
      label: usage
        .filter((row) => parseDockerSize(row.Reclaimable) > 0)
        .map((row) => `${row.Type}: ${row.Reclaimable}`)
        .join(' · ')
    }
  ]
}

export const dockerPrune: CleanupRule = {
  id: 'docker.prune',
  moduleId: 'docker',
  category: 'docker',
  titleKey: 'rules.docker.title',
  explainKey: 'rules.docker.explain',
  risk: 'low',
  roots: [],
  depth: 0,
  match: { type: 'glob', patterns: [] },
  guards: [],
  action: 'command',
  regenerates: true,
  provider,
  command: {
    bin: 'docker',
    dryRun: ['system', 'df'],
    // No `--volumes`: dangling volumes routinely hold real development data.
    execute: ['system', 'prune', '-f']
  }
}

export const rules: CleanupRule[] = [dockerPrune]
