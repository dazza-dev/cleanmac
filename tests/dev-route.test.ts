import { describe, it, expect } from 'vitest'
import { resolveDevRoute } from '../src/main/dev-route'

/**
 * `CLEANMAC_DEV_ROUTE` was broken for its whole existence: the main process
 * pushed the route to a renderer that had not yet subscribed, and Electron
 * discards a send with no listener without a word. Nothing failed, nothing was
 * logged, and the flag simply did nothing.
 *
 * The delivery mechanism is a pull now, so that race is gone. What is left to
 * protect is the decision itself, which is what these cover — including the one
 * case that would otherwise require packaging the app to observe.
 */

const dev = { CLEANMAC_DEV_SCAN: '1', CLEANMAC_DEV_ROUTE: '/storage' }

describe('resolveDevRoute', () => {
  it('returns the requested route in development', () => {
    expect(resolveDevRoute(false, dev)).toBe('/storage')
  })

  it('is disarmed in a packaged build', () => {
    // The gate that arms this also arms the launch scan. A shipped app must
    // never start walking the disk because a variable is set in someone's
    // shell profile.
    expect(resolveDevRoute(true, dev)).toBeNull()
  })

  it('does nothing without the scan flag', () => {
    expect(resolveDevRoute(false, { CLEANMAC_DEV_ROUTE: '/storage' })).toBeNull()
  })

  it('does nothing when no route is asked for', () => {
    expect(resolveDevRoute(false, { CLEANMAC_DEV_SCAN: '1' })).toBeNull()
    expect(
      resolveDevRoute(false, { CLEANMAC_DEV_SCAN: '1', CLEANMAC_DEV_ROUTE: '   ' })
    ).toBeNull()
  })

  it('refuses anything that is not an in-app path', () => {
    for (const route of ['https://example.com', 'file:///etc/passwd', 'storage']) {
      expect(
        resolveDevRoute(false, { CLEANMAC_DEV_SCAN: '1', CLEANMAC_DEV_ROUTE: route })
      ).toBeNull()
    }
  })

  it('keeps the query string the duplicates shortcut relies on', () => {
    expect(
      resolveDevRoute(false, {
        CLEANMAC_DEV_SCAN: '1',
        CLEANMAC_DEV_ROUTE: '/storage?run=duplicates'
      })
    ).toBe('/storage?run=duplicates')
  })
})
