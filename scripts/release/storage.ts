import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException
} from '@aws-sdk/client-s3'
import YAML from 'yaml'
import { type ReleaseStorageConfig } from './config'
import { assertRelativeObjectPath, extractArtifactFileName } from './files'
import {
  buildPublicManifest,
  collectReleaseArtifacts,
  rewriteUpdateMetadata,
  type ReleaseArtifact,
  type ReleasePlatform
} from './model'

export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const MUTABLE_METADATA_CACHE_CONTROL = 'no-cache'

const RELEASE_PREFIX = 'desktop/stable'

export const RELEASE_PLATFORM_CONFIGS = {
  'mac-arm64': {
    directory: 'mac/arm64',
    metadataFileName: 'latest-mac.yml',
    downloadMatch: (fileName: string) => fileName.endsWith('-arm64-mac.dmg'),
    blockmapMatch: (fileName: string) => fileName.endsWith('-arm64-mac.zip')
  },
  'mac-x64': {
    directory: 'mac/x64',
    metadataFileName: 'latest-mac.yml',
    downloadMatch: (fileName: string) => fileName.endsWith('-x64-mac.dmg'),
    blockmapMatch: (fileName: string) => fileName.endsWith('-x64-mac.zip')
  },
  'windows-x64': {
    directory: 'windows/x64',
    metadataFileName: 'latest.yml',
    downloadMatch: (fileName: string) => fileName.endsWith('-x64-win.exe'),
    blockmapMatch: (fileName: string) => fileName.endsWith('-x64-win.exe')
  },
  'linux-x64': {
    directory: 'linux/x64',
    metadataFileName: 'latest-linux.yml',
    downloadMatch: (fileName: string) =>
      fileName.endsWith('-x64-linux.AppImage') || fileName.endsWith('-x86_64-linux.AppImage'),
    blockmapMatch: (fileName: string) =>
      fileName.endsWith('-x64-linux.AppImage') || fileName.endsWith('-x86_64-linux.AppImage')
  }
} satisfies Record<ReleasePlatform, {
  directory: string
  metadataFileName: string
  downloadMatch: (fileName: string) => boolean
  blockmapMatch: (fileName: string) => boolean
}>

export const RELEASE_PLATFORM_ORDER = [
  'mac-arm64',
  'mac-x64',
  'windows-x64',
  'linux-x64'
] as const satisfies ReleasePlatform[]

export interface ReleasePutObjectInput {
  key: string
  body: Uint8Array
  contentType: string
  cacheControl: string
  metadata?: Record<string, string>
  ifNoneMatch?: '*'
}

export class ReleaseObjectAlreadyExistsError extends Error {
  constructor(readonly key: string) {
    super(`Release object already exists: ${key}`)
    this.name = 'ReleaseObjectAlreadyExistsError'
  }
}

export interface ReleaseObjectHead {
  contentLength: number
  contentType?: string
  cacheControl?: string
  metadata: Record<string, string>
}

export interface ReleaseObjectStorage {
  put(input: ReleasePutObjectInput): Promise<void>
  head(input: { key: string }): Promise<ReleaseObjectHead | null>
  get(input: { key: string }): Promise<Uint8Array>
}

export interface StageReleaseInput {
  storage: ReleaseObjectStorage
  platform: ReleasePlatform
  inputDirectory: string
  dryRun?: boolean
}

export interface StageResult {
  platform: ReleasePlatform
  version: string
  plannedKeys: string[]
  uploadedKeys: string[]
}

export interface PublishReleaseInput {
  storage: ReleaseObjectStorage
  version: string
  confirm: string
  publicBaseUrl: string
  publishedAt?: string
}

export interface PublishResult {
  version: string
  publishedMetadataKeys: string[]
  manifestKey: string
}

interface MetadataFileEntry {
  url: string
  sha512: string
  size: number
}

interface VerifiedPlatform {
  platform: ReleasePlatform
  metadataBody: Uint8Array
  downloadArtifact: ReleaseArtifact
}

