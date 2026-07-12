import { describe, expect, it } from 'vitest'
import { resolveUpdateFeedUrl } from '@main/updateFeed'

describe('resolveUpdateFeedUrl', () => {
  it('maps supported platforms and architectures to the stable feed', () => {
    expect(resolveUpdateFeedUrl({ platform: 'darwin', arch: 'arm64' })).toBe(
      'https://downloads.jura-wolpi.de/desktop/stable/mac/arm64'
    )
    expect(resolveUpdateFeedUrl({ platform: 'darwin', arch: 'x64' })).toBe(
      'https://downloads.jura-wolpi.de/desktop/stable/mac/x64'
    )
    expect(resolveUpdateFeedUrl({ platform: 'win32', arch: 'x64' })).toBe(
      'https://downloads.jura-wolpi.de/desktop/stable/windows/x64'
    )
    expect(resolveUpdateFeedUrl({ platform: 'linux', arch: 'x64' })).toBe(
      'https://downloads.jura-wolpi.de/desktop/stable/linux/x64'
    )
  })

  it('returns null for unsupported platform and architecture combinations', () => {
    expect(resolveUpdateFeedUrl({ platform: 'win32', arch: 'arm64' })).toBeNull()
    expect(resolveUpdateFeedUrl({ platform: 'linux', arch: 'arm64' })).toBeNull()
    expect(resolveUpdateFeedUrl({ platform: 'darwin', arch: 'ia32' })).toBeNull()
    expect(resolveUpdateFeedUrl({ platform: 'freebsd', arch: 'x64' })).toBeNull()
  })

  it('normalizes trailing slashes in the base URL', () => {
    expect(
      resolveUpdateFeedUrl({
        baseUrl: 'https://downloads.jura-wolpi.de/desktop/stable/',
        platform: 'darwin',
        arch: 'arm64'
      })
    ).toBe('https://downloads.jura-wolpi.de/desktop/stable/mac/arm64')
  })

  it('supports a custom local HTTP base URL', () => {
    expect(
      resolveUpdateFeedUrl({
        baseUrl: 'http://localhost:3000/releases',
        platform: 'linux',
        arch: 'x64'
      })
    ).toBe('http://localhost:3000/releases/linux/x64')
  })
})
