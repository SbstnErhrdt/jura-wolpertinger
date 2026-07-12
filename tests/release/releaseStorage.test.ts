import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import YAML from 'yaml'
import { readReleaseStorageConfig } from '../../scripts/release/config'
import { verifyReleaseFeed } from '../../scripts/verify-release-feed'
import {
  IMMUTABLE_CACHE_CONTROL,
  MUTABLE_METADATA_CACHE_CONTROL,
  immutableObjectKey,
  mutableMetadataKey,
  publishRelease,
  stageRelease,
  ReleaseObjectAlreadyExistsError,
  type ReleaseObjectStorage,
  type ReleasePutObjectInput
} from '../../scripts/release/storage'

const VERSION = '1.2.3'
const PRODUCT_NAME = 'Jura Wolpertinger'
const PUBLIC_BASE_URL = 'https://downloads.jura-wolpi.de/desktop/stable'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  vi.unstubAllGlobals()
})

describe('readReleaseStorageConfig', () => {
  it('validates all required variables without exposing secret values', () => {
    const env = {
      UPDATE_S3_ENDPOINT: 'https://rustfs.internal.example',
      UPDATE_S3_BUCKET: '',
      UPDATE_S3_ACCESS_KEY_ID: 'do-not-print-access-key',
      UPDATE_S3_SECRET_ACCESS_KEY: 'do-not-print-secret',
      UPDATE_PUBLIC_BASE_URL: ''
    }

    expect(() => readReleaseStorageConfig(env)).toThrowError(
      /UPDATE_S3_BUCKET.*UPDATE_PUBLIC_BASE_URL/i
    )

    try {
      readReleaseStorageConfig(env)
    } catch (error) {
      const message = String((error as Error).message)

      expect(message).not.toContain('do-not-print-access-key')
      expect(message).not.toContain('do-not-print-secret')
      expect(message).not.toContain('rustfs.internal.example')
    }
  })

  it('requires the public base URL to use HTTPS', () => {
    expect(() =>
      readReleaseStorageConfig({
        UPDATE_S3_ENDPOINT: 'https://rustfs.internal.example',
        UPDATE_S3_BUCKET: 'release-bucket',
        UPDATE_S3_ACCESS_KEY_ID: 'do-not-print-access-key',
        UPDATE_S3_SECRET_ACCESS_KEY: 'do-not-print-secret',
        UPDATE_PUBLIC_BASE_URL: 'http://downloads.jura-wolpi.de/desktop/stable'
      })
    ).toThrow(/UPDATE_PUBLIC_BASE_URL.*HTTPS/i)
  })
})