export function createS3ReleaseStorage(config: ReleaseStorageConfig): ReleaseObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: true
  })

  return {
    async put(input) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: input.key,
            Body: input.body,
            ContentType: input.contentType,
            CacheControl: input.cacheControl,
            Metadata: input.metadata,
            IfNoneMatch: input.ifNoneMatch
          })
        )
      } catch (error) {
        if (
          input.ifNoneMatch === '*' &&
          error instanceof S3ServiceException &&
          (error.$metadata.httpStatusCode === 409 || error.$metadata.httpStatusCode === 412)
        ) {
          throw new ReleaseObjectAlreadyExistsError(input.key)
        }

        throw error
      }
    },
    async head(input) {
      try {
        const response = await client.send(
          new HeadObjectCommand({
            Bucket: config.bucket,
            Key: input.key
          })
        )

        return {
          contentLength: response.ContentLength ?? 0,
          contentType: response.ContentType,
          cacheControl: response.CacheControl,
          metadata: response.Metadata ?? {}
        }
      } catch (error) {
        if (
          error instanceof S3ServiceException &&
          (error.$metadata.httpStatusCode === 404 || error.$metadata.httpStatusCode === 400)
        ) {
          return null
        }

        throw error
      }
    },
    async get(input) {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: input.key
        })
      )

      if (!response.Body || !('transformToByteArray' in response.Body)) {
        throw new Error(`Release object ${input.key} did not return a readable body.`)
      }

      return response.Body.transformToByteArray()
    }
  }
}

export function immutableObjectKey(platform: ReleasePlatform, version: string, filename: string) {
  assertSafeVersion(version)
  assertRelativeObjectPath(filename)

  return `${platformPrefix(platform)}/${version}/${encodeURIComponent(filename)}`
}

export function mutableMetadataKey(platform: ReleasePlatform, filename: string) {
  return `${platformPrefix(platform)}/${assertRelativeObjectPath(filename)}`
}

export async function stageRelease(input: StageReleaseInput): Promise<StageResult> {
  const artifacts = await collectReleaseArtifacts({
    directory: input.inputDirectory,
    platform: input.platform
  })
  const version = readSingleVersion(artifacts)
  const plannedObjects = await Promise.all(artifacts.map(buildStageObject))
  const plannedKeys = plannedObjects.map(({ key }) => key).sort()
  const uploadedKeys: string[] = []
  const preflightResults = await Promise.allSettled(
    plannedObjects.map(async (object) => {
      const head = await input.storage.head({ key: object.key })

      if (!head) {
        return object
      }

      await assertImmutableObjectMatches({
        storage: input.storage,
        platform: input.platform,
        planned: object,
        head
      })
      return null
    })
  )
  const failedPreflight = preflightResults.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )

  if (failedPreflight) {
    throw failedPreflight.reason
  }

  const missingObjects = preflightResults.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : []
  )

  if (!input.dryRun) {
    for (const object of missingObjects) {
      try {
        await input.storage.put({ ...object, ifNoneMatch: '*' })
        uploadedKeys.push(object.key)
      } catch (error) {
        if (!(error instanceof ReleaseObjectAlreadyExistsError)) throw error

        const head = await input.storage.head({ key: object.key })

        if (!head) {
          throw new Error(`Immutable upload conflict for ${input.platform} release object ${object.key}.`)
        }

        await assertImmutableObjectMatches({
          storage: input.storage,
          platform: input.platform,
          planned: object,
          head
        })
      }
    }
  }

  return {
    platform: input.platform,
    version,
    plannedKeys,
    uploadedKeys
  }
}

