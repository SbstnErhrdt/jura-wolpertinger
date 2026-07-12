const DOWNLOAD_BASE_ORIGIN = 'https://downloads.jura-wolpi.de'
const DOWNLOAD_BASE_PATH = '/desktop/stable/'

export const DOWNLOAD_MANIFEST_URL = `${DOWNLOAD_BASE_ORIGIN}${DOWNLOAD_BASE_PATH}manifest.json`

const OS_TARGETS = {
  windows: { platform: 'windows', arch: 'x64' },
  linux: { platform: 'linux', arch: 'x64' },
  macos: {
    arm64: { platform: 'mac', arch: 'arm64' },
    x64: { platform: 'mac', arch: 'x64' }
  }
}

export function readManifestEntries(manifest) {
  if (!isRecord(manifest) || typeof manifest.version !== 'string' || !Array.isArray(manifest.releases)) {
    return null
  }

  const entries = []
  const seenKeys = new Set()

  for (const release of manifest.releases) {
    if (!isRecord(release)) return null
    if (!isSupportedPlatform(release.platform, release.arch)) return null
    if (typeof release.version !== 'string' || release.version.length === 0) return null
    if (typeof release.fileName !== 'string' || release.fileName.length === 0) return null
    if (!isValidSize(release.size)) return null
    if (typeof release.sha512 !== 'string' || release.sha512.length === 0) return null
    if (!isSafeHttpsUrl(release.url)) return null

    const key = `${release.platform}:${release.arch}`
    if (seenKeys.has(key)) return null
    seenKeys.add(key)

    entries.push({
      platform: release.platform,
      arch: release.arch,
      version: release.version,
      fileName: release.fileName,
      size: release.size,
      sha512: release.sha512,
      url: release.url
    })
  }

  return entries
}

export function selectDownload(manifest, os, arch) {
  const entries = readManifestEntries(manifest)
  const target = resolveTarget(os, arch)

  if (!entries || !target) return null

  return entries.find((entry) => entry.platform === target.platform && entry.arch === target.arch) ?? null
}

export async function detectMacArchitecture(navigatorLike = globalThis.navigator) {
  if (!navigatorLike) return null

  const userAgentData = navigatorLike.userAgentData

  if (typeof userAgentData?.getHighEntropyValues === 'function') {
    try {
      const highEntropyValues = await userAgentData.getHighEntropyValues(['architecture'])
      const highEntropyArchitecture = normalizeArchitecture(highEntropyValues?.architecture)

      if (highEntropyArchitecture) return highEntropyArchitecture
    } catch {
      return null
    }
  }

  const explicitArchitecture = normalizeArchitecture(userAgentData?.architecture)
  if (explicitArchitecture) return explicitArchitecture

  return readArchitectureFromUserAgent(navigatorLike.userAgent)
}

export function formatDownloadLabel(asset) {
  if (!isRecord(asset) || typeof asset.fileName !== 'string' || asset.fileName.length === 0) {
    return 'Direkter Download'
  }

  const sizeLabel = isValidSize(asset.size) ? ` · ${formatSize(asset.size)}` : ''

  return `${asset.fileName}${sizeLabel}`
}

function resolveTarget(os, arch) {
  const normalizedOs = typeof os === 'string' ? os.toLowerCase() : ''
  const normalizedArch = typeof arch === 'string' ? arch.toLowerCase() : ''

  if (normalizedOs === 'windows') return OS_TARGETS.windows
  if (normalizedOs === 'linux') return OS_TARGETS.linux
  if (normalizedOs === 'macos') return OS_TARGETS.macos[normalizedArch] ?? null

  return null
}

function formatSize(size) {
  if (size < 1024) return `${size} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = -1

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function isValidSize(value) {
  return Number.isFinite(value) && value >= 0
}

function isSafeHttpsUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false

  try {
    const url = new URL(value)

    return (
      url.protocol === 'https:' &&
      url.origin === DOWNLOAD_BASE_ORIGIN &&
      url.username === '' &&
      url.password === '' &&
      url.pathname.startsWith(DOWNLOAD_BASE_PATH)
    )
  } catch {
    return false
  }
}

function isSupportedPlatform(platform, arch) {
  return (
    (platform === 'windows' && arch === 'x64') ||
    (platform === 'linux' && arch === 'x64') ||
    (platform === 'mac' && (arch === 'arm64' || arch === 'x64'))
  )
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeArchitecture(value) {
  if (typeof value !== 'string' || value.length === 0) return null

  const normalizedValue = value.toLowerCase()

  if (normalizedValue === 'arm64' || normalizedValue === 'aarch64' || normalizedValue === 'arm') return 'arm64'
  if (
    normalizedValue === 'x64' ||
    normalizedValue === 'x86_64' ||
    normalizedValue === 'amd64' ||
    normalizedValue === 'x86'
  ) return 'x64'

  return null
}

function readArchitectureFromUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length === 0) return null

  const normalizedUserAgent = userAgent.toLowerCase()

  if (/\b(arm64|aarch64|arm)\b/.test(normalizedUserAgent)) return 'arm64'
  if (/\b(x64|x86_64|amd64|x86)\b/.test(normalizedUserAgent)) return 'x64'

  return null
}
