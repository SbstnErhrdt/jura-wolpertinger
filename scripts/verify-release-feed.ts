import {
  IMMUTABLE_CACHE_CONTROL,
  MUTABLE_METADATA_CACHE_CONTROL,
  RELEASE_PLATFORM_CONFIGS,
  RELEASE_PLATFORM_ORDER
} from './release/storage'
import { type ReleaseManifest, type ReleaseManifestEntry } from './release/model'

async function main() {
  const args = readArgs(process.argv.slice(2))
  const baseUrl = readRequiredValue(args.baseUrl, '--base-url').replace(/\/+$/, '')

  assertHttpsUrl(baseUrl, '--base-url')
  await verifyReleaseFeed(baseUrl)
  console.log(`Verified release feed at ${baseUrl}.`)
}

export async function verifyReleaseFeed(baseUrl: string) {
  const manifestUrl = `${baseUrl}/manifest.json`
  const manifestResponse = await fetch(manifestUrl)

  assertOk(manifestResponse, manifestUrl)
  assertHeaderIncludes(manifestResponse, 'content-type', 'json', manifestUrl)
  assertCacheControl(manifestResponse, MUTABLE_METADATA_CACHE_CONTROL, manifestUrl)

  const manifest = await manifestResponse.json() as ReleaseManifest
  assertManifest(manifest)

  for (const platform of RELEASE_PLATFORM_ORDER) {
    const config = RELEASE_PLATFORM_CONFIGS[platform]
    const metadataUrl = `${baseUrl}/${config.directory}/${config.metadataFileName}`
    const metadataResponse = await fetch(metadataUrl)

    assertOk(metadataResponse, metadataUrl)
    assertHeaderIncludes(metadataResponse, 'content-type', 'yaml', metadataUrl)
    assertCacheControl(metadataResponse, MUTABLE_METADATA_CACHE_CONTROL, metadataUrl)
  }

  for (const release of manifest.releases) {
    await verifyManifestRelease(release)
  }
}

async function verifyManifestRelease(release: ReleaseManifestEntry) {
  assertHttpsUrl(release.url, release.fileName)

  const response = await fetch(release.url, { method: 'HEAD' })

  assertOk(response, release.url)
  assertCacheControl(response, IMMUTABLE_CACHE_CONTROL, release.url)

  const contentLength = response.headers.get('content-length')

  if (contentLength !== String(release.size)) {
    throw new Error(`${release.url} content-length ${contentLength ?? '<missing>'} does not match ${release.size}.`)
  }

  const contentType = response.headers.get('content-type')

  if (!contentType || contentType.includes('text/html')) {
    throw new Error(`${release.url} has an unsafe or missing MIME type.`)
  }

  const acceptRanges = response.headers.get('accept-ranges')

  if (acceptRanges && acceptRanges !== 'bytes') {
    throw new Error(`${release.url} advertises unsupported range handling: ${acceptRanges}.`)
  }

  if (acceptRanges === 'bytes' && release.size > 0) {
    const rangeResponse = await fetch(release.url, {
      headers: {
        Range: 'bytes=0-0'
      }
    })

    if (rangeResponse.status !== 206) {
      throw new Error(`${release.url} advertises byte ranges but did not return 206 for a range request.`)
    }
  }
}

function assertManifest(value: ReleaseManifest) {
  if (!value || typeof value.version !== 'string' || !Array.isArray(value.releases)) {
    throw new Error('manifest.json is not a valid release manifest.')
  }

  for (const release of value.releases) {
    if (
      typeof release.url !== 'string' ||
      typeof release.fileName !== 'string' ||
      typeof release.size !== 'number' ||
      typeof release.sha512 !== 'string'
    ) {
      throw new Error('manifest.json contains an invalid release entry.')
    }
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