async function assertImmutableObjectMatches(input: {
  storage: ReleaseObjectStorage
  platform: ReleasePlatform
  planned: ReleasePutObjectInput
  head: ReleaseObjectHead
}) {
  const expectedMetadata = input.planned.metadata ?? {}

  if (input.head.contentLength !== input.planned.body.length) {
    throw immutableMismatch(input.platform, input.planned.key, 'content length')
  }

  if (!headerValuesMatch(input.head.contentType, input.planned.contentType, ';')) {
    throw immutableMismatch(input.platform, input.planned.key, 'content type')
  }

  if (!headerValuesMatch(input.head.cacheControl, input.planned.cacheControl, ',')) {
    throw immutableMismatch(input.platform, input.planned.key, 'cache control')
  }

  if (
    input.head.metadata.sha512 !== expectedMetadata.sha512 ||
    input.head.metadata.size !== expectedMetadata.size
  ) {
    throw immutableMismatch(input.platform, input.planned.key, 'checksum or size metadata')
  }

  const remoteBody = await input.storage.get({ key: input.planned.key })

  if (!Buffer.from(remoteBody).equals(Buffer.from(input.planned.body))) {
    throw immutableMismatch(input.platform, input.planned.key, 'bytes')
  }
}

function headerValuesMatch(actual: string | undefined, expected: string, separator: ';' | ',') {
  if (!actual) {
    return false
  }

  const normalize = (value: string) => value
    .split(separator)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .sort()

  return normalize(actual).join(separator) === normalize(expected).join(separator)
}

function immutableMismatch(platform: ReleasePlatform, key: string, field: string) {
  return new Error(`Immutable ${field} mismatch for ${platform} release object ${key}.`)
}

export async function publishRelease(input: PublishReleaseInput): Promise<PublishResult> {
  if (input.confirm !== `publish ${input.version}`) {
    throw new Error(`Refusing to publish. Confirmation must exactly equal "publish ${input.version}".`)
  }

  assertHttpsUrl(input.publicBaseUrl)

  const verifiedPlatforms: VerifiedPlatform[] = []
  const publishedMetadataKeys: string[] = []

  for (const platform of RELEASE_PLATFORM_ORDER) {
    const verified = await verifyRemotePlatform({
      storage: input.storage,
      platform,
      version: input.version
    })
    const metadataKey = mutableMetadataKey(
      verified.platform,
      RELEASE_PLATFORM_CONFIGS[verified.platform].metadataFileName
    )

    await input.storage.put({
      key: metadataKey,
      body: verified.metadataBody,
      contentType: contentTypeForFileName(metadataKey),
      cacheControl: MUTABLE_METADATA_CACHE_CONTROL,
      metadata: objectMetadata(verified.metadataBody)
    })
    publishedMetadataKeys.push(metadataKey)
    verifiedPlatforms.push(verified)
  }

  const manifest = buildPublicManifest({
    artifacts: verifiedPlatforms.map(({ downloadArtifact }) => downloadArtifact),
    baseUrl: input.publicBaseUrl,
    publishedAt: input.publishedAt ?? new Date().toISOString()
  })
  const manifestBody = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)
  const manifestKey = `${RELEASE_PREFIX}/manifest.json`

  await input.storage.put({
    key: manifestKey,
    body: manifestBody,
    contentType: 'application/json; charset=utf-8',
    cacheControl: MUTABLE_METADATA_CACHE_CONTROL,
    metadata: objectMetadata(manifestBody)
  })

  return {
    version: input.version,
    publishedMetadataKeys,
    manifestKey
  }
}

async function buildStageObject(artifact: ReleaseArtifact): Promise<ReleasePutObjectInput> {
  const rawBody = artifact.kind === 'metadata'
    ? await rewriteUpdateMetadata({ metadataPath: artifact.filePath })
    : await readFile(artifact.filePath)
  const body = typeof rawBody === 'string' ? new TextEncoder().encode(rawBody) : rawBody

  return {
    key: immutableObjectKey(artifact.platform, artifact.version, artifact.fileName),
    body,
    contentType: contentTypeForFileName(artifact.fileName),
    cacheControl: IMMUTABLE_CACHE_CONTROL,
    metadata: objectMetadata(body)
  }
}

