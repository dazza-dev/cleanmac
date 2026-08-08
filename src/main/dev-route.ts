/**
 * Resolves the view the app should open on at launch, for UI iteration.
 *
 * ## Why this is a pull, and why it is a separate function
 *
 * The route used to be pushed: the main process sent `dev:navigate` as soon as
 * the window finished loading, which is before Vue has mounted and subscribed.
 * An Electron send with no listener is discarded silently — no error, no
 * warning, nothing in any log — so `CLEANMAC_DEV_ROUTE` did nothing at all and
 * gave no clue why. It is now requested by the renderer once it exists, which
 * has no such window.
 *
 * It lives in its own module, taking `packaged` as an argument rather than
 * reading `app.isPackaged`, purely so it can be tested. The behaviour that
 * matters most here — that a packaged build ignores the variable entirely — is
 * otherwise only observable by packaging the app and looking at it.
 */
export function resolveDevRoute(
  packaged: boolean,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  // Never in a packaged build. The route is harmless on its own, but it is the
  // same gate that arms the launch scan, and a shipped app must not decide to
  // walk the user's disk because a stray variable is set in their shell.
  if (packaged) return null
  if (env.CLEANMAC_DEV_SCAN !== '1') return null

  const route = env.CLEANMAC_DEV_ROUTE?.trim()
  if (!route) return null

  // Only in-app paths. Anything else would hand `router.push` a destination it
  // was never meant to take.
  if (!route.startsWith('/')) return null

  return route
}
