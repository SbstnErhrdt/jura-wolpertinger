import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'

export async function listDirectoryFiles(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

export async function readFileInfo(filePath: string) {
  const bytes = await readFile(filePath)

  return {
    size: bytes.length,
    sha512: createHash('sha512').update(bytes).digest('base64')
  }
}

export function buildVersionedArtifactPath(version: string, fileName: string) {
  return `${version}/${encodeURIComponent(fileName)}`
}

export function joinUrlPath(baseUrl: string, ...segments: string[]) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

  const normalizedSegments = segments
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter((segment) => segment.length > 0)

  return [normalizedBaseUrl, ...normalizedSegments].join('/')
}

export function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

export function extractArtifactFileName(value: string) {
  const lastSegment = value
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0)
    .at(-1) ?? value

  try {
    return decodeURIComponent(lastSegment)
  } catch {
    return lastSegment
  }
}

export function assertRelativeObjectPath(value: string) {
  if (value.length === 0) {
    throw new Error('Release artifact remotePath must be a strict relative object path.')
  }

  if (value.includes('\\')) {
    throw new Error('Release artifact remotePath must be a strict relative object path.')
  }

  if (value.startsWith('/')) {
    throw new Error('Release artifact remotePath must be a strict relative object path.')
  }

  if (/^[A-Za-z]:\//.test(value)) {
    throw new Error('Release artifact remotePath must be a strict relative object path.')
  }

  const segments = value.split('/')

  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) {
    throw new Error('Release artifact remotePath must be a strict relative object path.')
  }

  return value
}
