import { app } from 'electron'
import { mkdtemp, mkdir, writeFile, utimes, rm, access, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { execute, restoreRun } from '../../src/main/executor'
import { initDatabase, listItems, listRuns } from '../../src/main/db'
import type { Finding } from '../../src/shared/types'

/**
 * The only test that performs a real deletion.
 *
 * Everything else about the destructive path is checked structurally — an
 * ESLint rule and a source grep prove `fs.rm` is never called, the safety suite
 * proves which paths are refused. None of that proves the thing actually works:
 * that `shell.trashItem` really moves the directory, that it lands somewhere
 * recoverable, and that undo brings it back.
 *
 * It cannot run under vitest because it needs a live Electron process for
 * `shell.trashItem`. Run it with:
 *
 *     npm run test:trash
 *
 * ## What it will not do
 *
 * It never empties the Trash. `emptyTrash()` is deliberately left untested,
 * because the only honest way to test it would destroy whatever the person
 * running the suite happens to have in their Trash. A test is not allowed to
 * cost more than the bug it would catch.
 *
 * Everything it creates lives in a `mkdtemp` directory inside
 * `~/Library/Caches`, and is removed at the end whether the test passes or not.
 */

const HOME = homedir()
const DAY_MS = 24 * 60 * 60 * 1000

let failures = 0
let checks = 0

function check(label: string, condition: boolean): void {
  checks += 1
  if (condition) {
    console.log(`  ok    ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label}`)
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Builds a finding by hand rather than running a scan, so the test controls
 * exactly what is deleted and nothing depends on what the machine happens to
 * hold.
 */
function findingFor(target: string, bytes: number, mtimeMs: number): Finding {
  return {
    id: `updater.residue::${target}`,
    ruleId: 'updater.residue',
    moduleId: 'updater-residue',
    path: target,
    displayPath: target.replace(HOME, '~'),
    bytes,
    logicalBytes: bytes,
    sharedBytes: 0,
    files: 1,
    mtimeMs,
    risk: 'none',
    action: 'trash',
    regenerates: false,
    selected: true,
    unreadable: 0
  }
}

async function main(): Promise<void> {
  // A separate database file, so a test run never appears in real history.
  initDatabase('integration-test.db')

  const sandbox = await mkdtemp(path.join(HOME, 'Library', 'Caches', 'cleanmac-trash-'))
  const name = 'com.example.integration.ShipIt'
  const target = path.join(sandbox, name)
  const trashed = path.join(HOME, '.Trash', name)

  try {
    // Matches `updater.residue`: a *.ShipIt directory, old enough to clear the
    // seven-day guard, over the 1 MB floor.
    await mkdir(target, { recursive: true })
    await writeFile(path.join(target, 'update.zip'), Buffer.alloc(2 * 1024 * 1024))

    const old = new Date(Date.now() - 40 * DAY_MS)
    await utimes(target, old, old)

    check('fixture exists before the run', await exists(target))
    check('nothing of that name is in the Trash yet', !(await exists(trashed)))

    /* ------------------------------------------------ the real deletion ---- */

    const finding = findingFor(target, 2 * 1024 * 1024, old.getTime())
    const report = await execute([finding])

    check('one item reported as trashed', report.trashed.length === 1)
    check('nothing failed', report.failed.length === 0)
    check('nothing skipped', report.skipped.length === 0)
    check('bytes reclaimed were counted', report.bytesReclaimed === 2 * 1024 * 1024)

    check('the directory is gone from its original path', !(await exists(target)))
    check('the directory is in the Trash', await exists(trashed))

    // The whole promise of the product: it went to the Trash, not into a void.
    const contents = await readdir(trashed).catch((): string[] => [])
    check('its contents survived the move', contents.includes('update.zip'))

    /* ------------------------------------------------------- the record ---- */

    const items = listItems(report.runId)
    check('the run recorded exactly one item', items.length === 1)
    check('the record names the real path', items[0]?.path === target)
    check('the record marks it trashed', items[0]?.outcome === 'trashed')
    check('the run appears in history', listRuns().some((run) => run.id === report.runId))

    /* ---------------------------------------------------------- the undo --- */

    const restored = await restoreRun(report.runId)

    check('undo restored one item', restored.restored === 1)
    check('undo failed on nothing', restored.failed === 0)
    check('the directory is back where it was', await exists(target))
    check('it is no longer in the Trash', !(await exists(trashed)))

    /* ------------------------------------------------ refusing bad input --- */

    /*
     * Two different refusals, and it matters which one fires.
     *
     * A first version of this test pointed at `~/Documents` and asserted the
     * path-safety layer rejected it. It was rejected — by the age guard, before
     * safety was ever consulted. The check passed for the wrong reason, which
     * is worse than failing.
     */

    // 1. Refused by a guard: recently modified, so revalidation stops it.
    const recent = path.join(sandbox, 'com.example.recent.ShipIt')
    await mkdir(recent, { recursive: true })
    await writeFile(path.join(recent, 'update.zip'), Buffer.alloc(2 * 1024 * 1024))

    const guarded = await execute([findingFor(recent, 2 * 1024 * 1024, Date.now())])
    check('a recently touched finding is skipped', guarded.skipped.length === 1)
    check('it is skipped, not deleted', await exists(recent))
    check('and the reason is the age guard', guarded.skipped[0]?.reasonKey === 'guard.tooRecent')

    // 2. Refused by path safety: old enough and well formed, so every guard
    //    passes — but it sits outside every allowed root. This is the check the
    //    whole allowlist exists for.
    const outsideDir = await mkdtemp(path.join(tmpdir(), 'cleanmac-outside-'))
    const outside = path.join(outsideDir, 'com.example.outside.ShipIt')
    await mkdir(outside, { recursive: true })
    await writeFile(path.join(outside, 'update.zip'), Buffer.alloc(2 * 1024 * 1024))
    await utimes(outside, old, old)

    const refused = await execute([findingFor(outside, 2 * 1024 * 1024, old.getTime())])

    check('a path outside the allowlist is not trashed', refused.trashed.length === 0)
    check('it is reported as failed, not silently dropped', refused.failed.length === 1)
    check(
      'and the reason names the allowlist',
      (refused.failed[0]?.detail ?? '').includes('outside every allowed root')
    )
    check('the directory is untouched', await exists(outside))

    await rm(outsideDir, { recursive: true, force: true })
  } finally {
    // Test code may use rm; the ban exists to protect the user's filesystem,
    // not a directory this test created two seconds ago.
    await rm(sandbox, { recursive: true, force: true })
    await rm(trashed, { recursive: true, force: true }).catch(() => undefined)
  }

  console.log(`\n${checks - failures}/${checks} checks passed`)
  app.exit(failures === 0 ? 0 : 1)
}

app.whenReady().then(() => {
  main().catch((error: unknown) => {
    console.error(error)
    app.exit(1)
  })
})