async function verifyRemotePlatform(input: {
  storage: ReleaseObjectStorage
  platform: ReleasePlatform
  version: string
}): Promise<VerifiedPlatform> {
  const config = RELEASE_PLATFORM_CONFIGS[input.platform]
  const metadataKey = immutableObjectKey(input.platform, input.version, config.metadataFileName)
  const metadataHead = await input.storage.head({ key: metadataKey })

  assertRemoteHead(input.platform, metadataKey, metadataHead)

  const metadataBody = await input.storage.get({ key: metadataKey })
  const metadataDocument = parseMetadataDocument(input.platform, input.version, metadataBody)
  const entries = readMetadataFileEntries(input.platform, metadataDocument)

  for (const entry of entries) {
    const objectKey = keyFromMetadataUrl(input.platform, input.version, entry.url)
    const head = await input.storage.head({ key: objectKey })

    assertRemoteHead(input.platform, objectKey, head)
    await verifyRemoteObjectBody({
      storage: input.storage,
      platform: input.platform,
      key: objectKey,
      expectedSha512: entry.sha512,
      expectedSize: entry.size,
      context: 'release artifact',
      head
    })
  }

  await verifyExpectedBlockmaps({
    storage: input.storage,
    platform: input.platform,
    version: input.version,
    entries
  })

  return {
    platform: input.platform,
    metadataBody,
    downloadArtifact: selectDownloadArtifact({
      platform: input.platform,
      version: input.version,
      entries
    })
  }
}

async function verifyExpectedBlockmaps(input: {
  storage: ReleaseObjectStorage
  platform: ReleasePlatform
  version: string
  entries: MetadataFileEntry[]
}) {
  const config = RELEASE_PLATFORM_CONFIGS[input.platform]
  const blockmapSource = input.entries.find((entry) =>
    config.blockmapMatch(extractArtifactFileName(entry.url))
  )

  if (!blockmapSource) {
    throw new Error(`${input.platform} metadata is missing an update artifact for blockmap validation.`)
  }

  const blockmapKey = `${keyFromMetadataUrl(input.platform, input.version, blockmapSource.url)}.blockmap`
  const blockmapHead = await input.storage.head({ key: blockmapKey })

  assertRemoteHead(input.platform, blockmapKey, blockmapHead)
  const expected = readExpectedObjectMetadata(input.platform, blockmapKey, blockmapHead)

  await verifyRemoteObjectBody({
    storage: input.storage,
    platform: input.platform,
    key: blockmapKey,
    expectedSha512: expected.sha512,
    expectedSize: expected.size,
    context: 'blockmap',
    head: blockmapHead
  })
}

function selectDownloadArtifact(input: {
  platform: ReleasePlatform
  version: string
  entries: MetadataFileEntry[]
}): ReleaseArtifact {
  const config = RELEASE_PLATFORM_CONFIGS[input.platform]
  const entry = input.entries.find((candidate) =>
    config.downloadMatch(extractArtifactFileName(candidate.url))
  )

  if (!entry) {
    throw new Error(`${input.platform} metadata is missing a public download artifact.`)
  }

  const fileName = extractArtifactFileName(entry.url)
  const remotePath = `${input.version}/${encodeURIComponent(fileName)}`

  return {
    platform: input.platform,
    version: input.version,
    kind: 'download',
    fileName,
    filePath: '',
    remotePath,
    size: entry.size,
    sha512: entry.sha512
  }
}

function assertRemoteHead(platform: ReleasePlatform, key: string, head: ReleaseObjectHead | null): asserts head is ReleaseObjectHead {
  if (!head) {
    throw new Error(`${platform} is missing remote release object ${key}.`)
  }

  if (head.cacheControl !== IMMUTABLE_CACHE_CONTROL) {
    throw new Error(`${platform} remote release object ${key} is missing immutable cache control.`)
  }
}

async function verifyRemoteObjectBody(input: {
  storage: ReleaseObjectStorage
  platform: ReleasePlatform
  key: string
  expectedSha512: string
  expectedSize: number
  context: string
  head: ReleaseObjectHead
}) {
  if (input.head.contentLength !== input.expectedSize) {
    throw new Error(`${input.context} byte length mismatch for ${input.platform} release object ${input.key}.`)
  }

  const body = await input.storage.get({ key: input.key })

  if (body.length !== input.expectedSize) {
    throw new Error(`${input.context} downloaded byte length mismatch for ${input.platform} release object ${input.key}.`)
  }

  if (hashBytes(body) !== input.expectedSha512) {
    throw new Error(`${input.context} checksum mismatch for ${input.platform} release object ${input.key}.`)
  }
}

