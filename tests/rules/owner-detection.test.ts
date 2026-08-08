import { describe, it, expect } from 'vitest'
import { ownerToken, isOwnerRunning } from '../../src/main/rules/processes'
import type { RunningApps } from '../../src/main/rules/types'

function running(bundles: string[], paths: string[] = []): RunningApps {
  return {
    bundles: new Set(bundles),
    displayNames: new Map(bundles.map((name) => [name, name])),
    paths
  }
}

describe('ownerToken', () => {
  it('strips updater suffixes and generic segments', () => {
    expect(ownerToken('com.trae.app.ShipIt')).toBe('trae')
    expect(ownerToken('com.postmanlabs.mac.ShipIt')).toBe('postmanlabs')
    expect(ownerToken('zoho-mail-desktop-updater')).toBe('zoho')
    expect(ownerToken('com.zoho.mail.desktop.ShipIt')).toBe('zoho')
  })

  it('uses only the first meaningful segment', () => {
    // Matching on every segment would make this collide with Apple Mail.
    expect(ownerToken('zoho-mail-desktop-updater')).not.toBe('mail')
  })
})

describe('isOwnerRunning', () => {
  it('detects an owner whose bundle name is shorter than the token', () => {
    // The regression this exists for: "postmanlabs" vs a running "Postman".
    expect(isOwnerRunning('com.postmanlabs.mac.ShipIt', running(['postman']))).toBe(true)
    expect(isOwnerRunning('com.postmanlabs.mac.ShipIt', running(['postman helper']))).toBe(true)
  })

  it('detects an owner whose bundle name is longer than the token', () => {
    expect(isOwnerRunning('com.trae.app.ShipIt', running(['trae helper (renderer)']))).toBe(true)
  })

  it('detects an owner from a process path', () => {
    expect(
      isOwnerRunning('zoho-mail-desktop-updater', running([], ['/applications/zoho mail.app/x']))
    ).toBe(true)
  })

  it('does not match an unrelated app', () => {
    expect(isOwnerRunning('com.trae.app.ShipIt', running(['google chrome', 'finder']))).toBe(false)
    expect(isOwnerRunning('com.zoho.mail.desktop.ShipIt', running(['zoom']))).toBe(false)
  })

  it('ignores tokens too short to be meaningful', () => {
    // A three-letter token would match half the process table.
    expect(isOwnerRunning('com.ab.ShipIt', running(['absolutely unrelated app']))).toBe(false)
  })
})
