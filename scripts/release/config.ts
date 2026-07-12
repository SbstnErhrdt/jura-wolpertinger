export interface ReleaseStorageConfig {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl: string
}

const REQUIRED_ENVIRONMENT_VARIABLES = [
  'UPDATE_S3_ENDPOINT',
  'UPDATE_S3_BUCKET',
  'UPDATE_S3_ACCESS_KEY_ID',
  'UPDATE_S3_SECRET_ACCESS_KEY',
  'UPDATE_PUBLIC_BASE_URL'
] as const

export function readReleaseStorageConfig(env: Record<string, string | undefined>): ReleaseStorageConfig {
  const missing = REQUIRED_ENVIRONMENT_VARIABLES.filter((name) => !env[name]?.trim())

  if (missing.length > 0) {
    throw new Error(`Missing required release storage environment variables: ${missing.join(', ')}`)
  }

  const endpoint = env.UPDATE_S3_ENDPOINT!.trim()
  const publicBaseUrl = env.UPDATE_PUBLIC_BASE_URL!.trim()

  validateUrl('UPDATE_S3_ENDPOINT', endpoint)
  validateUrl('UPDATE_PUBLIC_BASE_URL', publicBaseUrl)

  return {
    endpoint,
    bucket: env.UPDATE_S3_BUCKET!.trim(),
    accessKeyId: env.UPDATE_S3_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.UPDATE_S3_SECRET_ACCESS_KEY!.trim(),
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, '')
  }
}

function validateUrl(name: string, value: string) {
  try {
    new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL.`)
  }
}
