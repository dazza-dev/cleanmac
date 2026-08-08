# CleanMac

Open source storage and performance cleaner for macOS, built with Electron and
Vue 3. Apple Silicon, Ventura or later.

## Why

macOS is opaque about storage. "Other volumes" and "System data" hide tens of
gigabytes that Settings → General → Storage will not explain. The current
generation of AI applications made it worse: Claude, Cursor, Ollama, LM Studio
and Trae keep models, VM snapshots, indexes and context caches measured in
gigabytes, with **no interface anywhere to manage them**.

CleanMyMac solves part of this, but it is closed source, paid, and — worst of
all — **it does not tell you what it is deleting**. It shows you "5.2 GB of
junk" and a button. That is exactly the part this project inverts.

## Three principles

1. **Radical transparency.** Nothing is ever deleted without first showing the
   exact path, the real size, and the reason it is considered junk. No "trust
   me".
2. **Reversible by default.** Nothing is removed with `fs.rm`. Everything goes
   to the Trash through the system API. If we get it wrong, you get it back in
   two clicks.
3. **Explain, don't just clean.** The goal is not to free 20 GB once. It is that
   you understand *why* your Mac accumulates 20 GB every three months.

## What it finds

Measured on the reference machine (245 GB container, 8 modules, 22 rules, full
scan in ~4 s):

| Module | What it covers |
|---|---|
| **M1** Update leftovers | `*.ShipIt`, `*-updater` — spent installers from auto-updaters |
| **M2** Developer caches | Homebrew (via `brew cleanup`), composer, tsc, node-gyp, Electron |
| **M3** AI applications | Claude `vm_bundles`, HuggingFace, local models, orphaned editor workspaces |
| **M4** Browsers | Chrome, Safari, Firefox — caches only, never cookies, logins or history |
| **M5** Docker | `docker system prune`, never touching files, never `--volumes` |
| **M6** `node_modules` | Lockfile required, plus project inactivity |
| **M7** App leftovers | Bundle ids no installed application claims |
| **M9** System | Logs, saved state, DerivedData, archives, simulators, iOS backups |
| **M10** Large files | A sweep of the home directory — reported, never deleted |
| **M11** Duplicates | Byte-identical files, three passes — reported, never deleted |

On that machine: **8.1 GB reclaimable**, **4.6 GB blocked** by open
applications, and **57.5 GB** of large forgotten files in `~/Downloads`.

## What makes it different

- **The category nobody covers.** 7.2 GB of virtual machine images for Claude's
  code sandbox, with no interface anywhere that admits they exist.
- **Numbers that reconcile.** `your data + system volumes + free = total`. An
  earlier version reported 201 GB where the real figure was 167 GB, because it
  counted Preboot, Recovery and VM swap as if they were yours.
- **Apps holding space hostage**, named, with a button to quit them: *"Quit
  Google Chrome → 3.1 GB"*.
- **A storage view with a per-file-type breakdown.** This is where the 14 GB
  WhatsApp library that macOS files under "Other" shows up — labelled *"Your
  data — never deleted"*.
- **Inspection-only rules** for iOS backups, Xcode archives, browser profiles
  and local models. Reported, never deletable from the app.
- **No native toolchain.** A Rust scanner was evaluated and dropped: the
  bottleneck was libuv's shared thread pool, not the language. `npm install` and
  it works.

## Install

Build it yourself. That is the supported path, not a workaround:

```bash
git clone https://github.com/dazza-dev/cleanmac.git
cd cleanmac
npm install
npm run install:local
```

That packages the app and puts it in `/Applications`. Requires an Apple Silicon
Mac on macOS Ventura or later, and Node 22+.

Then open it once from Finder and grant it Full Disk Access in **System
Settings → Privacy & Security → Full Disk Access**. Without that permission the
app still works, but it cannot see inside other applications' containers — and
every refusal costs time, so scanning is also slower.

> **Re-granting after a rebuild.** macOS identifies an app by its code
> signature, and a locally built app is signed ad-hoc, which produces a new
> signature every time. So after `npm run install:local`, the old Full Disk
> Access entry points at an app that no longer exists: remove it with **−** and
> add the new one. Toggling it off and on does not refresh it.

### Releases

Tagged versions publish an **unsigned** DMG:

```bash
npm version 1.1.0        # bumps package.json, commits, and tags v1.1.0
git push --follow-tags   # the tag is what triggers the build
```

CI then runs typecheck, lint, the full test suite and the real-deletion test,
packages the DMG, and publishes a GitHub Release. Pushing to `main` on its own
builds nothing: a release per commit is noise.

Because there is no Developer ID, macOS refuses to open the DMG on first launch
— right-click → Open gets past it, once. Building from source avoids the warning
entirely, which is why it is the recommended path above.

`Casks/cleanmac.rb` is deliberately not wired into the workflow. A
`brew install` that lands on a Gatekeeper block is worse than no cask; it is
there for anyone forking this with a certificate.

## Develop

```bash
npm install
npm run dev        # HMR for renderer and main
npm test           # 112 tests, including the safety and contrast suites
npm run test:trash # the one test that performs a real deletion (needs Electron)
npm run typecheck
npm run lint
npm run icon       # regenerate build/icon.icns from build/make-icon.mjs
npm run pack:mac   # arm64 DMG (ad-hoc signed, not notarized)
```

Requires Node 22+. **No native modules** — nothing compiles, nothing needs
rebuilding after install.

Development helpers, disarmed automatically in packaged builds:

```bash
# Scan on launch and open straight to a view
CLEANMAC_DEV_SCAN=1 CLEANMAC_DEV_ROUTE=/storage npm start

# Report what the app can and cannot see (works in packaged builds)
open -a dist/mac-arm64/CleanMac.app --env CLEANMAC_DIAGNOSE=1 --stdout /tmp/diag.log
```

> The DMG produced by `pack:mac` is ad-hoc signed: it runs on your machine, but
> Gatekeeper will block it on any other. So does the one CI publishes. Getting
> past that needs a Developer ID and notarization, which this project does not
> have — see [Releases](#releases).

## Safety model

This app runs with Full Disk Access and deletes files, so the guarantees are
structural rather than a matter of care:

- **`fs.rm` appears nowhere.** Every deletion goes through `shell.trashItem`.
  Enforced by an ESLint rule and by a test that greps the source.
- **The renderer sends finding ids, never paths.** A compromised UI cannot name
  an arbitrary file for deletion.
- **Symlinks are resolved before the allowlist check**, and every path is
  validated again immediately before deletion — not once when a rule was
  written.
- **Anything touching your own data is inspection-only.** A rule with
  `risk: 'high'` and any other action fails the test suite.
- **Shared APFS blocks are never counted as reclaimable**, so the app cannot
  promise space that deleting would not actually free.

See [`SECURITY.md`](SECURITY.md) for the full threat model and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for how to add a rule.

## License

MIT.
