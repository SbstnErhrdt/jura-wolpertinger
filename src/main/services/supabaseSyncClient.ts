import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import WsWebSocket from 'ws'
import type { SyncAuthInput } from '@shared/schemas'
import type {
  FeatureFlags,
  VoiceSessionCompleteInput,
  VoiceSessionCompleteResult,
  VoiceSessionStart,
  VoiceSessionStartInput
} from '@shared/ipc'
import type {
  CloudLearningCard,
  CloudLearningCollection,
  CloudLearningReviewEvent,
  CloudLearningSchedule,
  CloudLearningSyncState
} from './learningSyncService'
import type { WorkspaceSnapshot } from './syncService'

const DEFAULT_SYNC_URL = 'https://app.jura-wolpi.de/api'
const SYNC_BUCKET = 'user-files'
const LOCAL_ENV_FILES = ['.env.local', '.env', '../jura-supabase/.env', 'jura-supabase/.env']
const QUERY_CHUNK_SIZE = 50
type RealtimeTransportConstructor = new (address: string | URL, protocols?: string | string[]) => WebSocket

let localEnvCache: { cwd: string; values: Record<string, string> } | null = null

export type SyncAccount = {
  remoteUserId: string
  email: string | null
}

export class SupabaseSyncClient {
  private readonly client: SupabaseClient
  private readonly voiceBaseUrl: string
  private account: SyncAccount | null = null