function readExpectedObjectMetadata(platform: ReleasePlatform, key: string, head: ReleaseObjectHead) {
  const sha512 = head.metadata.sha512
  const size = Number(head.metadata.size)

  if (!sha512 || !Number.isSafeInteger(size) || size < 0) {
    throw new Error(`${platform} remote release object ${key} is missing staged checksum or size metadata.`)
  }

  return {
    sha512,
    size
  }
}

function parseMetadataDocument(platform: ReleasePlatform, version: string, body: Uint8Array) {
  const document = YAML.parse(new TextDecoder().decode(body))

  if (!isRecord(document)) {
    throw new Error(`${platform} update metadata must be a YAML object.`)
  }

  if (document.version !== version) {
    throw new Error(`${platform} update metadata version does not match ${version}.`)
  }

  return document
}

function assertHttpsUrl(value: string) {
  if (new URL(value).protocol !== 'https:') {
    throw new Error('Release public base URL must use HTTPS before publishing.')
  }
}

function readMetadataFileEntries(platform: ReleasePlatform, document: Record<string, unknown>): MetadataFileEntry[] {
  if (!Array.isArray(document.files) || document.files.length === 0) {
    throw new Error(`${platform} update metadata must contain file entries.`)
  }

  return document.files.map((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry.url !== 'string' ||
      typeof entry.sha512 !== 'string' ||
      typeof entry.size !== 'number'
    ) {
      throw new Error(`${platform} update metadata file entry ${index + 1} is missing url, sha512, or size.`)
    }

    return {
      url: entry.url,
      sha512: entry.sha512,
      size: entry.size
    }
  })
}

function keyFromMetadataUrl(platform: ReleasePlatform, version: string, metadataUrl: string) {
  const relativePath = assertRelativeObjectPath(metadataUrl)

  if (!relativePath.startsWith(`${version}/`)) {
    throw new Error(`${platform} metadata URL must point inside ${version}.`)
  }

  const normalizedUrl = new URL(relativePath, 'https://release.invalid/')
  const approvedVersionUrl = new URL(`${version}/`, 'https://release.invalid/')

  if (!normalizedUrl.pathname.startsWith(approvedVersionUrl.pathname)) {
    throw new Error(`${platform} metadata URL must stay inside the approved version path ${version}.`)
  }

  return `${platformPrefix(platform)}/${relativePath}`
}

function readSingleVersion(artifacts: ReleaseArtifact[]) {
  const versions = new Set(artifacts.map((artifact) => artifact.version))

  if (versions.size !== 1) {
    throw new Error(`Expected one release version, found ${versions.size}.`)
  }

  return artifacts[0].version
}

function platformPrefix(platform: ReleasePlatform) {
  return `${RELEASE_PREFIX}/${RELEASE_PLATFORM_CONFIGS[platform].directory}`
}

function objectMetadata(body: Uint8Array) {
  return {
    sha512: hashBytes(body),
    size: String(body.length)
  }
}

function hashBytes(body: Uint8Array) {
  return createHash('sha512').update(body).digest('base64')
}

function contentTypeForFileName(fileName: string) {
  if (fileName.endsWith('.json')) return 'application/json; charset=utf-8'
  if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'application/x-yaml; charset=utf-8'
  if (fileName.endsWith('.zip')) return 'application/zip'
  if (fileName.endsWith('.dmg')) return 'application/x-apple-diskimage'
  if (fileName.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable'

  return 'application/octet-stream'
}

function assertSafeVersion(version: string) {
  assertRelativeObjectPath(version)

  if (version.includes('/')) {
    throw new Error('Release version must be a single object path segment.')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
