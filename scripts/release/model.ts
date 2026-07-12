import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import YAML from 'yaml'
import {
  assertRelativeObjectPath,
  buildVersionedArtifactPath,
  extractArtifactFileName,
  isRemoteUrl,
  joinUrlPath,
  listDirectoryFiles,
  readFileInfo
} from './files'

export type ReleasePlatform = 'mac-arm64' | 'mac-x64' | 'windows-x64' | 'linux-x64'
export type ReleaseArtifactKind = 'download' | 'update' | 'blockmap' | 'metadata'

type PublicPlatform = 'mac' | 'windows' | 'linux'
type ReleaseArch = 'arm64' | 'x64'

interface PlatformRule {
  kind: ReleaseArtifactKind
  label: string
  match: (fileName: string) => boolean
}

interface PlatformConfig {
  arch: ReleaseArch
  platform: PublicPlatform
  directory: string
  metadataFileName: string
  requiredFiles: PlatformRule[]
}

export interface ReleaseArtifact {
  platform: ReleasePlatform
  version: string
  kind: ReleaseArtifactKind
  fileName: string
  filePath: string
  remotePath: string
  size: number
  sha512: string
}

export interface CollectReleaseArtifactsInput {
  directory: string
  platform: ReleasePlatform
}

export interface RewriteUpdateMetadataInput {
  metadataPath: string
}

export interface ReleaseManifestEntry {
  platform: PublicPlatform
  arch: ReleaseArch
  version: string
  fileName: string
  size: number
  sha512: string
  url: string
}

export interface ReleaseManifest {
  version: string
  publishedAt: string
  releases: ReleaseManifestEntry[]
}

export interface BuildPublicManifestInput {
  artifacts: ReleaseArtifact[]
  baseUrl: string
  publishedAt: string
}

const PLATFORM_ORDER: ReleasePlatform[] = ['mac-arm64', 'mac-x64', 'windows-x64', 'linux-x64']

const PLATFORM_CONFIGS: Record<ReleasePlatform, PlatformConfig> = {
  'mac-arm64': {
    platform: 'mac',
    arch: 'arm64',
    directory: 'mac/arm64',
    metadataFileName: 'latest-mac.yml',
    requiredFiles: [
      { kind: 'download', label: 'DMG', match: (fileName) => fileName.endsWith('-arm64-mac.dmg') },
      { kind: 'update', label: 'ZIP', match: (fileName) => fileName.endsWith('-arm64-mac.zip') },
      { kind: 'blockmap', label: 'blockmap', match: (fileName) => fileName.endsWith('-arm64-mac.zip.blockmap') },
      { kind: 'metadata', label: 'update metadata', match: (fileName) => fileName === 'latest-mac.yml' }
    ]
  },
  'mac-x64': {
    platform: 'mac',
    arch: 'x64',
    directory: 'mac/x64',
    metadataFileName: 'latest-mac.yml',
    requiredFiles: [
      { kind: 'download', label: 'DMG', match: (fileName) => fileName.endsWith('-x64-mac.dmg') },
      { kind: 'update', label: 'ZIP', match: (fileName) => fileName.endsWith('-x64-mac.zip') },
      { kind: 'blockmap', label: 'blockmap', match: (fileName) => fileName.endsWith('-x64-mac.zip.blockmap') },
      { kind: 'metadata', label: 'update metadata', match: (fileName) => fileName === 'latest-mac.yml' }
    ]
  },
  'windows-x64': {
    platform: 'windows',
    arch: 'x64',
    directory: 'windows/x64',
    metadataFileName: 'latest.yml',
    requiredFiles: [
      { kind: 'download', label: 'EXE', match: (fileName) => fileName.endsWith('-x64-win.exe') },
      { kind: 'blockmap', label: 'blockmap', match: (fileName) => fileName.endsWith('-x64-win.exe.blockmap') },
      { kind: 'metadata', label: 'update metadata', match: (fileName) => fileName === 'latest.yml' }
    ]
  },
  'linux-x64': {
    platform: 'linux',
    arch: 'x64',
    directory: 'linux/x64',
    metadataFileName: 'latest-linux.yml',
    requiredFiles: [
      { kind: 'download', label: 'AppImage', match: (fileName) => fileName.endsWith('-x64-linux.AppImage') },
      { kind: 'blockmap', label: 'blockmap', match: (fileName) => fileName.endsWith('-x64-linux.AppImage.blockmap') },
      { kind: 'metadata', label: 'update metadata', match: (fileName) => fileName === 'latest-linux.yml' }
    ]
  }
}

