import { pathToFileURL } from 'node:url'
import YAML from 'yaml'
import { assertRelativeObjectPath } from './release/files'
import {
  IMMUTABLE_CACHE_CONTROL,
  MUTABLE_METADATA_CACHE_CONTROL,
  RELEASE_PLATFORM_CONFIGS,
  RELEASE_PLATFORM_ORDER
} from './release/storage'
import { type ReleaseManifest, type ReleaseManifestEntry } from './release/model'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface VerifyReleaseFeedOptions {
  fetch?: FetchLike
}

async function main() {
  const args = readArgs(process.argv.slice(2))
  const baseUrl = readRequiredValue(args.baseUrl, '--base-url').replace(/\/+$/, '')

  assertHttpsUrl(baseUrl, '--base-url')
  await verifyReleaseFeed(baseUrl)
  console.log(`Verified release feed at ${baseUrl}.`)
}

export async function verifyReleaseFeed(baseUrl: string, options?: VerifyReleaseFeedOptions) {
  const fetchImpl = options?.fetch ?? fetch
  const manifestUrl = `${baseUrl}/manifest.json`
  const manifestResponse = await fetchImpl(manifestUrl)

  assertOk(manifestResponse, manifestUrl)
  assertHeaderIncludes(manifestResponse, 'content-type', 'json', manifestUrl)
  assertCacheControl(manifestResponse, MUTABLE_METADATA_CACHE_CONTROL, manifestUrl)

  const manifestValue: unknown = await manifestResponse.json()
  validateReleaseManifest(manifestValue, baseUrl)
  const manifest = manifestValue
  const artifactChecks = new Map<string, { size: number; label: string }>()

  for (const platform of RELEASE_PLATFORM_ORDER) {
    const config = RELEASE_PLATFORM_CONFIGS[platform]
    const metadataUrl = `${baseUrl}/${config.directory}/${config.metadataFileName}`
    const metadataResponse = await fetchImpl(metadataUrl)

    assertOk(metadataResponse, metadataUrl)
    assertHeaderIncludes(metadataResponse, 'content-type', 'yaml', metadataUrl)
    assertCacheControl(metadataResponse, MUTABLE_METADATA_CACHE_CONTROL, metadataUrl)

    const metadata = parseLatestMetadata({
      body: await metadataResponse.text(),
      url: metadataUrl,
      version: manifest.version,
      baseUrl,
      directory: config.directory
    })

    for (const entry of metadata.files) {
      artifactChecks.set(entry.url, {
        size: entry.size,
        label: metadataUrl
      })
    }
  }

  for (const release of manifest.releases) {
    artifactChecks.set(release.url, {
      size: release.size,
      label: release.fileName
    })
  }

  for (const [url, check] of artifactChecks) {
    await verifyArtifactHead({
      fetch: fetchImpl,
      url,
      size: check.size,
      label: check.label
    })
  }
}

async function verifyArtifactHead(input: {
  fetch: FetchLike
  url: string
  size: number
  label: string
}) {
  assertHttpsUrl(input.url, input.label)

  const response = await input.fetch(input.url, { method: 'HEAD' })

  assertOk(response, input.url)
  assertCacheControl(response, IMMUTABLE_CACHE_CONTROL, input.url)

  const contentLength = response.headers.get('content-length')

  if (contentLength !== String(input.size)) {
    throw new Error(`${input.url} content-length ${contentLength ?? '<missing>'} does not match ${input.size}.`)
  }

  const contentType = response.headers.get('content-type')
  const expectedContentType = expectedArtifactContentType(input.url)

  if (!contentType || contentType.split(';', 1)[0].trim().toLowerCase() !== expectedContentType) {
    throw new Error(
      `${input.url} has unexpected content-type ${contentType ?? '<missing>'}; expected ${expectedContentType}.`
    )
  }

  const acceptRanges = response.headers.get('accept-ranges')

  if (acceptRanges && acceptRanges !== 'bytes') {
    throw new Error(`${input.url} advertises unsupported range handling: ${acceptRanges}.`)
  }

  if (acceptRanges === 'bytes' && input.size > 0) {
    const rangeResponse = await input.fetch(input.url, {
      headers: {
        Range: 'bytes=0-0'
      }
    })

    if (rangeResponse.status !== 206) {
      throw new Error(`${input.url} advertises byte ranges but did not return 206 for a range request.`)
    }
  }
}

