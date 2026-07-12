import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import YAML from 'yaml'
import {
  buildPublicManifest,
  collectReleaseArtifacts,
  rewriteUpdateMetadata,
  type ReleasePlatform
} from '../../scripts/release/model'

const PRODUCT_NAME = 'Jura Wolpertinger'
const VERSION = '1.2.3'

type FixtureArtifactKind = 'download' | 'update' | 'blockmap' | 'metadata'

interface FixtureDefinition {
  platform: ReleasePlatform
  metadataFileName: string
  files: Array<{
    fileName: string
    content: string
    kind: FixtureArtifactKind
  }>
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

const fixtureDefinitions: Record<ReleasePlatform, FixtureDefinition> = {
  'mac-arm64': {
    platform: 'mac-arm64',
    metadataFileName: 'latest-mac.yml',
    files: [
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`,
        content: 'mac arm64 dmg bytes',
        kind: 'download'
      },
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`,
        content: 'mac arm64 zip bytes',
        kind: 'update'
      },
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-arm64-mac.zip.blockmap`,
        content: 'mac arm64 zip blockmap bytes',
        kind: 'blockmap'
      },
      {
        fileName: 'latest-mac.yml',
        content: buildMetadataYaml({
          version: VERSION,
          path: `${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`,
          files: [
            `${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`,
            `${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`
          ]
        }),
        kind: 'metadata'
      }
    ]
  },
  'mac-x64': {
    platform: 'mac-x64',
    metadataFileName: 'latest-mac.yml',
    files: [
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-x64-mac.dmg`,
        content: 'mac x64 dmg bytes',
        kind: 'download'
      },
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-x64-mac.zip`,
        content: 'mac x64 zip bytes',
        kind: 'update'
      },
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-x64-mac.zip.blockmap`,
        content: 'mac x64 zip blockmap bytes',
        kind: 'blockmap'
      },
      {
        fileName: 'latest-mac.yml',
        content: buildMetadataYaml({
          version: VERSION,
          path: `${PRODUCT_NAME}-${VERSION}-x64-mac.zip`,
          files: [
            `${PRODUCT_NAME}-${VERSION}-x64-mac.zip`,
            `${PRODUCT_NAME}-${VERSION}-x64-mac.dmg`
          ]
        }),
        kind: 'metadata'
      }
    ]
  },
  'windows-x64': {
    platform: 'windows-x64',
    metadataFileName: 'latest.yml',
    files: [
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-x64-win.exe`,
        content: 'windows x64 exe bytes',
        kind: 'download'
      },
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-x64-win.exe.blockmap`,
        content: 'windows x64 exe blockmap bytes',
        kind: 'blockmap'
      },
      {
        fileName: 'latest.yml',
        content: buildMetadataYaml({
          version: VERSION,
          path: `${PRODUCT_NAME}-${VERSION}-x64-win.exe`,
          files: [`${PRODUCT_NAME}-${VERSION}-x64-win.exe`]
        }),
        kind: 'metadata'
      }
    ]
  },
  'linux-x64': {
    platform: 'linux-x64',
    metadataFileName: 'latest-linux.yml',
    files: [
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`,
        content: 'linux x64 appimage bytes',
        kind: 'download'
      },
      {
        fileName: `${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage.blockmap`,
        content: 'linux x64 appimage blockmap bytes',
        kind: 'blockmap'
      },
      {
        fileName: 'latest-linux.yml',
        content: buildMetadataYaml({
          version: VERSION,
          path: `${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`,
          files: [`${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`]
        }),
        kind: 'metadata'
      }
    ]
  }
}

describe('collectReleaseArtifacts', () => {
  it.each([
    ['mac-arm64'],
    ['mac-x64'],
    ['windows-x64'],
    ['linux-x64']
  ] as const)('detects required files for %s', async (platform) => {
    const fixture = await createFixture(platform)

    const artifacts = await collectReleaseArtifacts({
      directory: fixture.directory,
      platform
    })

    expect(
      artifacts.map(({ kind, fileName }) => ({ kind, fileName }))
    ).toEqual(
      fixture.definition.files
        .map(({ kind, fileName }) => ({ kind, fileName }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName))
    )
  })

  it.each([
    ['mac-arm64', `${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`, 'ZIP'],
    ['mac-arm64', `${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`, 'DMG'],
    ['windows-x64', `${PRODUCT_NAME}-${VERSION}-x64-win.exe`, 'EXE'],
    ['linux-x64', `${PRODUCT_NAME}-${VERSION}-x64-linux.AppImage`, 'AppImage'],
    ['windows-x64', `${PRODUCT_NAME}-${VERSION}-x64-win.exe.blockmap`, 'blockmap'],
    ['linux-x64', 'latest-linux.yml', 'update metadata']
  ] as const)('fails with a platform-specific error when %s is missing %s', async (platform, missingFileName, expectedLabel) => {
    const fixture = await createFixture(platform)
    await unlink(join(fixture.directory, missingFileName))

    await expect(
      collectReleaseArtifacts({
        directory: fixture.directory,
        platform
      })
    ).rejects.toThrow(new RegExp(`${platform}.*${expectedLabel}`, 'i'))
  })

  it('calculates SHA-512 and byte size from file bytes', async () => {
    const fixture = await createFixture('windows-x64')

    const artifacts = await collectReleaseArtifacts({
      directory: fixture.directory,
      platform: 'windows-x64'
    })

    const executable = artifacts.find(({ fileName }) => fileName.endsWith('.exe'))
    const bytes = Buffer.from('windows x64 exe bytes')

    expect(executable).toMatchObject({
      size: bytes.byteLength,
      sha512: createHash('sha512').update(bytes).digest('base64')
    })
  })
})

describe('rewriteUpdateMetadata', () => {
  it('rewrites artifact URLs to versioned encoded paths', async () => {
    const fixture = await createFixture('mac-arm64')

    const rewritten = await rewriteUpdateMetadata({
      metadataPath: join(fixture.directory, fixture.definition.metadataFileName)
    })
    const parsed = YAML.parse(rewritten) as {
      files: Array<{ url: string }>
      path: string
    }

    expect(parsed.path).toBe(`${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`)}`)
    expect(parsed.files.map(({ url }) => url)).toEqual([
      `${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-arm64-mac.zip`)}`,
      `${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`)}`
    ])
  })
})

describe('buildPublicManifest', () => {
  it('is deterministic and excludes local filesystem paths', async () => {
    const macFixture = await createFixture('mac-arm64')
    const windowsFixture = await createFixture('windows-x64')
    const macArtifacts = await collectReleaseArtifacts({
      directory: macFixture.directory,
      platform: 'mac-arm64'
    })
    const windowsArtifacts = await collectReleaseArtifacts({
      directory: windowsFixture.directory,
      platform: 'windows-x64'
    })

    const manifest = buildPublicManifest({
      artifacts: [...windowsArtifacts, ...macArtifacts],
      baseUrl: 'https://downloads.jura-wolpi.de/desktop/stable/',
      publishedAt: '2026-07-12T10:00:00.000Z'
    })

    expect(manifest).toEqual({
      version: VERSION,
      publishedAt: '2026-07-12T10:00:00.000Z',
      releases: [
        {
          platform: 'mac',
          arch: 'arm64',
          version: VERSION,
          fileName: `${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`,
          size: Buffer.byteLength('mac arm64 dmg bytes'),
          sha512: createHash('sha512')
            .update(Buffer.from('mac arm64 dmg bytes'))
            .digest('base64'),
          url: `https://downloads.jura-wolpi.de/desktop/stable/mac/arm64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-arm64-mac.dmg`)}`
        },
        {
          platform: 'windows',
          arch: 'x64',
          version: VERSION,
          fileName: `${PRODUCT_NAME}-${VERSION}-x64-win.exe`,
          size: Buffer.byteLength('windows x64 exe bytes'),
          sha512: createHash('sha512')
            .update(Buffer.from('windows x64 exe bytes'))
            .digest('base64'),
          url: `https://downloads.jura-wolpi.de/desktop/stable/windows/x64/${VERSION}/${encodeURIComponent(`${PRODUCT_NAME}-${VERSION}-x64-win.exe`)}`
        }
      ]
    })
    expect(JSON.stringify(manifest)).not.toContain(macFixture.directory)
    expect(JSON.stringify(manifest)).not.toContain(windowsFixture.directory)
  })

  it('rejects duplicate platform entries', async () => {
    const firstFixture = await createFixture('linux-x64')
    const secondFixture = await createFixture('linux-x64')

    const [firstArtifacts, secondArtifacts] = await Promise.all([
      collectReleaseArtifacts({
        directory: firstFixture.directory,
        platform: 'linux-x64'
      }),
      collectReleaseArtifacts({
        directory: secondFixture.directory,
        platform: 'linux-x64'
      })
    ])

    expect(() =>
      buildPublicManifest({
        artifacts: [...firstArtifacts, ...secondArtifacts],
        baseUrl: 'https://downloads.jura-wolpi.de/desktop/stable',
        publishedAt: '2026-07-12T10:00:00.000Z'
      })
    ).toThrow(/duplicate.*linux-x64/i)
  })
})

async function createFixture(platform: ReleasePlatform) {
  const definition = fixtureDefinitions[platform]
  const directory = await mkdtemp(join(tmpdir(), 'release-model-'))
  temporaryDirectories.push(directory)
  await mkdir(directory, { recursive: true })
  await Promise.all(
    definition.files.map(({ fileName, content }) => writeFile(join(directory, fileName), content))
  )

  return {
    definition,
    directory
  }
}

function buildMetadataYaml(input: { version: string; path: string; files: string[] }) {
  return YAML.stringify({
    version: input.version,
    path: input.path,
    files: input.files.map((url) => ({
      url
    })),
    releaseDate: '2026-07-12T10:00:00.000Z'
  })
}