export async function collectReleaseArtifacts(input: CollectReleaseArtifactsInput): Promise<ReleaseArtifact[]> {
  const config = PLATFORM_CONFIGS[input.platform]
  const fileNames = await listDirectoryFiles(input.directory)
  const metadataFileName = findRequiredFileName({
    label: 'update metadata',
    matcher: (fileName) => fileName === config.metadataFileName,
    fileNames,
    platform: input.platform
  })
  const metadataDocument = await readUpdateMetadata(join(input.directory, metadataFileName))
  const version = readMetadataVersion(metadataDocument, input.platform)

  const resolvedArtifacts = await Promise.all(
    config.requiredFiles.map(async (rule) => {
      const fileName = rule.kind === 'metadata'
        ? metadataFileName
        : findRequiredFileName({
            label: rule.label,
            matcher: rule.match,
            fileNames,
            platform: input.platform
          })
      const filePath = join(input.directory, fileName)
      const fileInfo = await readFileInfo(filePath)

      return {
        platform: input.platform,
        version,
        kind: rule.kind,
        fileName,
        filePath,
        remotePath: rule.kind === 'metadata' ? fileName : buildVersionedArtifactPath(version, fileName),
        size: fileInfo.size,
        sha512: fileInfo.sha512
      } satisfies ReleaseArtifact
    })
  )

  return resolvedArtifacts.sort((left, right) => left.fileName.localeCompare(right.fileName))
}

export function buildPublicManifest(input: BuildPublicManifestInput): ReleaseManifest {
  const downloadArtifacts = input.artifacts
    .filter((artifact) => artifact.kind === 'download')
    .sort(compareArtifacts)

  if (downloadArtifacts.length === 0) {
    throw new Error('Cannot build a release manifest without download artifacts.')
  }

  const duplicatePlatforms = findDuplicatePlatforms(downloadArtifacts)

  if (duplicatePlatforms.length > 0) {
    throw new Error(`Found duplicate release entries for ${duplicatePlatforms.join(', ')}`)
  }

  const versions = new Set(downloadArtifacts.map((artifact) => artifact.version))

  if (versions.size !== 1) {
    throw new Error(`Expected exactly one release version, found ${versions.size}.`)
  }

  const releases = downloadArtifacts.map((artifact) => {
    const config = PLATFORM_CONFIGS[artifact.platform]

    return {
      platform: config.platform,
      arch: config.arch,
      version: artifact.version,
      fileName: artifact.fileName,
      size: artifact.size,
      sha512: artifact.sha512,
      url: joinUrlPath(input.baseUrl, config.directory, assertRelativeObjectPath(artifact.remotePath))
    } satisfies ReleaseManifestEntry
  })

  return {
    version: downloadArtifacts[0].version,
    publishedAt: input.publishedAt,
    releases
  }
}

export async function rewriteUpdateMetadata(input: RewriteUpdateMetadataInput): Promise<string> {
  const document = await readUpdateMetadata(input.metadataPath)
  const version = readMetadataVersion(document)

  return YAML.stringify(rewriteMetadataNode(document, version))
}

async function readUpdateMetadata(metadataPath: string) {
  const contents = await readFile(metadataPath, 'utf8')
  const document = YAML.parse(contents)

  if (!isRecord(document)) {
    throw new Error(`Release metadata at ${metadataPath} must be a YAML object.`)
  }

  return document
}

function readMetadataVersion(document: Record<string, unknown>, platform?: ReleasePlatform) {
  const version = document.version

  if (typeof version !== 'string' || version.trim().length === 0) {
    const prefix = platform ? `${platform} ` : ''

    throw new Error(`${prefix}update metadata is missing a version.`.trim())
  }

  return version
}

function rewriteMetadataNode(value: unknown, version: string): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => rewriteMetadataNode(entry, version))
  }

  if (!isRecord(value)) {
    return value
  }

  const rewritten: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value)) {
    if ((key === 'path' || key === 'url') && typeof entry === 'string' && !isRemoteUrl(entry)) {
      rewritten[key] = buildVersionedArtifactPath(version, extractArtifactFileName(entry))
      continue
    }

    rewritten[key] = rewriteMetadataNode(entry, version)
  }

  return rewritten
}

function findRequiredFileName(input: {
  label: string
  matcher: (fileName: string) => boolean
  fileNames: string[]
  platform: ReleasePlatform
}) {
  const matches = input.fileNames.filter(input.matcher)

  if (matches.length === 1) {
    return matches[0]
  }

  if (matches.length === 0) {
    throw new Error(`${input.platform} is missing ${input.label}.`)
  }

  throw new Error(`${input.platform} has multiple ${input.label} files.`)
}

function findDuplicatePlatforms(artifacts: ReleaseArtifact[]) {
  const counts = new Map<ReleasePlatform, number>()

  for (const artifact of artifacts) {
    counts.set(artifact.platform, (counts.get(artifact.platform) ?? 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([platform]) => platform)
    .sort(comparePlatforms)
}

function compareArtifacts(left: ReleaseArtifact, right: ReleaseArtifact) {
  return comparePlatforms(left.platform, right.platform) || left.fileName.localeCompare(right.fileName)
}

function comparePlatforms(left: ReleasePlatform, right: ReleasePlatform) {
  return PLATFORM_ORDER.indexOf(left) - PLATFORM_ORDER.indexOf(right)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
