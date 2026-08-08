const { execFileSync } = require('node:child_process')
const path = require('node:path')

/**
 * Ad-hoc signs the packaged app so an unsigned local build actually launches.
 *
 * This is NOT a substitute for a Developer ID signature: an ad-hoc signed app
 * still trips Gatekeeper on another machine, and macOS ties Full Disk Access to
 * the signing identity, so a real release must be signed and notarized. See
 * docs/04-seguridad.md.
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  // Never touch a build that is about to be signed for real. This hook runs
  // before electron-builder signs, but re-signing ad-hoc here would be one
  // ordering change away from silently invalidating a Developer ID signature.
  if (process.env.CSC_LINK || process.env.CSC_NAME || process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'true') {
    console.log('[afterPack] signing identity present; leaving signature to electron-builder')
    return
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )

  try {
    execFileSync(
      'codesign',
      ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath],
      { stdio: 'inherit' }
    )
    console.log(`[afterPack] ad-hoc signed ${appPath}`)
  } catch (error) {
    console.warn(`[afterPack] ad-hoc signing failed: ${error.message}`)
  }
}
