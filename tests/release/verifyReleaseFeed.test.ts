import { describe, expect, it } from 'vitest'
import { validateReleaseManifest } from '../../scripts/verify-release-feed'

const BASE_URL = 'https://downloads.jura-wolpi.de/desktop/stable'
const VERSION = '1.2.3'

describe('validateReleaseManifest', () => {
  it('accepts exactly the four supported unique platform and architecture entries', () => {
    expect(() => validateReleaseManifest(validManifest(), BASE_URL)).not.toThrow()
  })

  it('rejects duplicate and missing supported entries', () => {
    const manifest = validManifest()
    manifest.releases[3] = { ...manifest.releases[2] }

    expect(() => validateReleaseManifest(manifest, BASE_URL)).toThrow(/duplicate.*windows.*x64|missing.*linux.*x64/i)
  })

  it('rejects unsupported platform and architecture entries', () => {
    const manifest = validManifest()
    manifest.releases[3] = release('linux', 'arm64', 'App-arm64.AppImage')

    expect(() => validateReleaseManifest(manifest, BASE_URL)).toThrow(/unsupported.*linux.*arm64/i)
  })

  it('requires every release entry version to equal manifest.version', () => {
    const manifest = validManifest()
    manifest.releases[0] = { ...manifest.releases[0], version: '1.2.2' }

    expect(() => validateReleaseManifest(manifest, BASE_URL)).toThrow(/entry version.*manifest version/i)
  })

  it('requires release URLs to stay under the approved feed platform and version path', () => {
    const manifest = validManifest()
    manifest.releases[0] = {
      ...manifest.releases[0],
      url: 'https://attacker.example/desktop/stable/mac/arm64/1.2.3/App-arm64.dmg'
    }

    expect(() => validateReleaseManifest(manifest, BASE_URL)).toThrow(/approved feed path/i)
  })
})

function validManifest() {
  return {
    version: VERSION,
    publishedAt: '2026-07-12T10:00:00.000Z',
    releases: [
      release('mac', 'arm64', 'App-arm64.dmg'),
      release('mac', 'x64', 'App-x64.dmg'),
      release('windows', 'x64', 'App-x64.exe'),
      release('linux', 'x64', 'App-x64.AppImage')
    ]
  }
}

function release(platform: 'mac' | 'windows' | 'linux', arch: 'arm64' | 'x64', fileName: string) {
  return {
    platform,
    arch,
    version: VERSION,
    fileName,
    size: 123,
    sha512: 'checksum',
    url: `${BASE_URL}/${platform}/${arch}/${VERSION}/${encodeURIComponent(fileName)}`
  }
}
