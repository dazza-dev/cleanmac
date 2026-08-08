# Homebrew Cask for CleanMac.
#
# Served from this repository as a tap, so there is nothing to get accepted into
# homebrew-cask before the first release.
#
# NOTE: this is NOT wired into the release workflow, on purpose. Releases from
# this repository are unsigned, and a `brew install --cask` that lands the user
# on a Gatekeeper block is a worse experience than no cask at all. It is kept
# for anyone who forks this with a Developer ID: sign the build, set `sha256`
# and `version` to match your artefact, and the tap works.
#
#   brew tap dazza-dev/cleanmac https://github.com/dazza-dev/cleanmac
#   brew install --cask cleanmac
#
# `sha256` and `version` are rewritten by .github/workflows/release.yml from the
# artefact it just built, so they are never edited by hand.
cask "cleanmac" do
  version "1.0.0"
  sha256 :no_check

  url "https://github.com/dazza-dev/cleanmac/releases/download/v#{version}/CleanMac-#{version}-arm64.dmg"
  name "CleanMac"
  desc "Open source storage and performance cleaner for macOS"
  homepage "https://github.com/dazza-dev/cleanmac"

  # Apple Silicon only, matching what electron-builder produces.
  depends_on arch: :arm64
  depends_on macos: ">= :ventura"

  auto_updates true

  app "CleanMac.app"

  # The app's own data. `zap` is opt-in (`brew uninstall --zap`), which is the
  # right default for something holding a cleanup history the user may want.
  zap trash: [
    "~/Library/Application Support/CleanMac",
    "~/Library/Caches/dev.dazza.cleanmac",
    "~/Library/Preferences/dev.dazza.cleanmac.plist",
    "~/Library/Saved Application State/dev.dazza.cleanmac.savedState",
    "~/Library/Logs/CleanMac"
  ]
end
