# Security Policy

CleanMac runs with Full Disk Access and deletes files. That combination deserves
more scrutiny than a typical desktop app, so this document is specific about
what the threat model is and what it is not.

## Reporting a vulnerability

Email **info@cuantis.com** with `[clean-mac security]` in the subject. Please do
not open a public issue for anything that could be used to delete a user's data.

Include the version, macOS version, and a path or rule that reproduces it. If
the issue is "this rule deletes something it should not", that is a security
report, not a bug report — treat it as such.

You will get an acknowledgement within a few days. There is no bounty; this is
an unpaid open source project.

## What the app is trusted with

- **Full Disk Access**, granted by the user, so it can read other applications'
  support directories. Without it, most of the catalogue is blind.
- **Moving files to the Trash**, via `NSFileManager.trashItem`.
- **Running a small set of fixed commands**: `brew cleanup`, `docker system
  prune -f`, `plutil`, `ps`, `diskutil`, and `osascript` to quit a named
  running application.

It has **no network access** beyond the update check, and **no telemetry** of
any kind.

## Design decisions that exist for security

| Decision | Why |
|---|---|
| `fs.rm` appears nowhere | Every deletion goes to the Trash and is recoverable. Enforced by an ESLint rule and by `tests/safety/no-hard-delete.test.ts`, which greps the source. |
| Renderer is sandboxed, `contextIsolation` on, `nodeIntegration` off | An XSS in the UI gets no filesystem access. |
| Renderer sends finding **ids**, never paths | A compromised UI cannot name an arbitrary file for deletion. `tests/scan-session.test.ts` asserts an unknown id resolves to nothing. |
| Symlinks resolved *before* the allowlist check | A symlink planted in a cache directory cannot redirect a deletion. |
| Path validated immediately before every deletion | Not once when a rule is written — on every execution, after revalidating guards. |
| Two narrow acceptance paths only | A path is accepted either because it sits strictly inside an explicitly allowed root, or because the directory's own name is `node_modules`. Nothing else is deletable. |
| Strict CSP, no `unsafe-eval`, navigation blocked | Nothing external can be loaded into the renderer. |
| No App Sandbox | Deliberate: a sandboxed process cannot read other apps' libraries, which is the app's entire function. Documented rather than hidden. |

## Supply chain

- Releases are built and signed in GitHub Actions from a tagged commit. No
  binary built on a maintainer's laptop is ever published.
- The app ships **no native modules**, so there is nothing compiled outside npm.
- `electron-updater` verifies signatures; auto-update is disabled in unsigned
  builds because an unsigned app cannot verify what it downloads.

## Out of scope

- An attacker who already has code execution as the user. They do not need this
  app to delete files.
- Damage from a user deliberately selecting a medium-risk finding and emptying
  the Trash. The app shows the path, the size and the risk before acting; that
  is the contract.
- Unsigned local builds (`npm run pack:mac`). They are ad-hoc signed for
  development and are not a distribution channel.

## Supported versions

The latest release only. This project is too small to backport fixes.
