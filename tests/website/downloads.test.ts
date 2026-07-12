import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const projectRoot = process.cwd()
const downloadsCoreUrl = pathToFileURL(resolve(projectRoot, 'docs/downloads-core.js')).href

async function loadDownloadsCore() {
  return import(downloadsCoreUrl)
}

function createManifest(overrides?: Partial<{
  version: string
  publishedAt: string
  releases: Array<Record<string, unknown>>
}>) {
  return {
    version: '1.2.3',
    publishedAt: '2026-07-12T10:00:00.000Z',
    releases: [
      {
        platform: 'windows',
        arch: 'x64',
        version: '1.2.3',
        fileName: 'Jura Wolpertinger-x64-win.exe',
        size: 84 * 1024 * 1024,
        sha512: 'sha-windows',
        url: 'https://downloads.jura-wolpi.de/desktop/stable/windows/x64/1.2.3/Jura%20Wolpertinger-x64-win.exe'
      },
      {
        platform: 'mac',
        arch: 'arm64',
        version: '1.2.3',
        fileName: 'Jura Wolpertinger-arm64-mac.dmg',
        size: 92 * 1024 * 1024,
        sha512: 'sha-mac-arm',
        url: 'https://downloads.jura-wolpi.de/desktop/stable/mac/arm64/1.2.3/Jura%20Wolpertinger-arm64-mac.dmg'
      },
      {
        platform: 'mac',
        arch: 'x64',
        version: '1.2.3',
        fileName: 'Jura Wolpertinger-x64-mac.dmg',
        size: 95 * 1024 * 1024,
        sha512: 'sha-mac-x64',
        url: 'https://downloads.jura-wolpi.de/desktop/stable/mac/x64/1.2.3/Jura%20Wolpertinger-x64-mac.dmg'
      },
      {
        platform: 'linux',
        arch: 'x64',
        version: '1.2.3',
        fileName: 'Jura Wolpertinger-x64-linux.AppImage',
        size: 101 * 1024 * 1024,
        sha512: 'sha-linux',
        url: 'https://downloads.jura-wolpi.de/desktop/stable/linux/x64/1.2.3/Jura%20Wolpertinger-x64-linux.AppImage'
      }
    ],
    ...overrides
  }
}

describe('download manifest adapter', () => {
  it('selects the Windows x64 download', async () => {
    const { selectDownload } = await loadDownloadsCore()

    expect(selectDownload(createManifest(), 'windows', 'x64')).toMatchObject({
      platform: 'windows',
      arch: 'x64',
      fileName: 'Jura Wolpertinger-x64-win.exe'
    })
  })

  it('selects the macOS Apple Silicon download', async () => {
    const { selectDownload } = await loadDownloadsCore()

    expect(selectDownload(createManifest(), 'macos', 'arm64')).toMatchObject({
      platform: 'mac',
      arch: 'arm64',
      fileName: 'Jura Wolpertinger-arm64-mac.dmg'
    })
  })

  it('selects the macOS Intel download', async () => {
    const { selectDownload } = await loadDownloadsCore()

    expect(selectDownload(createManifest(), 'macos', 'x64')).toMatchObject({
      platform: 'mac',
      arch: 'x64',
      fileName: 'Jura Wolpertinger-x64-mac.dmg'
    })
  })

  it('selects the Linux x64 download', async () => {
    const { selectDownload } = await loadDownloadsCore()

    expect(selectDownload(createManifest(), 'linux', 'x64')).toMatchObject({
      platform: 'linux',
      arch: 'x64',
      fileName: 'Jura Wolpertinger-x64-linux.AppImage'
    })
  })

  it('returns null for unknown operating systems', async () => {
    const { selectDownload } = await loadDownloadsCore()

    expect(selectDownload(createManifest(), 'freebsd', 'x64')).toBeNull()
  })

  it('returns null for malformed manifests', async () => {
    const { selectDownload } = await loadDownloadsCore()

    expect(selectDownload({ releases: 'nope' }, 'windows', 'x64')).toBeNull()
  })

  it('returns null when the requested platform is missing', async () => {
    const { selectDownload } = await loadDownloadsCore()
    const manifest = createManifest({
      releases: createManifest().releases.filter((release) => release.platform !== 'windows')
    })

    expect(selectDownload(manifest, 'windows', 'x64')).toBeNull()
  })

  it('rejects manifests with unsafe URLs', async () => {
    const { selectDownload } = await loadDownloadsCore()
    const manifest = createManifest({
      releases: [
        {
          platform: 'windows',
          arch: 'x64',
          version: '1.2.3',
          fileName: 'Jura Wolpertinger-x64-win.exe',
          size: 84 * 1024 * 1024,
          sha512: 'sha-windows',
          url: 'javascript:alert(1)'
        }
      ]
    })

    expect(selectDownload(manifest, 'windows', 'x64')).toBeNull()
  })

  it('formats a download label with a human-readable size', async () => {
    const { formatDownloadLabel } = await loadDownloadsCore()

    expect(
      formatDownloadLabel({
        fileName: 'Jura Wolpertinger-x64-win.exe',
        size: 84 * 1024 * 1024
      })
    ).toBe('Jura Wolpertinger-x64-win.exe · 84.0 MB')
  })
})

describe('production download docs', () => {
  it('fetches the hosted manifest without falling back to GitHub release APIs', async () => {
    const [scriptSource, coreSource] = await Promise.all([
      readFile(resolve(projectRoot, 'docs/downloads.js'), 'utf8'),
      readFile(resolve(projectRoot, 'docs/downloads-core.js'), 'utf8')
    ])

    expect(coreSource).toContain('https://downloads.jura-wolpi.de/desktop/stable/manifest.json')
    expect(scriptSource).toContain("cache: 'no-cache'")
    expect(scriptSource).not.toContain('api.github.com')
    expect(scriptSource).not.toContain('browser_download_url')
  })

  it('removes direct releases/latest/download links from public docs', async () => {
    const [indexSource, readmeSource] = await Promise.all([
      readFile(resolve(projectRoot, 'docs/index.html'), 'utf8'),
      readFile(resolve(projectRoot, 'README.md'), 'utf8')
    ])

    expect(indexSource).not.toContain('releases/latest/download')
    expect(readmeSource).not.toContain('releases/latest/download')
  })
})
