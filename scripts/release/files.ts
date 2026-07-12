import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'

export async function listDirectoryFiles(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

export async function readFileInfo(filePath: string) {
  const [bytes, details] = await Promise.all([readFile(filePath), stat(filePath)])

  return {
    size: details.size,
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
  const lastSegment = value.split('/').at(-1) ?? value

  try {
    return decodeURIComponent(lastSegment)
  } catch {
    return lastSegment
  }
}
