import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { SyncAuthInput } from '@shared/schemas'
import type { WorkspaceSnapshot } from './syncService'

const DEFAULT_SYNC_URL = 'https://app.jura-wolpi.de/api'
const SYNC_BUCKET = 'user-files'
const LOCAL_ENV_FILES = ['.env.local', '.env', '../jura-supabase/.env', 'jura-supabase/.env']

let localEnvCache: { cwd: string; values: Record<string, string> } | null = null

export type SyncAccount = {
  remoteUserId: string
  email: string | null
}

export class SupabaseSyncClient {
  private readonly client: SupabaseClient
  private account: SyncAccount | null = null

  constructor(url = readSyncUrl(), anonKey = readSyncAnonKey()) {
    if (!anonKey) {
      throw new Error('Die Online-Verbindung ist in dieser Version noch nicht eingerichtet.')
    }
    this.client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  }

  async signIn(input: SyncAuthInput): Promise<SyncAccount> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password
    })
    if (error || !data.user) {
      throw new Error('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.')
    }
    this.account = accountFromUser(data.user)
    return this.account
  }

  async uploadSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
    const account = this.requireAccount()
    const { error } = await this.client
      .from('user_sync_snapshots')
      .upsert(
        {
          user_id: account.remoteUserId,
          local_user_id: snapshot.localUserId,
          snapshot_version: snapshot.snapshotVersion,
          payload_json: {
            exportedAt: snapshot.exportedAt,
            tables: snapshot.tables
          },
          file_manifest_json: snapshot.files.map((file) => ({
            attachmentId: file.attachmentId,
            relativePath: file.relativePath,
            storagePath: file.storagePath,
            size: file.size
          }))
        },
        { onConflict: 'user_id,local_user_id' }
      )
    if (error) throw new Error(`Online-Sicherung fehlgeschlagen: ${error.message}`)
  }

  async downloadLatestSnapshot(localUserId: string): Promise<WorkspaceSnapshot | null> {
    const account = this.requireAccount()
    const { data, error } = await this.client
      .from('user_sync_snapshots')
      .select('payload_json,file_manifest_json,local_user_id')
      .eq('user_id', account.remoteUserId)
      .eq('local_user_id', localUserId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`Online-Daten konnten nicht geladen werden: ${error.message}`)
    if (!data) return null

    const payload = data.payload_json as { exportedAt?: string; tables?: Record<string, Array<Record<string, unknown>>> }
    const files = (data.file_manifest_json as Array<{
      attachmentId: string
      relativePath: string
      storagePath: string
      size: number
    }> | null) ?? []

    return {
      snapshotVersion: 1,
      localUserId: String(data.local_user_id),
      exportedAt: payload.exportedAt ?? new Date().toISOString(),
      tables: payload.tables ?? {},
      files: files.map((file) => ({
        ...file,
        localPath: ''
      }))
    }
  }

  async uploadFile(path: string, bytes: Uint8Array): Promise<void> {
    const { error } = await this.client.storage.from(SYNC_BUCKET).upload(path, bytes, {
      upsert: true
    })
    if (error) throw new Error(`Datei konnte nicht online gesichert werden: ${error.message}`)
  }

  async downloadFile(path: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage.from(SYNC_BUCKET).download(path)
    if (error || !data) throw new Error(`Datei konnte nicht geladen werden: ${error?.message ?? 'Unbekannter Fehler'}`)
    return new Uint8Array(await data.arrayBuffer())
  }

  private requireAccount(): SyncAccount {
    if (!this.account) throw new Error('Bitte zuerst mit der Online-Version verbinden.')
    return this.account
  }
}

function accountFromUser(user: User): SyncAccount {
  return {
    remoteUserId: user.id,
    email: user.email ?? null
  }
}

function readSyncUrl(): string {
  return readEnvValue('JURA_SYNC_SUPABASE_URL') || readEnvValue('VITE_SUPABASE_URL') || DEFAULT_SYNC_URL
}

function readSyncAnonKey(): string {
  return (
    readEnvValue('JURA_SYNC_SUPABASE_ANON_KEY') ||
    readEnvValue('VITE_SUPABASE_ANON_KEY') ||
    readEnvValue('ANON_KEY') ||
    ''
  )
}

function readEnvValue(name: string): string | undefined {
  return process.env[name] ?? readLocalEnvFiles()[name]
}

function readLocalEnvFiles(): Record<string, string> {
  const cwd = process.cwd()
  if (localEnvCache?.cwd === cwd) return localEnvCache.values

  const values: Record<string, string> = {}
  for (const envFile of LOCAL_ENV_FILES) {
    const path = resolve(cwd, envFile)
    if (!existsSync(path)) continue
    const content = readFileSync(path, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [key, ...valueParts] = trimmed.split('=')
      const rawValue = valueParts.join('=').trim()
      values[key.trim()] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  }

  localEnvCache = { cwd, values }
  return values
}
