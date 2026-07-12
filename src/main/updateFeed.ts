const DEFAULT_UPDATE_BASE_URL = 'https://downloads.jura-wolpi.de/desktop/stable'

const SUPPORTED_FEED_PATHS: Record<string, string> = {
  'darwin:arm64': 'mac/arm64',
  'darwin:x64': 'mac/x64',
  'linux:x64': 'linux/x64',
  'win32:x64': 'windows/x64'
}

export interface ResolveUpdateFeedUrlInput {
  baseUrl?: string
  platform: NodeJS.Platform
  arch: string
}

export interface FeedUrlConfigurable {
  setFeedURL(options: { provider: 'generic'; url: string }): void
}

export function resolveUpdateFeedUrl({
  baseUrl,
  platform,
  arch
}: ResolveUpdateFeedUrlInput): string | null {
  const feedPath = SUPPORTED_FEED_PATHS[`${platform}:${arch}`]
  if (!feedPath) return null

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  return `${normalizedBaseUrl}/${feedPath}`
}

export function configureAutoUpdaterFeed(updater: FeedUrlConfigurable, url: string): void {
  updater.setFeedURL({ provider: 'generic', url })
}

function normalizeBaseUrl(baseUrl?: string): string {
  const candidate = baseUrl?.trim() || DEFAULT_UPDATE_BASE_URL
  return candidate.replace(/\/+$/, '')
}