function expectedArtifactContentType(urlValue: string) {
  const pathname = new URL(urlValue).pathname.toLowerCase()

  if (pathname.endsWith('.dmg')) return 'application/x-apple-diskimage'
  if (pathname.endsWith('.zip')) return 'application/zip'
  if (pathname.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable'

  return 'application/octet-stream'
}

const SUPPORTED_MANIFEST_TARGETS = [
  { platform: 'mac', arch: 'arm64', directory: RELEASE_PLATFORM_CONFIGS['mac-arm64'].directory },
  { platform: 'mac', arch: 'x64', directory: RELEASE_PLATFORM_CONFIGS['mac-x64'].directory },
  { platform: 'windows', arch: 'x64', directory: RELEASE_PLATFORM_CONFIGS['windows-x64'].directory },
  { platform: 'linux', arch: 'x64', directory: RELEASE_PLATFORM_CONFIGS['linux-x64'].directory }
] as const

export function validateReleaseManifest(
  value: unknown,
  baseUrl: string
): asserts value is ReleaseManifest {
  if (!isRecord(value) || typeof value.version !== 'string' || !Array.isArray(value.releases)) {
    throw new Error('manifest.json is not a valid release manifest.')
  }

  if (!STRICT_SEMVER_PATTERN.test(value.version)) {
    throw new Error('manifest version must be strict semver.')
  }

  if (value.releases.length !== SUPPORTED_MANIFEST_TARGETS.length) {
    throw new Error('manifest.json must contain exactly four supported release entries.')
  }

  const seenTargets = new Set<string>()

  for (const release of value.releases) {
    if (
      !isRecord(release) ||
      typeof release.platform !== 'string' ||
      typeof release.arch !== 'string' ||
      typeof release.version !== 'string' ||
      typeof release.url !== 'string' ||
      typeof release.fileName !== 'string' ||
      typeof release.size !== 'number' ||
      typeof release.sha512 !== 'string'
    ) {
      throw new Error('manifest.json contains an invalid release entry.')
    }

    const target = SUPPORTED_MANIFEST_TARGETS.find(
      (candidate) => candidate.platform === release.platform && candidate.arch === release.arch
    )

    if (!target) {
      throw new Error(`manifest.json contains unsupported target ${release.platform}-${release.arch}.`)
    }

    const targetKey = `${target.platform}-${target.arch}`

    if (seenTargets.has(targetKey)) {
      throw new Error(`manifest.json contains duplicate target ${targetKey}.`)
    }

    seenTargets.add(targetKey)

    if (release.version !== value.version) {
      throw new Error(
        `manifest.json entry version ${release.version} does not match manifest version ${value.version}.`
      )
    }

    assertSafeFileName(release.fileName)

    assertHttpsUrl(release.url, release.fileName)

    const expectedUrl = `${baseUrl.replace(/\/+$/, '')}/${target.directory}/${value.version}/${encodeURIComponent(release.fileName)}`

    if (new URL(release.url).href !== new URL(expectedUrl).href) {
      throw new Error(`${release.fileName} URL is outside its approved feed path.`)
    }
  }

  for (const target of SUPPORTED_MANIFEST_TARGETS) {
    const targetKey = `${target.platform}-${target.arch}`

    if (!seenTargets.has(targetKey)) {
      throw new Error(`manifest.json is missing supported target ${targetKey}.`)
    }
  }
}

const STRICT_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[0-9A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

function assertSafeFileName(fileName: string) {
  if (
    fileName.length === 0 ||
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(fileName)
  ) {
    throw new Error('manifest release file name must be a safe path segment.')
  }
}

function parseLatestMetadata(input: {
  body: string
  url: string
  version: string
  baseUrl: string
  directory: string
}) {
  const document = YAML.parse(input.body)

  if (!isRecord(document)) {
    throw new Error(`${input.url} must be a YAML object.`)
  }

  if (document.version !== input.version) {
    throw new Error(`${input.url} version does not match manifest version ${input.version}.`)
  }

  if (!Array.isArray(document.files) || document.files.length === 0) {
    throw new Error(`${input.url} must contain release files.`)
  }

  return {
    files: document.files.map((entry, index) => {
      if (
        !isRecord(entry) ||
        typeof entry.url !== 'string' ||
        typeof entry.sha512 !== 'string' ||
        typeof entry.size !== 'number'
      ) {
        throw new Error(`${input.url} file entry ${index + 1} must include url, sha512, and size.`)
      }

      const relativePath = assertRelativeObjectPath(entry.url)

      if (!relativePath.startsWith(`${input.version}/`)) {
        throw new Error(`${input.url} contains unsafe artifact URL ${entry.url}.`)
      }

      const artifactUrl = new URL(`${input.baseUrl}/${input.directory}/${relativePath}`)
      const approvedVersionUrl = new URL(
        `${input.baseUrl}/${input.directory}/${input.version}/`
      )

      if (
        artifactUrl.origin !== approvedVersionUrl.origin ||
        !artifactUrl.pathname.startsWith(approvedVersionUrl.pathname)
      ) {
        throw new Error(`${input.url} contains an artifact URL outside its approved version path.`)
      }

      return {
        url: artifactUrl.href,
        sha512: entry.sha512,
        size: entry.size
      }
    })
  }
}

function assertOk(response: Response, url: string) {
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`)
  }
}

function assertHttpsUrl(value: string, label: string) {
  const url = new URL(value)

  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS.`)
  }
}

function assertHeaderIncludes(response: Response, header: string, expected: string, url: string) {
  const actual = response.headers.get(header)

  if (!actual?.toLowerCase().includes(expected)) {
    throw new Error(`${url} has unexpected ${header}: ${actual ?? '<missing>'}.`)
  }
}

function assertCacheControl(response: Response, expected: string, url: string) {
  const actual = response.headers.get('cache-control')

  if (actual !== expected) {
    throw new Error(`${url} has unexpected cache-control: ${actual ?? '<missing>'}.`)
  }
}

function readArgs(argv: string[]) {
  const args: Record<string, string> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--base-url') {
      args.baseUrl = argv[index + 1]
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return args
}

function readRequiredValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
