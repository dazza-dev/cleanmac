# Contributing

Thanks for looking. This project deletes people's files, so the bar for changes
is higher than the size of the codebase suggests. That is the only thing that
makes it unusual to work on.

## Getting set up

```bash
npm install
npm run dev
```

Requires Node 22+ and an Apple Silicon Mac. There are **no native modules** —
nothing compiles, nothing needs rebuilding, and there is no Rust toolchain.
If `npm install` succeeds, you are ready.

Useful while working:

```bash
npm test           # includes the safety suite
npm run typecheck
npm run lint
npm run build

# Scan on launch and open straight to a view, so you are not re-clicking
# through the flow after every rebuild. Disarms itself in packaged builds.
CLEANMAC_DEV_SCAN=1 CLEANMAC_DEV_ROUTE=/storage npm start
```

## The test that actually deletes something

`npm run test:trash` is the only test that performs a real deletion. It needs a
live Electron process for `shell.trashItem`, so it runs outside vitest:

```bash
npm run test:trash
```

It creates a fixture in a `mkdtemp` directory under `~/Library/Caches`, trashes
it for real, verifies it landed in `~/.Trash` with its contents intact, restores
it through the undo log, and checks that both refusal paths fire for the right
reason — a guard rejection and an allowlist rejection are different failures and
the test distinguishes them. Everything it creates is removed afterwards.

It never empties the Trash. Testing that honestly would destroy whatever you
happen to have in yours, and a test is not allowed to cost more than the bug it
would catch.

If you change anything in `src/main/executor/`, run it before opening the PR.
CI runs it on every release.

## The rules that are not negotiable

These are enforced by tests and lint, not by review alone.

1. **Nothing is deleted with `fs.rm`.** Every removal goes through
   `shell.trashItem`. An ESLint rule blocks the imports and
   `tests/safety/no-hard-delete.test.ts` greps the source for calls.
2. **The renderer never sends a path to anything that can delete.** It sends
   finding ids; the main process resolves them against its own state.
3. **Allowlist, never blocklist.** "Delete everything in X except Y" is how
   cleaners break machines when an app nobody anticipated shows up.
4. **Anything touching the user's own data is `inspect` only.** A rule with
   `risk: 'high'` and any other action fails
   `tests/safety/inspect-only.test.ts`.
5. **Never promise space you will not free.** Shared APFS blocks and hard links
   are subtracted from every reclaimable total.

## Adding a cleanup rule

Rules are declarative and live in `src/main/modules/`:

```ts
export const myRule: CleanupRule = {
  id: 'vendor.thing',
  moduleId: 'my-module',
  category: 'my-module',
  titleKey: 'rules.myRule.title',
  explainKey: 'rules.myRule.explain',
  risk: 'low',
  roots: ['~/Library/Caches'],
  depth: 1,
  match: { type: 'glob', patterns: ['com.vendor.thing'] },
  guards: [minAge(7), notRunning('Thing'), writable()],
  action: 'trash',
  regenerates: true,
  minBytes: 10 * 1024 * 1024
}
```

A rule pull request needs, without exception:

- **Evidence.** What is in the directory, on a real machine, and why it is safe.
  Paste the `ls`. Two rules were nearly shipped on assumption and both were
  wrong — `GoogleUpdater` is a working installer, not residue, and a
  binary `Info.plist` made an installed WhatsApp look uninstalled.
- **A test with a filesystem fixture** asserting **what the rule leaves alone**,
  not only what it matches. A test without the negative assertion is worth
  nothing.
- **Translations for all four locales** (`en`, `es`, `pt`, `fr`). Key parity is
  checked; missing keys fail.
- **An honest risk level.** `none` and `low` are preselected for the user. If
  you are unsure, it is `medium`.

## Testing anything that touches Full Disk Access

Two TCC behaviours will waste your afternoon if you do not know them.

- **Launch with `open`, never by running the binary.** TCC attributes permissions to the
  *responsible process*, which for a terminal-launched binary is the terminal. Any
  permission check done that way returns a false negative.
- **Rebuilding invalidates the grant.** Ad-hoc signatures change on every
  `electron-builder` run, so macOS sees a different app. The Settings entry stays in the
  list, still switched on, pointing at an identity that no longer exists — remove it with
  **−** and re-add the bundle.

There is a built-in diagnostic that works in packaged builds, which is the only place the
question ever comes up:

```bash
open -a dist/mac-arm64/CleanMac.app --env CLEANMAC_DIAGNOSE=1 --stdout /tmp/diag.log
```

It prints the permission state, which roots are unreadable, and what the scan and storage
breakdown actually find — so "is it granted" and "does it change anything" get answered
together. Exit code is 0 when granted, 1 when not.

For day-to-day work, grant Full Disk Access to `node_modules/electron/dist/Electron.app`
instead: it is downloaded once and never rebuilt, so the grant persists.

## Style

- **Code and comments in English. The UI is translated.**
- Comments explain *why*, especially where a decision looks arbitrary. Most of
  the ones here record something that was measured or something that broke.
- No dependency is added without a reason that survives the question "what
  breaks if a contributor cannot compile this?"

## What tends to get rejected

- A rule that matches broadly (`*Updater`, `*Cache`) without naming what it hits.
- Anything that widens `ALLOWED_ROOTS` or `ALLOWED_LEAF_NAMES` for convenience.
- Telemetry, analytics, crash reporting. The app makes no network calls except
  the update check, and that is a feature.
- Performance work justified by a microbenchmark. Measure the whole system
  under real concurrency: a walker that was 4× faster in isolation made the
  real scan *slower*, because every worker competes for one shared libuv
  thread pool.

## Commits and releases

Branch off `main`, keep history clean, no merge commits. Releases are cut by
tagging `v*.*.*`; CI builds, signs and publishes. Nothing built locally is ever
released.