  constructor(url = readSyncUrl(), anonKey = readSyncAnonKey()) {
    if (!anonKey) {
      throw new Error('Die Online-Verbindung ist in dieser Version noch nicht eingerichtet.')
    }
    this.voiceBaseUrl = resolveAppOrigin(url)
    this.client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      realtime: {
        transport: WsWebSocket as unknown as RealtimeTransportConstructor
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

  async getFeatureFlags(): Promise<FeatureFlags> {
    await this.getVoiceAccessToken()
    const { data, error } = await this.client.rpc('get_effective_feature_flags')
    if (error) return {}
    return typeof data === 'object' && data ? data as FeatureFlags : {}
  }

  async createVoiceReviewSession(input: VoiceSessionStartInput): Promise<VoiceSessionStart> {
    const response = await fetch(`${this.voiceBaseUrl}/voice/sessions`, {
      method: 'POST',
      headers: await this.voiceHeaders(),
      body: JSON.stringify(input)
    })
    if (!response.ok) throw new Error('Voice konnte nicht gestartet werden.')
    return response.json() as Promise<VoiceSessionStart>
  }

  async completeVoiceReviewSession(
    input: VoiceSessionCompleteInput
  ): Promise<VoiceSessionCompleteResult> {
    const response = await fetch(`${this.voiceBaseUrl}/voice/sessions/${input.sessionId}/complete`, {
      method: 'POST',
      headers: await this.voiceHeaders(),
      body: JSON.stringify({ transcript: input.transcript, assessment: input.assessment })
    })
    if (!response.ok) throw new Error('Voice-Bewertung konnte nicht gespeichert werden.')
    return response.json() as Promise<VoiceSessionCompleteResult>
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

  async downloadLearningState(): Promise<CloudLearningSyncState> {
    const account = this.requireAccount()
    const { data: collectionRows, error: collectionError } = await this.client
      .from('learning_collections')
      .select('id, owner_user_id, name, description_markdown, subject, source, is_archived, created_at, updated_at')
      .eq('owner_user_id', account.remoteUserId)
    if (collectionError) throw new Error(`Karteikarten konnten nicht geladen werden: ${collectionError.message}`)

    const { data: itemRows, error: itemError } = await this.client
      .from('learning_items')
      .select('id, primary_collection_id, owner_user_id, title, external_id, is_archived, created_at, updated_at')
      .eq('owner_user_id', account.remoteUserId)
    if (itemError) throw new Error(`Karteikarten konnten nicht geladen werden: ${itemError.message}`)

    const items = (itemRows ?? []) as Array<Record<string, unknown>>
    const itemIds = items.map((item) => String(item.id))
    const promptRows = await selectInChunks(itemIds, async (chunk) => {
      const { data, error } = await this.client
        .from('learning_prompts')
        .select('id, item_id, front_markdown, back_markdown, is_archived, created_at, updated_at')
        .in('item_id', chunk)
      if (error) throw new Error(`Karteikarten konnten nicht geladen werden: ${error.message}`)
      return (data ?? []) as Array<Record<string, unknown>>
    })
    const tagRows = await selectInChunks(itemIds, async (chunk) => {
      const { data, error } = await this.client
        .from('learning_item_tags')
        .select('item_id, learning_tags(name)')
        .in('item_id', chunk)
      if (error) throw new Error(`Karteikarten-Tags konnten nicht geladen werden: ${error.message}`)
      return (data ?? []) as Array<Record<string, unknown>>
    })
    const promptIds = promptRows.map((prompt) => String(prompt.id))
    const scheduleRows = await selectInChunks(promptIds, async (chunk) => {
      const { data, error } = await this.client
        .from('learning_prompt_schedules')
        .select('user_id, prompt_id, due_at, reps, lapses, last_rating, last_reviewed_at, updated_at')
        .eq('user_id', account.remoteUserId)
        .in('prompt_id', chunk)
      if (error) throw new Error(`Karteikarten-Zeitplan konnte nicht geladen werden: ${error.message}`)
      return (data ?? []) as Array<Record<string, unknown>>
    })
    const { data: reviewRows, error: reviewError } = await this.client
      .from('review_events')
      .select('id, user_id, prompt_id, rating, reviewed_at, elapsed_ms')
      .eq('user_id', account.remoteUserId)
    if (reviewError) throw new Error(`Karteikarten-Bewertungen konnten nicht geladen werden: ${reviewError.message}`)

    const itemsById = new Map(items.map((item) => [String(item.id), item]))
    const tagsByItemId = groupTagsByItemId(tagRows)
    return {
      collections: ((collectionRows ?? []) as Array<Record<string, unknown>>).map((row): CloudLearningCollection => ({
        id: String(row.id),
        ownerUserId: String(row.owner_user_id),
        name: String(row.name),
        description: row.description_markdown ? String(row.description_markdown) : '',
        subject: row.subject ? String(row.subject) : null,
        source: row.source ? String(row.source) : null,
        isArchived: Boolean(row.is_archived),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at)
      })),
      cards: promptRows
        .map((prompt): CloudLearningCard | null => {
          const item = itemsById.get(String(prompt.item_id))
          if (!item) return null
          return {
            id: String(prompt.id),
            itemId: String(item.id),
            collectionId: String(item.primary_collection_id),
            ownerUserId: String(item.owner_user_id),
            title: String(item.title),
            externalId: item.external_id ? String(item.external_id) : null,
            frontMarkdown: String(prompt.front_markdown),
            backMarkdown: String(prompt.back_markdown),
            tags: tagsByItemId.get(String(item.id)) ?? [],
            isArchived: Boolean(item.is_archived) || Boolean(prompt.is_archived),
            createdAt: String(prompt.created_at),
            updatedAt: maxIso(String(item.updated_at), String(prompt.updated_at))
          }
        })
        .filter((card): card is CloudLearningCard => Boolean(card)),
      schedules: scheduleRows.map((row): CloudLearningSchedule => ({
        userId: String(row.user_id),
        cardId: String(row.prompt_id),
        dueAt: String(row.due_at),
        reps: Number(row.reps ?? 0),
        lapses: Number(row.lapses ?? 0),
        lastRating: row.last_rating === null || row.last_rating === undefined ? null : Number(row.last_rating) as CloudLearningSchedule['lastRating'],
        lastReviewedAt: row.last_reviewed_at ? String(row.last_reviewed_at) : null,
        updatedAt: String(row.updated_at)
      })),
      reviewEvents: ((reviewRows ?? []) as Array<Record<string, unknown>>).map((row): CloudLearningReviewEvent => ({
        id: String(row.id),
        userId: String(row.user_id),
        cardId: String(row.prompt_id),
        rating: Number(row.rating) as CloudLearningReviewEvent['rating'],
        reviewedAt: String(row.reviewed_at),
        elapsedMs: row.elapsed_ms === null || row.elapsed_ms === undefined ? null : Number(row.elapsed_ms)
      }))
    }
  }

  async uploadLearningState(state: CloudLearningSyncState): Promise<void> {
    const account = this.requireAccount()
    if (state.collections.length) {
      const { error } = await this.client.from('learning_collections').upsert(
        state.collections.map((collection) => ({
          id: collection.id,
          owner_user_id: account.remoteUserId,
          author_user_id: account.remoteUserId,
          parent_collection_id: null,
          name: collection.name,
          description_markdown: collection.description,
          subject: collection.subject,
          source: collection.source,
          visibility: 'private',
          anonymous_public_attribution: false,
          is_archived: collection.isArchived,
          created_at: collection.createdAt,
          updated_at: collection.updatedAt
        })),
        { onConflict: 'id' }
      )
      if (error) throw new Error(`Karteikarten-Sammlungen konnten nicht gesichert werden: ${error.message}`)
    }

    if (state.cards.length) {
      const { error: itemError } = await this.client.from('learning_items').upsert(
        state.cards.map((card) => ({
          id: card.itemId,
          primary_collection_id: card.collectionId,
          owner_user_id: account.remoteUserId,
          author_user_id: account.remoteUserId,
          title: card.title,
          source_kind: card.externalId ? 'imported' : 'manual',
          external_id: card.externalId,
          is_archived: card.isArchived,
          created_at: card.createdAt,
          updated_at: card.updatedAt
        })),
        { onConflict: 'id' }
      )
      if (itemError) throw new Error(`Karteikarten konnten nicht gesichert werden: ${itemError.message}`)

      const { error: promptError } = await this.client.from('learning_prompts').upsert(
        state.cards.map((card) => ({
          id: card.id,
          item_id: card.itemId,
          prompt_type: 'qa',
          front_markdown: card.frontMarkdown,
          back_markdown: card.backMarkdown,
          sort_index: 0,
          is_archived: card.isArchived,
          created_at: card.createdAt,
          updated_at: card.updatedAt
        })),
        { onConflict: 'id' }
      )
      if (promptError) throw new Error(`Karteikarten konnten nicht gesichert werden: ${promptError.message}`)

      await this.replaceLearningTags(state.cards)
    }

    if (state.schedules.length) {
      const { error } = await this.client.from('learning_prompt_schedules').upsert(
        state.schedules.map((schedule) => ({
          user_id: account.remoteUserId,
          prompt_id: schedule.cardId,
          due_at: schedule.dueAt,
          reps: schedule.reps,
          lapses: schedule.lapses,
          last_rating: schedule.lastRating,
          last_reviewed_at: schedule.lastReviewedAt,
          updated_at: schedule.updatedAt
        })),
        { onConflict: 'user_id,prompt_id' }
      )
      if (error) throw new Error(`Karteikarten-Zeitplan konnte nicht gesichert werden: ${error.message}`)
    }

    if (state.reviewEvents.length) {
      const { error } = await this.client.from('review_events').upsert(
        state.reviewEvents.map((event) => ({
          id: event.id,
          client_event_id: event.id,
          user_id: account.remoteUserId,
          prompt_id: event.cardId,
          rating: event.rating,
          reviewed_at: event.reviewedAt,
          elapsed_ms: event.elapsedMs
        })),
        { onConflict: 'id' }
      )
      if (error) throw new Error(`Karteikarten-Bewertungen konnten nicht gesichert werden: ${error.message}`)
    }
  }

  private requireAccount(): SyncAccount {
    if (!this.account) throw new Error('Bitte zuerst mit der Online-Version verbinden.')
    return this.account
  }

  private async voiceHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.getVoiceAccessToken()
    return {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    }
  }

  private async getVoiceAccessToken(): Promise<string> {
    const { data, error } = await this.client.auth.getSession()
    const accessToken = data.session?.access_token
    if (error || !accessToken) {
      throw new Error('Bitte verbinde dein Online-Konto, um Voice zu nutzen.')
    }
    return accessToken
  }

  private async replaceLearningTags(cards: CloudLearningCard[]): Promise<void> {
    const account = this.requireAccount()
    const tagNames = [...new Set(cards.flatMap((card) => card.tags))]
    if (tagNames.length) {
      const { error: upsertError } = await this.client.from('learning_tags').upsert(
        tagNames.map((name) => ({ owner_user_id: account.remoteUserId, name })),
        { onConflict: 'owner_user_id,name' }
      )
      if (upsertError) throw new Error(`Karteikarten-Tags konnten nicht gesichert werden: ${upsertError.message}`)
    }

    const tagRows = tagNames.length
      ? await selectInChunks(tagNames, async (chunk) => {
          const { data, error } = await this.client
            .from('learning_tags')
            .select('id, name')
            .eq('owner_user_id', account.remoteUserId)
            .in('name', chunk)
          if (error) throw new Error(`Karteikarten-Tags konnten nicht geladen werden: ${error.message}`)
          return (data ?? []) as Array<Record<string, unknown>>
        })
      : []
    const tagIdByName = new Map(tagRows.map((row) => [String(row.name), String(row.id)]))
    const itemIds = cards.map((card) => card.itemId)
    await selectInChunks(itemIds, async (chunk) => {
      const { error } = await this.client.from('learning_item_tags').delete().in('item_id', chunk)
      if (error) throw new Error(`Karteikarten-Tags konnten nicht aktualisiert werden: ${error.message}`)
      return []
    })
    const links = cards.flatMap((card) =>
      card.tags
        .map((tag) => tagIdByName.get(tag))
        .filter((tagId): tagId is string => Boolean(tagId))
        .map((tagId) => ({ item_id: card.itemId, tag_id: tagId }))
    )
    if (!links.length) return
    const { error: linkError } = await this.client.from('learning_item_tags').insert(links)
    if (linkError) throw new Error(`Karteikarten-Tags konnten nicht gesichert werden: ${linkError.message}`)
  }
}

function accountFromUser(user: User): SyncAccount {
  return {
    remoteUserId: user.id,
    email: user.email ?? null
  }
}

function readSyncUrl(): string {
  return (
    readEnvValue('JURA_SYNC_SUPABASE_URL') ||
    readEnvValue('VITE_SUPABASE_URL') ||
    process.env.JURA_EMBEDDED_SYNC_SUPABASE_URL ||
    DEFAULT_SYNC_URL
  )
}

function readSyncAnonKey(): string {
  return (
    readEnvValue('JURA_SYNC_SUPABASE_ANON_KEY') ||
    readEnvValue('VITE_SUPABASE_ANON_KEY') ||
    readEnvValue('ANON_KEY') ||
    process.env.JURA_EMBEDDED_SYNC_SUPABASE_ANON_KEY ||
    ''
  )
}

function resolveAppOrigin(syncUrl: string): string {
  const url = new URL(syncUrl)
  url.pathname = url.pathname.replace(/\/api\/?$/, '') || '/'
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

async function selectInChunks<TInput, TOutput>(
  values: TInput[],
  selectChunk: (chunk: TInput[]) => Promise<TOutput[]>
): Promise<TOutput[]> {
  const output: TOutput[] = []
  for (let index = 0; index < values.length; index += QUERY_CHUNK_SIZE) {
    output.push(...await selectChunk(values.slice(index, index + QUERY_CHUNK_SIZE)))
  }
  return output
}

function groupTagsByItemId(rows: Array<Record<string, unknown>>): Map<string, string[]> {
  const tagsByItemId = new Map<string, string[]>()
  for (const row of rows) {
    const relation = row.learning_tags as { name?: unknown } | Array<{ name?: unknown }> | null
    const tag = Array.isArray(relation) ? relation[0]?.name : relation?.name
    if (!tag) continue
    const itemId = String(row.item_id)
    const tags = tagsByItemId.get(itemId) ?? []
    tags.push(String(tag))
    tagsByItemId.set(itemId, [...new Set(tags.map((value) => value.trim().toLowerCase()).filter(Boolean))])
  }
  return tagsByItemId
}

function maxIso(left: string, right: string): string {
  return left > right ? left : right
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
