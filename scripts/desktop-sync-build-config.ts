import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_SYNC_URL = 'https://app.jura-wolpi.de/api'
const LOCAL_ENV_FILES = ['.env.local', '.env', '../jura-supabase/.env', 'jura-supabase/.env']

export type DesktopSyncBuildConfig = {
  url: string
  anonKey: string
}

export function readDesktopSyncBuildConfig(
  cwd = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env
): DesktopSyncBuildConfig {
  const localEnvironment = readLocalEnvFiles(cwd)
  const readValue = (name: string) => environment[name]?.trim() || localEnvironment[name]?.trim() || ''

  return {
    url: readValue('JURA_SYNC_SUPABASE_URL') || readValue('VITE_SUPABASE_URL') || DEFAULT_SYNC_URL,
    anonKey:
      readValue('JURA_SYNC_SUPABASE_ANON_KEY') ||
      readValue('VITE_SUPABASE_ANON_KEY') ||
      readValue('ANON_KEY')
  }
}

export function requireDesktopSyncBuildConfig(config: DesktopSyncBuildConfig): void {
  if (!config.anonKey) {
    throw new Error(
      'Desktop-Sync-Konfiguration fehlt: JURA_SYNC_SUPABASE_ANON_KEY muss für Release-Builds gesetzt sein.'
    )
  }
}

function readLocalEnvFiles(cwd: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const envFile of LOCAL_ENV_FILES) {
    const path = resolve(cwd, envFile)
    if (!existsSync(path)) continue

    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [key, ...valueParts] = trimmed.split('=')
      values[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return values
}
