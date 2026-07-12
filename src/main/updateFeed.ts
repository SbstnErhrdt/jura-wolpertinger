const DEFAULT_UPDATE_BASE_URL = 'https://downloads.jura-wolpi.de/desktop/stable'

const PLATFORM_SEGMENTS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'mac',
  linux: 'linux',
  win32: 'windows'
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
  const platformSegment = PLATFORM_SEGMENTS[platform]
  if (!platformSegment) return null

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  return `${normalizedBaseUrl}/${platformSegment}/${arch}`
}

export function configureAutoUpdaterFeed(updater: FeedUrlConfigurable, url: string): void {
  updater.setFeedURL({ provider: 'generic', url })
}

function normalizeBaseUrl(baseUrl?: string): string {
  const candidate = baseUrl?.trim() || DEFAULT_UPDATE_BASE_URL
  return candidate.replace(/\/+$/, '')
}
