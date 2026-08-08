import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import path from 'node:path'
import type { Finding } from '../rules/types'

/**
 * Undo log and cleanup history.
 *
 * Uses Node's built-in `node:sqlite` rather than `better-sqlite3`: no native
 * rebuild against Electron's ABI, no ad-hoc signing dance after every install,
 * nothing to break on a contributor's machine.
 *
 * Every executed item is recorded before the user is told it succeeded. Without
 * this log a report of "your app deleted something it shouldn't have" would be
 * impossible to investigate.
 */

export type ItemOutcome = 'trashed' | 'skipped' | 'failed' | 'restored'

export interface RunRecord {
  id: number
  startedAt: string
  finishedAt: string | null
  bytesReclaimed: number
  itemCount: number
}

export interface ItemRecord {
  id: number
  runId: number
  ruleId: string
  path: string
  bytes: number
  outcome: ItemOutcome
  detail: string | null
  createdAt: string
}

let db: DatabaseSync | null = null

function connection(): DatabaseSync {
  if (!db) throw new Error('Database has not been initialised')
  return db
}

export function initDatabase(fileName = 'clean-mac.db'): void {
  if (db) return

  const target = path.join(app.getPath('userData'), fileName)
  db = new DatabaseSync(target)

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at      TEXT    NOT NULL,
      finished_at     TEXT,
      bytes_reclaimed INTEGER NOT NULL DEFAULT 0,
      item_count      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id     INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      rule_id    TEXT    NOT NULL,
      path       TEXT    NOT NULL,
      bytes      INTEGER NOT NULL DEFAULT 0,
      outcome    TEXT    NOT NULL,
      detail     TEXT,
      created_at TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS items_run_idx ON items(run_id);
  `)
}

export function closeDatabase(): void {
  db?.close()
  db = null
}

export function startRun(): number {
  const statement = connection().prepare(
    'INSERT INTO runs (started_at) VALUES (?) RETURNING id'
  )
  const row = statement.get(new Date().toISOString()) as { id: number }
  return row.id
}

export function recordItem(
  runId: number,
  finding: Pick<Finding, 'ruleId' | 'path' | 'bytes'>,
  outcome: ItemOutcome,
  detail?: string
): void {
  connection()
    .prepare(
      `INSERT INTO items (run_id, rule_id, path, bytes, outcome, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      runId,
      finding.ruleId,
      finding.path,
      finding.bytes,
      outcome,
      detail ?? null,
      new Date().toISOString()
    )
}

export function finishRun(runId: number, bytesReclaimed: number, itemCount: number): void {
  connection()
    .prepare(
      'UPDATE runs SET finished_at = ?, bytes_reclaimed = ?, item_count = ? WHERE id = ?'
    )
    .run(new Date().toISOString(), bytesReclaimed, itemCount, runId)
}

export function listRuns(limit = 50): RunRecord[] {
  const rows = connection()
    .prepare(
      `SELECT id, started_at, finished_at, bytes_reclaimed, item_count
       FROM runs WHERE finished_at IS NOT NULL
       ORDER BY id DESC LIMIT ?`
    )
    .all(limit) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: Number(row.id),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at === null ? null : String(row.finished_at),
    bytesReclaimed: Number(row.bytes_reclaimed),
    itemCount: Number(row.item_count)
  }))
}

export function listItems(runId: number): ItemRecord[] {
  const rows = connection()
    .prepare(
      `SELECT id, run_id, rule_id, path, bytes, outcome, detail, created_at
       FROM items WHERE run_id = ? ORDER BY bytes DESC`
    )
    .all(runId) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: Number(row.id),
    runId: Number(row.run_id),
    ruleId: String(row.rule_id),
    path: String(row.path),
    bytes: Number(row.bytes),
    outcome: String(row.outcome) as ItemOutcome,
    detail: row.detail === null ? null : String(row.detail),
    createdAt: String(row.created_at)
  }))
}

/** Total bytes reclaimed across every completed run. */
export function totalReclaimed(): number {
  const row = connection()
    .prepare('SELECT COALESCE(SUM(bytes_reclaimed), 0) AS total FROM runs')
    .get() as { total: number }
  return Number(row.total)
}