describe('release object keys', () => {
  it('builds immutable and mutable keys under the stable desktop feed prefix', () => {
    expect(immutableObjectKey('mac-arm64', VERSION, `${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`)).toBe(
      `desktop/stable/mac/arm64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`)}`
    )
    expect(mutableMetadataKey('windows-x64', 'latest.yml')).toBe('desktop/stable/windows/x64/latest.yml')
  })
})

describe('stageRelease', () => {
  it('uploads only immutable versioned objects with immutable cache headers', async () => {
    const directory = await createReleaseFixture('mac-arm64')
    const storage = new InMemoryReleaseStorage()

    const result = await stageRelease({
      storage,
      platform: 'mac-arm64',
      inputDirectory: directory
    })

    expect(result.uploadedKeys.length).toBeGreaterThan(0)
    expect(storage.puts.map(({ key }) => key).sort()).toEqual(result.uploadedKeys.sort())
    expect(storage.puts.every(({ key }) => key.startsWith('desktop/stable/mac/arm64/1.2.3/'))).toBe(true)
    expect(storage.puts.map(({ cacheControl }) => cacheControl)).toEqual(
      Array.from({ length: storage.puts.length }, () => IMMUTABLE_CACHE_CONTROL)
    )
    expect(storage.puts.some(({ key }) => key.endsWith('/latest-mac.yml'))).toBe(true)
    expect(storage.puts.some(({ key }) => key === 'desktop/stable/mac/arm64/latest-mac.yml')).toBe(false)
  })

  it('performs no writes during a dry run', async () => {
    const directory = await createReleaseFixture('linux-x64')
    const storage = new InMemoryReleaseStorage()

    const result = await stageRelease({
      storage,
      platform: 'linux-x64',
      inputDirectory: directory,
      dryRun: true
    })

    expect(result.uploadedKeys).toEqual([])
    expect(result.plannedKeys.every((key) => key.startsWith('desktop/stable/linux/x64/1.2.3/'))).toBe(true)
    expect(storage.puts).toEqual([])
  })

  it('accepts an identical idempotent restage without overwriting immutable objects', async () => {
    const directory = await createReleaseFixture('mac-arm64')
    const storage = new InMemoryReleaseStorage()

    const firstResult = await stageRelease({
      storage,
      platform: 'mac-arm64',
      inputDirectory: directory
    })
    storage.clearPutLog()

    const secondResult = await stageRelease({
      storage,
      platform: 'mac-arm64',
      inputDirectory: directory
    })

    expect(secondResult.plannedKeys).toEqual(firstResult.plannedKeys)
    expect(secondResult.uploadedKeys).toEqual([])
    expect(storage.puts).toEqual([])
    expect(storage.operations.filter(({ type }) => type === 'head')).toHaveLength(firstResult.plannedKeys.length)
    expect(storage.operations.filter(({ type }) => type === 'get')).toHaveLength(firstResult.plannedKeys.length)
  })

  it('rejects an immutable byte mismatch without writing any object', async () => {
    const directory = await createReleaseFixture('mac-arm64')
    const storage = new InMemoryReleaseStorage()
    await stageRelease({ storage, platform: 'mac-arm64', inputDirectory: directory })
    const key = immutableObjectKey(
      'mac-arm64',
      VERSION,
      `${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`
    )
    const expected = await storage.get({ key })
    await storage.seed(key, new TextEncoder().encode('different immutable bytes'), {
      contentType: 'application/x-apple-diskimage',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: {
        sha512: sha512(expected),
        size: String(expected.length)
      },
      contentLength: expected.length
    })
    storage.clearPutLog()

    await expect(
      stageRelease({ storage, platform: 'mac-arm64', inputDirectory: directory })
    ).rejects.toThrow(/immutable.*bytes.*mismatch.*mac-arm64/i)

    expect(storage.puts).toEqual([])
    expect(storage.operations.filter(({ type }) => type === 'head')).toHaveLength(releaseFiles('mac-arm64').length)
  })

  it('preflights every planned object before uploading any missing object', async () => {
    const directory = await createReleaseFixture('linux-x64')
    const storage = new InMemoryReleaseStorage()
    const mismatchedKey = immutableObjectKey('linux-x64', VERSION, 'latest-linux.yml')
    const mismatchedBody = new TextEncoder().encode('wrong metadata bytes')
    await storage.seed(mismatchedKey, mismatchedBody, {
      contentType: 'text/yaml; charset=utf-8',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: {
        sha512: sha512(mismatchedBody),
        size: String(mismatchedBody.length)
      }
    })

    await expect(
      stageRelease({ storage, platform: 'linux-x64', inputDirectory: directory })
    ).rejects.toThrow(/immutable.*mismatch.*linux-x64/i)

    expect(storage.puts).toEqual([])
    expect(storage.operations.filter(({ type }) => type === 'head')).toHaveLength(releaseFiles('linux-x64').length)
  })

  it('requires canonical immutable size metadata before any upload', async () => {
    const directory = await createReleaseFixture('linux-x64')
    const storage = new InMemoryReleaseStorage()
    await stageRelease({ storage, platform: 'linux-x64', inputDirectory: directory })
    const key = immutableObjectKey('linux-x64', VERSION, 'latest-linux.yml')
    const body = await storage.get({ key })
    await storage.seed(key, body, {
      contentType: 'application/x-yaml; charset=utf-8',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: {
        sha512: sha512(body),
        size: `0${body.length}`
      }
    })
    storage.clearPutLog()

    await expect(
      stageRelease({ storage, platform: 'linux-x64', inputDirectory: directory })
    ).rejects.toThrow(/immutable.*checksum or size metadata.*mismatch/i)

    expect(storage.puts).toEqual([])
  })

  it('does not overwrite an immutable object created after preflight', async () => {
    const directory = await createReleaseFixture('linux-x64')
    const backingStorage = new InMemoryReleaseStorage()
    let raced = false
    const storage: ReleaseObjectStorage = {
      head: (input) => backingStorage.head(input),
      get: (input) => backingStorage.get(input),
      async put(input) {
        if (!raced) {
          raced = true
          await backingStorage.put({
            ...input,
            body: new TextEncoder().encode('concurrent conflicting bytes'),
            metadata: {
              sha512: sha512('concurrent conflicting bytes'),
              size: String(Buffer.byteLength('concurrent conflicting bytes'))
            }
          })
          throw new ReleaseObjectAlreadyExistsError(input.key)
        }

        await backingStorage.put(input)
      }
    }

    await expect(
      stageRelease({ storage, platform: 'linux-x64', inputDirectory: directory })
    ).rejects.toThrow(/immutable.*mismatch.*linux-x64/i)

    expect(backingStorage.puts).toHaveLength(1)
    expect(new TextDecoder().decode(await backingStorage.get({ key: backingStorage.puts[0].key })))
      .toBe('concurrent conflicting bytes')
  })
})

describe('publishRelease', () => {
  it('requires exact confirmation text before publishing', async () => {
    const storage = await createCompleteRemoteStorage()

    await expect(
      publishRelease({
        storage,
        version: VERSION,
        confirm: `publish ${VERSION} `,
        publicBaseUrl: PUBLIC_BASE_URL,
        publishedAt: '2026-07-12T10:00:00.000Z'
      })
    ).rejects.toThrow(/confirm.*publish 1\.2\.3/i)

    expect(storage.puts).toEqual([])
  })

  it('refuses incomplete remote platform sets', async () => {
    const storage = await createCompleteRemoteStorage()
    await storage.delete(immutableObjectKey('linux-x64', VERSION, 'latest-linux.yml'))

    await expect(
      publishRelease({
        storage,
        version: VERSION,
        confirm: `publish ${VERSION}`,
        publicBaseUrl: PUBLIC_BASE_URL,
        publishedAt: '2026-07-12T10:00:00.000Z'
      })
    ).rejects.toThrow(/linux-x64.*latest-linux\.yml/i)

    expect(storage.puts.map(({ key: putKey }) => putKey)).toEqual([
      'desktop/stable/mac/arm64/latest-mac.yml',
      'desktop/stable/mac/x64/latest-mac.yml',
      'desktop/stable/windows/x64/latest.yml'
    ])
  })

  it('refuses checksum mismatches before writing the affected platform latest metadata', async () => {
    const storage = await createCompleteRemoteStorage()
    const key = immutableObjectKey('windows-x64', VERSION, `${PRODUCT_NAME}-${VERSION}-x64-win.exe`)
    const existing = await storage.get({ key })
    await storage.seed(key, new TextEncoder().encode('WINDOWS EXE BYTES'), {
      contentType: 'application/vnd.microsoft.portable-executable',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: {
        sha512: sha512(existing),
        size: String(existing.length)
      },
      contentLength: existing.length
    })

    await expect(
      publishRelease({
        storage,
        version: VERSION,
        confirm: `publish ${VERSION}`,
        publicBaseUrl: PUBLIC_BASE_URL,
        publishedAt: '2026-07-12T10:00:00.000Z'
      })
    ).rejects.toThrow(/checksum.*windows-x64/i)

    expect(storage.puts.map(({ key: putKey }) => putKey)).toEqual([
      'desktop/stable/mac/arm64/latest-mac.yml',
      'desktop/stable/mac/x64/latest-mac.yml'
    ])
  })

  it('refuses downloaded byte-length mismatches even when HEAD metadata matches', async () => {
    const storage = await createCompleteRemoteStorage()
    const key = immutableObjectKey('mac-arm64', VERSION, `${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`)
    const existing = await storage.get({ key })

    await storage.seed(key, existing.slice(0, -1), {
      contentType: 'application/x-apple-diskimage',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: {
        sha512: sha512(existing),
        size: String(existing.length)
      },
      contentLength: existing.length
    })

    await expect(
      publishRelease({
        storage,
        version: VERSION,
        confirm: `publish ${VERSION}`,
        publicBaseUrl: PUBLIC_BASE_URL,
        publishedAt: '2026-07-12T10:00:00.000Z'
      })
    ).rejects.toThrow(/byte length.*mac-arm64/i)

    expect(storage.puts).toEqual([])
  })

  it('validates blockmap bytes and size against staged object data', async () => {
    const storage = await createCompleteRemoteStorage()
    const key = immutableObjectKey('linux-x64', VERSION, `${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage.blockmap`)
    const existing = await storage.get({ key })

    await storage.seed(key, new TextEncoder().encode('LINUX BLOCKMAP BYTES'), {
      contentType: 'application/octet-stream',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: {
        sha512: sha512(existing),
        size: String(existing.length)
      },
      contentLength: existing.length
    })

    await expect(
      publishRelease({
        storage,
        version: VERSION,
        confirm: `publish ${VERSION}`,
        publicBaseUrl: PUBLIC_BASE_URL,
        publishedAt: '2026-07-12T10:00:00.000Z'
      })
    ).rejects.toThrow(/blockmap.*linux-x64/i)

    expect(storage.puts.map(({ key: putKey }) => putKey)).toEqual([
      'desktop/stable/mac/arm64/latest-mac.yml',
      'desktop/stable/mac/x64/latest-mac.yml',
      'desktop/stable/windows/x64/latest.yml'
    ])
  })

  it('publishes each platform latest only after that platform immutable objects pass and keeps manifest final', async () => {
    const storage = await createCompleteRemoteStorage()
    const key = immutableObjectKey('linux-x64', VERSION, `${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`)
    const existing = await storage.get({ key })

    await storage.seed(key, new TextEncoder().encode('LINUX APPIMAGE BYTES'), {
      contentType: 'application/octet-stream',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: {
        sha512: sha512(existing),
        size: String(existing.length)
      },
      contentLength: existing.length
    })

    await expect(
      publishRelease({
        storage,
        version: VERSION,
        confirm: `publish ${VERSION}`,
        publicBaseUrl: PUBLIC_BASE_URL,
        publishedAt: '2026-07-12T10:00:00.000Z'
      })
    ).rejects.toThrow(/checksum.*linux-x64/i)

    expect(storage.puts.map(({ key: putKey }) => putKey)).toEqual([
      'desktop/stable/mac/arm64/latest-mac.yml',
      'desktop/stable/mac/x64/latest-mac.yml',
      'desktop/stable/windows/x64/latest.yml'
    ])
    expect(storage.puts.some(({ key: putKey }) => putKey === 'desktop/stable/linux/x64/latest-linux.yml')).toBe(false)
    expect(storage.puts.some(({ key: putKey }) => putKey === 'desktop/stable/manifest.json')).toBe(false)

    for (const put of storage.puts) {
      const platformPrefix = put.key.split('/').slice(0, 4).join('/')
      const verificationOperations = storage.operations.filter(
        (operation) =>
          (operation.type === 'head' || operation.type === 'get') &&
          operation.key.startsWith(`${platformPrefix}/${VERSION}/`)
      )
      const putIndex = storage.operations.findIndex((operation) => operation.type === 'put' && operation.key === put.key)

      expect(verificationOperations.length).toBeGreaterThan(0)
      expect(verificationOperations.every((operation) => operation.index < putIndex)).toBe(true)
    }
  })

  it('rejects normalized traversal in update metadata before publishing any live metadata', async () => {
    const storage = await createCompleteRemoteStorage()
    const metadataKey = immutableObjectKey('mac-arm64', VERSION, 'latest-mac.yml')
    const body = new TextEncoder().encode(YAML.stringify({
      version: VERSION,
      files: [{
        url: `${VERSION}/%2e%2e/escape.dmg`,
        sha512: sha512('escape'),
        size: 6
      }]
    }))
    await storage.seed(metadataKey, body, {
      contentType: 'application/x-yaml; charset=utf-8',
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: { sha512: sha512(body), size: String(body.length) }
    })

    await expect(
      publishRelease({
        storage,
        version: VERSION,
        confirm: `publish ${VERSION}`,
        publicBaseUrl: PUBLIC_BASE_URL
      })
    ).rejects.toThrow(/approved version path|metadata URL/i)

    expect(storage.puts).toEqual([])
  })

  it('uploads every latest metadata file before manifest.json last using mutable cache headers', async () => {
    const storage = await createCompleteRemoteStorage()

    const result = await publishRelease({
      storage,
      version: VERSION,
      confirm: `publish ${VERSION}`,
      publicBaseUrl: PUBLIC_BASE_URL,
      publishedAt: '2026-07-12T10:00:00.000Z'
    })

    expect(storage.puts.map(({ key }) => key)).toEqual([
      'desktop/stable/mac/arm64/latest-mac.yml',
      'desktop/stable/mac/x64/latest-mac.yml',
      'desktop/stable/windows/x64/latest.yml',
      'desktop/stable/linux/x64/latest-linux.yml',
      'desktop/stable/manifest.json'
    ])
    expect(storage.puts.map(({ cacheControl }) => cacheControl)).toEqual([
      MUTABLE_METADATA_CACHE_CONTROL,
      MUTABLE_METADATA_CACHE_CONTROL,
      MUTABLE_METADATA_CACHE_CONTROL,
      MUTABLE_METADATA_CACHE_CONTROL,
      MUTABLE_METADATA_CACHE_CONTROL
    ])
    expect(result.manifestKey).toBe('desktop/stable/manifest.json')
    expect(result.publishedMetadataKeys).toEqual(storage.puts.slice(0, 4).map(({ key }) => key))
  })
})

describe('verifyReleaseFeed', () => {
  it('parses latest metadata and HEAD-verifies every referenced artifact through injected fetch', async () => {
    const fakeFetch = createReleaseFeedFetch()
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('real network must not be used')
    }))

    await verifyReleaseFeed(PUBLIC_BASE_URL, {
      fetch: fakeFetch
    })

    expect(fakeFetch.calls.filter(({ method }) => method === 'HEAD').map(({ url }) => url).sort()).toEqual([
      `${PUBLIC_BASE_URL}/linux/x64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`)}`,
      `${PUBLIC_BASE_URL}/mac/arm64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`)}`,
      `${PUBLIC_BASE_URL}/mac/arm64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`)}`,
      `${PUBLIC_BASE_URL}/mac/x64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-x64-mac.dmg`)}`,
      `${PUBLIC_BASE_URL}/mac/x64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-x64-mac.zip`)}`,
      `${PUBLIC_BASE_URL}/windows/x64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-x64-win.exe`)}`
    ].sort())
  })

  it('rejects unsafe latest metadata artifact URLs before issuing artifact HEAD requests', async () => {
    const fakeFetch = createReleaseFeedFetch({
      metadataOverrides: {
        'mac/arm64': YAML.stringify({
          version: VERSION,
          files: [
            {
              url: '../escape.dmg',
              sha512: sha512('escape'),
              size: 6
            }
          ]
        })
      }
    })

    await expect(
      verifyReleaseFeed(PUBLIC_BASE_URL, {
        fetch: fakeFetch
      })
    ).rejects.toThrow(/relative object path|unsafe/i)

    expect(fakeFetch.calls.some(({ method, url }) => method === 'HEAD' && url.includes('escape'))).toBe(false)
  })

  it('rejects encoded dot segments in latest metadata before issuing artifact HEAD requests', async () => {
    const fakeFetch = createReleaseFeedFetch({
      metadataOverrides: {
        'mac/arm64': YAML.stringify({
          version: VERSION,
          files: [
            {
              url: `${VERSION}/%2e%2e/escape.dmg`,
              sha512: sha512('escape'),
              size: 6
            }
          ]
        })
      }
    })

    await expect(
      verifyReleaseFeed(PUBLIC_BASE_URL, {
        fetch: fakeFetch
      })
    ).rejects.toThrow(/approved version path|unsafe/i)

    expect(fakeFetch.calls.some(({ method, url }) => method === 'HEAD' && url.includes('escape'))).toBe(false)
  })

  it('rejects artifact-specific MIME mismatches', async () => {
    const normalFetch = createReleaseFeedFetch()
    const fakeFetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (init?.method === 'HEAD' && url.endsWith('.exe')) {
        return new Response(null, {
          status: 200,
          headers: {
            'content-length': String(Buffer.byteLength('windows exe bytes')),
            'content-type': 'text/plain',
            'cache-control': IMMUTABLE_CACHE_CONTROL
          }
        })
      }

      return normalFetch(input, init)
    }, { calls: normalFetch.calls })

    await expect(
      verifyReleaseFeed(PUBLIC_BASE_URL, { fetch: fakeFetch })
    ).rejects.toThrow(/\.exe.*content-type|content-type.*portable-executable/i)
  })
})

async function createCompleteRemoteStorage() {
  const storage = new InMemoryReleaseStorage()

  for (const platform of ['mac-arm64', 'mac-x64', 'windows-x64', 'linux-x64'] as const) {
    const directory = await createReleaseFixture(platform)
    await stageRelease({
      storage,
      platform,
      inputDirectory: directory
    })
  }

  storage.clearPutLog()

  return storage
}

async function createReleaseFixture(platform: 'mac-arm64' | 'mac-x64' | 'windows-x64' | 'linux-x64') {
  const directory = await mkdtemp(join(tmpdir(), 'release-storage-'))
  temporaryDirectories.push(directory)
  await mkdir(directory, { recursive: true })

  for (const file of releaseFiles(platform)) {
    await writeFile(join(directory, file.fileName), file.content)
  }

  return directory
}

function releaseFiles(platform: 'mac-arm64' | 'mac-x64' | 'windows-x64' | 'linux-x64') {
  if (platform === 'mac-arm64') {
    return macFiles('arm64')
  }

  if (platform === 'mac-x64') {
    return macFiles('x64')
  }

  if (platform === 'windows-x64') {
    const exe = artifact(`${PRODUCT_NAME}-${VERSION}-x64-win.exe`, 'windows exe bytes')

    return [
      exe,
      artifact(`${PRODUCT_NAME}-${VERSION}-x64-win.exe.blockmap`, 'windows blockmap bytes'),
      metadata('latest.yml', [exe])
    ]
  }

  const appImage = artifact(`${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`, 'linux appimage bytes')

  return [
    appImage,
    artifact(`${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage.blockmap`, 'linux blockmap bytes'),
    metadata('latest-linux.yml', [appImage])
  ]
}

function macFiles(arch: 'arm64' | 'x64') {
  const dmg = artifact(`${PRODUCT_NAME}-${VERSION}-${arch}-mac.dmg`, `mac ${arch} dmg bytes`)
  const zip = artifact(`${PRODUCT_NAME}-${VERSION}-${arch}-mac.zip`, `mac ${arch} zip bytes`)

  return [
    dmg,
    zip,
    artifact(`${PRODUCT_NAME}-${VERSION}-${arch}-mac.zip.blockmap`, `mac ${arch} blockmap bytes`),
    metadata('latest-mac.yml', [zip, dmg])
  ]
}

function artifact(fileName: string, content: string) {
  return {
    fileName,
    content
  }
}

function metadata(fileName: string, files: Array<{ fileName: string; content: string }>) {
  return {
    fileName,
    content: YAML.stringify({
      version: VERSION,
      path: files[0].fileName,
      files: files.map((file) => ({
        url: file.fileName,
        sha512: sha512(file.content),
        size: Buffer.byteLength(file.content)
      })),
      releaseDate: '2026-07-12T10:00:00.000Z'
    })
  }
}

function sha512(content: string | Uint8Array) {
  return createHash('sha512').update(content).digest('base64')
}

function createReleaseFeedFetch(options?: {
  metadataOverrides?: Record<string, string>
}) {
  const calls: Array<{ url: string; method: string }> = []
  const manifest = {
    version: VERSION,
    publishedAt: '2026-07-12T10:00:00.000Z',
    releases: [
      manifestRelease('mac', 'arm64', `${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`, 'mac arm64 dmg bytes'),
      manifestRelease('mac', 'x64', `${PRODUCT_NAME}-${VERSION}-x64-mac.dmg`, 'mac x64 dmg bytes'),
      manifestRelease('windows', 'x64', `${PRODUCT_NAME}-${VERSION}-x64-win.exe`, 'windows exe bytes'),
      manifestRelease('linux', 'x64', `${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`, 'linux appimage bytes')
    ]
  }
  const metadata: Record<string, string> = {
    'mac/arm64': latestYaml([
      artifact(`${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`, 'mac arm64 zip bytes'),
      artifact(`${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`, 'mac arm64 dmg bytes')
    ]),
    'mac/x64': latestYaml([
      artifact(`${PRODUCT_NAME}-${VERSION}-x64-mac.zip`, 'mac x64 zip bytes'),
      artifact(`${PRODUCT_NAME}-${VERSION}-x64-mac.dmg`, 'mac x64 dmg bytes')
    ]),
    'windows/x64': latestYaml([
      artifact(`${PRODUCT_NAME}-${VERSION}-x64-win.exe`, 'windows exe bytes')
    ]),
    'linux/x64': latestYaml([
      artifact(`${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`, 'linux appimage bytes')
    ]),
    ...options?.metadataOverrides
  }
  const artifacts = new Map<string, { size: number; contentType: string }>()

  for (const release of manifest.releases) {
    artifacts.set(release.url, {
      size: release.size,
      contentType: contentTypeForFixture(release.fileName)
    })
  }
  artifacts.set(`${PUBLIC_BASE_URL}/mac/arm64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`)}`, {
    size: Buffer.byteLength('mac arm64 zip bytes'),
    contentType: 'application/zip'
  })
  artifacts.set(`${PUBLIC_BASE_URL}/mac/x64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-x64-mac.zip`)}`, {
    size: Buffer.byteLength('mac x64 zip bytes'),
    contentType: 'application/zip'
  })

  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })

    if (url === `${PUBLIC_BASE_URL}/manifest.json`) {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': MUTABLE_METADATA_CACHE_CONTROL
        }
      })
    }

    for (const [directory, body] of Object.entries(metadata)) {
      const fileName = directory === 'windows/x64'
        ? 'latest.yml'
        : directory === 'linux/x64'
          ? 'latest-linux.yml'
          : 'latest-mac.yml'

      if (url === `${PUBLIC_BASE_URL}/${directory}/${fileName}`) {
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': 'application/x-yaml; charset=utf-8',
            'cache-control': MUTABLE_METADATA_CACHE_CONTROL
          }
        })
      }
    }

    const artifactInfo = artifacts.get(url)

    if (artifactInfo && method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: {
          'content-length': String(artifactInfo.size),
          'content-type': artifactInfo.contentType,
          'cache-control': IMMUTABLE_CACHE_CONTROL,
          'accept-ranges': 'bytes'
        }
      })
    }

    if (artifactInfo && init?.headers && new Headers(init.headers).get('Range') === 'bytes=0-0') {
      return new Response(new Uint8Array([0]), {
        status: 206,
        headers: {
          'content-range': `bytes 0-0/${artifactInfo.size}`
        }
      })
    }

    return new Response('not found', { status: 404 })
  }

  return Object.assign(fakeFetch, { calls })
}

function latestYaml(files: Array<{ fileName: string; content: string }>) {
  return YAML.stringify({
    version: VERSION,
    files: files.map((file) => ({
      url: `${VERSION}/${encodeURIComponent(file.fileName)}`,
      sha512: sha512(file.content),
      size: Buffer.byteLength(file.content)
    }))
  })
}

function manifestRelease(platform: 'mac' | 'windows' | 'linux', arch: 'arm64' | 'x64', fileName: string, content: string) {
  return {
    platform,
    arch,
    version: VERSION,
    fileName,
    size: Buffer.byteLength(content),
    sha512: sha512(content),
    url: `${PUBLIC_BASE_URL}/${platform}/${arch}/${VERSION}/${encodeURIComponent(fileName)}`
  }
}

function contentTypeForFixture(fileName: string) {
  if (fileName.endsWith('.dmg')) return 'application/x-apple-diskimage'
  if (fileName.endsWith('.zip')) return 'application/zip'
  if (fileName.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable'

  return 'application/octet-stream'
}

class InMemoryReleaseStorage implements ReleaseObjectStorage {
  readonly puts: ReleasePutObjectInput[] = []
  readonly operations: Array<{ index: number; type: 'put' | 'head' | 'get'; key: string }> = []
  private operationIndex = 0
  private readonly objects = new Map<string, ReleasePutObjectInput & { contentLength?: number }>()

  async put(input: ReleasePutObjectInput): Promise<void> {
    this.record('put', input.key)
    this.puts.push(input)
    this.objects.set(input.key, input)
  }

  async head({ key }: { key: string }) {
    this.record('head', key)
    const object = this.objects.get(key)

    if (!object) {
      return null
    }

    return {
      contentLength: object.contentLength ?? object.body.length,
      contentType: object.contentType,
      cacheControl: object.cacheControl,
      metadata: object.metadata ?? {}
    }
  }

  async get({ key }: { key: string }) {
    this.record('get', key)
    const object = this.objects.get(key)

    if (!object) {
      throw new Error(`Missing object: ${key}`)
    }

    return object.body
  }

  async seed(
    key: string,
    body: Uint8Array,
    options: {
      contentType: string
      cacheControl: string
      metadata: Record<string, string>
      contentLength?: number
    }
  ) {
    this.objects.set(key, {
      key,
      body,
      contentType: options.contentType,
      cacheControl: options.cacheControl,
      metadata: options.metadata,
      contentLength: options.contentLength
    })
  }

  async delete(key: string) {
    this.objects.delete(key)
  }

  clearPutLog() {
    this.puts.length = 0
    this.operations.length = 0
    this.operationIndex = 0
  }

  private record(type: 'put' | 'head' | 'get', key: string) {
    this.operations.push({
      index: this.operationIndex,
      type,
      key
    })
    this.operationIndex += 1
  }
}
