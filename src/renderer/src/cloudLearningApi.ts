import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import type {
  AppApi,
  CreateLearningCardInput,
  CreateLearningCollectionInput,
  GetReviewBatchInput,
  RecordReviewInput,
  RecordReviewResult,
  UpdateLearningCardInput
} from '@shared/ipc'
import type {
  LearningCard,
  LearningCollection,
  LearningDashboard,
  LearningImportResult,
  LearningReviewEvent,
  ReviewCard,
  ReviewRating,
  User
} from '@shared/schemas'
import {
  learningExportFileSchema,
  learningImportResultSchema,
  learningReviewEventSchema,
  reviewRatingSchema
} from '@shared/schemas'
import { getSupabaseAuthClient } from './cloudAuth'

type CloudCollectionRow = {
  id: string
  owner_user_id: string
  name: string
  description_markdown: string | null
  subject: string | null
  source: string | null
  card_count: number
  due_count: number
  created_at: string
  updated_at: string
}

type CloudItemRow = {
  id: string
  primary_collection_id: string
  owner_user_id: string
  title: string
  external_id: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

type CloudPromptRow = {
  id: string
  item_id: string
  front_markdown: string
  back_markdown: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

type CloudScheduleRow = {
  prompt_id: string
  due_at: string
  reps: number
  lapses: number
  last_rating: ReviewRating | null
}

type CloudTagRow = {
  item_id: string
  learning_tags: { name: string } | { name: string }[] | null
}

type CloudReviewBatchRow = {
  prompt_id: string
  item_id: string
  collection_id: string
  front_markdown: string
  back_markdown: string
  due_at: string | null
}

const CLOUD_QUERY_CHUNK_SIZE = 50

export function createCloudLearningApi(localApi: AppApi): AppApi {
  return {
    ...localApi,
    async getCurrentUser() {
      const { user } = await requireCloudContext()
      return cloudUserFromSupabaseUser(user)
    },
    async listUsers() {
      const { user } = await requireCloudContext()
      return [cloudUserFromSupabaseUser(user)]
    },
    async createUser() {
      const { user } = await requireCloudContext()
      return cloudUserFromSupabaseUser(user)
    },
    async updateUser() {
      const { user } = await requireCloudContext()
      return cloudUserFromSupabaseUser(user)
    },
    async switchUser() {
      const { user } = await requireCloudContext()
      return cloudUserFromSupabaseUser(user)
    },
    async completeOnboarding() {
      const { user } = await requireCloudContext()
      return cloudUserFromSupabaseUser(user)
    },
    async completeTour() {
      const { user } = await requireCloudContext()
      return cloudUserFromSupabaseUser(user)
    },
    async resetTour() {
      const { user } = await requireCloudContext()
      return cloudUserFromSupabaseUser(user)
    },
    async getLearningDashboard() {
      const [summary, reviewDays] = await Promise.all([
        getCloudLearningDashboardSummary(),
        listCloudReviewDays()
      ])
      const now = nowIso()
      const activityDays = new Set(reviewDays)
      return {
        dueCount: summary.dueCount,
        totalCards: summary.totalCards,
        collectionCount: summary.collectionCount,
        streakDays: calculateCloudStreakDays(activityDays),
        freeDaysRemainingThisWeek: Math.max(0, 2 - countCloudMissedDaysThisWeek(activityDays)),
        learnedToday: activityDays.has(localDateKey(new Date()))
      } satisfies LearningDashboard
    },
    async exportLearningDecksJson() {
      const collections = await listCloudCollections()
      const collectionCards = await Promise.all(
        collections.map(async (collection) => ({
          externalId: collection.id,
          name: collection.name,
          description: collection.description,
          subject: collection.subject,
          source: collection.source,
          cards: (await listCloudCards(collection.id)).map((card) => ({
            externalId: card.externalId ?? card.id,
            title: card.title,
            frontMarkdown: card.frontMarkdown,
            backMarkdown: card.backMarkdown,
            tags: card.tags
          }))
        }))
      )
      return JSON.stringify(
        learningExportFileSchema.parse({
          format: 'jura-wolpertinger.learning-export',
          formatVersion: 1,
          exportedAt: nowIso(),
          collections: collectionCards
        }),
        null,
        2
      )
    },
    async importLearningDecksJson(json: string): Promise<LearningImportResult> {
      const file = learningExportFileSchema.parse(JSON.parse(json))
      const { client, user } = await requireCloudContext()
      const result = {
        collectionsImported: 0,
        cardsImported: 0,
        cardsSkipped: 0
      }

      for (const collectionInput of file.collections) {
        let collection = await findCloudCollectionByName(client, user.id, collectionInput.name)
        if (!collection) {
          collection = await createCloudCollection(collectionInput)
          result.collectionsImported += 1
        }

        for (const cardInput of collectionInput.cards) {
          const existing = await findCloudItemByExternalId(
            client,
            user.id,
            collection.id,
            cardInput.externalId
          )
          if (existing) {
            result.cardsSkipped += 1
            continue
          }
          await createCloudCard({
            collectionId: collection.id,
            title: cardInput.title,
            frontMarkdown: cardInput.frontMarkdown,
            backMarkdown: cardInput.backMarkdown,
            tags: cardInput.tags
          }, cardInput.externalId)
          result.cardsImported += 1
        }
      }

      return learningImportResultSchema.parse(result)
    },
    async listLearningCollections() {
      return listCloudCollections()
    },
    async createLearningCollection(input: CreateLearningCollectionInput) {
      return createCloudCollection(input)
    },
    async listLearningCards(collectionId?: string | null) {
      return listCloudCards(collectionId ?? null)
    },
    async createLearningCard(input: CreateLearningCardInput) {
      return createCloudCard(input, null)
    },
    async updateLearningCard(input: UpdateLearningCardInput) {
      return updateCloudCard(input)
    },
    async getReviewBatch(input: GetReviewBatchInput = {}) {
      if (!input.tag) return listCloudReviewBatch(input)
      const cards = await listCloudCards(input.collectionId ?? null)
      const excluded = new Set(input.excludeCardIds ?? [])
      const now = nowIso()
      const limit = Math.min(Math.max(input.limit ?? 30, 1), 100)
      return cards
        .filter((card) => card.dueAt <= now)
        .filter((card) => card.tags.includes(input.tag ?? ''))
        .filter((card) => !excluded.has(card.id))
        .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
        .slice(0, limit)
    },
    async recordReview(input: RecordReviewInput): Promise<RecordReviewResult> {
      const { client, user } = await requireCloudContext()
      const rating = reviewRatingSchema.parse(input.rating)
      const clientEventId = newId()
      const { data, error } = await client.rpc('record_review', {
        p_prompt_id: input.cardId,
        p_rating: rating,
        p_elapsed_ms: input.elapsedMs ?? null,
        p_client_event_id: clientEventId
      })
      if (error) throw error
      const payload = data as {
        event_id?: string
        due_at?: string
        reps?: number
        lapses?: number
      }
      const reviewedAt = nowIso()
      const event = learningReviewEventSchema.parse({
        schemaVersion: 1,
        id: payload.event_id ?? clientEventId,
        userId: user.id,
        cardId: input.cardId,
        rating,
        reviewedAt,
        elapsedMs: input.elapsedMs ?? null
      } satisfies LearningReviewEvent)
      const nextDueAt = payload.due_at ?? reviewedAt
      return {
        event,
        nextDueAt,
        intervalLabel: formatDueIntervalLabel(nextDueAt)
      }
    }
  }
}

async function requireCloudContext(): Promise<{
  client: SupabaseClient
  user: SupabaseUser
}> {
  const client = getSupabaseAuthClient()
  if (!client) throw new Error('Cloud-Verbindung ist nicht konfiguriert.')
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  if (!data.session?.user) throw new Error('Bitte melde dich erneut an.')
  return { client, user: data.session.user }
}

function cloudUserFromSupabaseUser(user: SupabaseUser): User {
  const createdAt = user.created_at ?? nowIso()
  return {
    id: user.id,
    displayName: user.user_metadata?.display_name || user.email || 'Cloud-Nutzer',
    kind: 'remote',
    remoteUserId: user.id,
    onboardingCompletedAt: nowIso(),
    tourCompletedAt: nowIso(),
    createdAt,
    updatedAt: user.updated_at ?? createdAt
  }
}

async function listCloudCollections(): Promise<LearningCollection[]> {
  const { client } = await requireCloudContext()
  const { data: rows, error } = await client.rpc('get_learning_collection_summaries')
  if (error) throw error

  return ((rows ?? []) as CloudCollectionRow[]).map((row) => ({
    schemaVersion: 1,
    id: row.id,
    userId: row.owner_user_id,
    name: row.name,
    description: row.description_markdown ?? '',
    subject: row.subject,
    source: row.source,
    cardCount: Number(row.card_count ?? 0),
    dueCount: Number(row.due_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

async function createCloudCollection(
  input: CreateLearningCollectionInput
): Promise<LearningCollection> {
  const { client, user } = await requireCloudContext()
  const { data, error } = await client.rpc('create_learning_collection', {
    p_name: input.name.trim() || 'Neue Sammlung',
    p_parent_collection_id: null,
    p_is_public: false,
    p_anonymous_public_attribution: false
  })
  if (error) throw error
  const collectionId = String(data)
  const { error: updateError } = await client
    .from('learning_collections')
    .update({
      description_markdown: input.description?.trim() ?? '',
      subject: input.subject?.trim() || null,
      source: input.source?.trim() || null
    })
    .eq('id', collectionId)
    .eq('owner_user_id', user.id)
  if (updateError) throw updateError
  return getCloudCollection(collectionId)
}

async function getCloudCollection(collectionId: string): Promise<LearningCollection> {
  const collection = (await listCloudCollections()).find((candidate) => candidate.id === collectionId)
  if (!collection) throw new Error(`Sammlung nicht gefunden: ${collectionId}`)
  return collection
}

async function findCloudCollectionByName(
  client: SupabaseClient,
  userId: string,
  name: string
): Promise<LearningCollection | null> {
  const { data, error } = await client
    .from('learning_collections')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('name', name)
    .eq('is_archived', false)
    .maybeSingle()
  if (error) throw error
  return data?.id ? getCloudCollection(String(data.id)) : null
}

async function findCloudItemByExternalId(
  client: SupabaseClient,
  userId: string,
  collectionId: string,
  externalId: string
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from('learning_items')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('primary_collection_id', collectionId)
    .eq('external_id', externalId)
    .eq('is_archived', false)
    .maybeSingle()
  if (error) throw error
  return data ? { id: String(data.id) } : null
}

async function listCloudCards(collectionId: string | null): Promise<LearningCard[]> {
  const { client, user } = await requireCloudContext()
  let itemQuery = client
    .from('learning_items')
    .select('id, primary_collection_id, owner_user_id, title, external_id, is_archived, created_at, updated_at')
    .eq('owner_user_id', user.id)
    .eq('is_archived', false)
  if (collectionId) itemQuery = itemQuery.eq('primary_collection_id', collectionId)
  const { data: items, error: itemsError } = await itemQuery
    .order('updated_at', { ascending: false })
    .returns<CloudItemRow[]>()
  if (itemsError) throw itemsError
  if (!items.length) return []

  const itemIds = items.map((item) => item.id)
  const prompts = await selectInChunks(itemIds, async (chunk) => {
    const { data, error } = await client
      .from('learning_prompts')
      .select('id, item_id, front_markdown, back_markdown, is_archived, created_at, updated_at')
      .in('item_id', chunk)
      .eq('is_archived', false)
      .order('sort_index', { ascending: true })
      .returns<CloudPromptRow[]>()
    if (error) throw error
    return data ?? []
  })
  if (!prompts.length) return []

  const promptIds = prompts.map((prompt) => prompt.id)
  const schedules = await selectInChunks(promptIds, async (chunk) => {
    const { data, error } = await client
      .from('learning_prompt_schedules')
      .select('prompt_id, due_at, reps, lapses, last_rating')
      .eq('user_id', user.id)
      .in('prompt_id', chunk)
      .returns<CloudScheduleRow[]>()
    if (error) throw error
    return data ?? []
  })

  const tagRows = await selectInChunks(itemIds, async (chunk) => {
    const { data, error } = await client
      .from('learning_item_tags')
      .select('item_id, learning_tags(name)')
      .in('item_id', chunk)
      .returns<CloudTagRow[]>()
    if (error) throw error
    return data ?? []
  })

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const schedulesByPromptId = new Map((schedules ?? []).map((schedule) => [schedule.prompt_id, schedule]))
  const tagsByItemId = groupCloudTags(tagRows ?? [])

  return prompts
    .map((prompt) => {
      const item = itemsById.get(prompt.item_id)
      if (!item) return null
      const schedule = schedulesByPromptId.get(prompt.id)
      return {
        schemaVersion: 1,
        id: prompt.id,
        userId: item.owner_user_id,
        collectionId: item.primary_collection_id,
        externalId: item.external_id,
        title: item.title,
        frontMarkdown: prompt.front_markdown,
        backMarkdown: prompt.back_markdown,
        tags: tagsByItemId.get(item.id) ?? [],
        isArchived: item.is_archived || prompt.is_archived,
        dueAt: schedule?.due_at ?? prompt.created_at,
        lastRating: schedule?.last_rating ?? null,
        reps: schedule?.reps ?? 0,
        lapses: schedule?.lapses ?? 0,
        createdAt: prompt.created_at,
        updatedAt: prompt.updated_at > item.updated_at ? prompt.updated_at : item.updated_at
      } satisfies LearningCard
    })
    .filter((card): card is LearningCard => Boolean(card))
}

async function listCloudReviewBatch(input: GetReviewBatchInput = {}): Promise<ReviewCard[]> {
  const { client, user } = await requireCloudContext()
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 100)
  const { data, error } = await client.rpc('get_review_batch', {
    p_collection_ids: input.collectionId ? [input.collectionId] : null,
    p_tag_ids: null,
    p_limit: limit,
    p_exclude_prompt_ids: input.excludeCardIds ?? []
  })
  if (error) throw error

  const rows = (data ?? []) as CloudReviewBatchRow[]
  if (!rows.length) return []

  const itemIds = unique(rows.map((row) => row.item_id))
  const promptIds = unique(rows.map((row) => row.prompt_id))
  const [items, schedules, tagRows] = await Promise.all([
    selectInChunks(itemIds, async (chunk) => {
      const { data: itemRows, error: itemsError } = await client
        .from('learning_items')
        .select('id, primary_collection_id, owner_user_id, title, external_id, is_archived, created_at, updated_at')
        .in('id', chunk)
        .returns<CloudItemRow[]>()
      if (itemsError) throw itemsError
      return itemRows ?? []
    }),
    selectInChunks(promptIds, async (chunk) => {
      const { data: scheduleRows, error: scheduleError } = await client
        .from('learning_prompt_schedules')
        .select('prompt_id, due_at, reps, lapses, last_rating')
        .eq('user_id', user.id)
        .in('prompt_id', chunk)
        .returns<CloudScheduleRow[]>()
      if (scheduleError) throw scheduleError
      return scheduleRows ?? []
    }),
    selectInChunks(itemIds, async (chunk) => {
      const { data: nextTagRows, error: tagsError } = await client
        .from('learning_item_tags')
        .select('item_id, learning_tags(name)')
        .in('item_id', chunk)
        .returns<CloudTagRow[]>()
      if (tagsError) throw tagsError
      return nextTagRows ?? []
    })
  ])

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const schedulesByPromptId = new Map(schedules.map((schedule) => [schedule.prompt_id, schedule]))
  const tagsByItemId = groupCloudTags(tagRows)

  return rows
    .map((row): ReviewCard | null => {
      const item = itemsById.get(row.item_id)
      if (!item) return null
      const schedule = schedulesByPromptId.get(row.prompt_id)
      return {
        schemaVersion: 1,
        id: row.prompt_id,
        userId: item.owner_user_id,
        collectionId: row.collection_id,
        externalId: item.external_id,
        title: item.title,
        frontMarkdown: row.front_markdown,
        backMarkdown: row.back_markdown,
        tags: tagsByItemId.get(row.item_id) ?? [],
        isArchived: false,
        dueAt: schedule?.due_at ?? row.due_at ?? item.created_at,
        lastRating: schedule?.last_rating ?? null,
        reps: schedule?.reps ?? 0,
        lapses: schedule?.lapses ?? 0,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      } satisfies ReviewCard
    })
    .filter((card): card is ReviewCard => Boolean(card))
}

async function createCloudCard(
  input: CreateLearningCardInput,
  externalId: string | null
): Promise<LearningCard> {
  const { client, user } = await requireCloudContext()
  const now = nowIso()
  const { data: item, error: itemError } = await client
    .from('learning_items')
    .insert({
      primary_collection_id: input.collectionId,
      owner_user_id: user.id,
      author_user_id: user.id,
      title: input.title.trim() || 'Neue Karte',
      source_kind: externalId ? 'imported' : 'manual',
      external_id: externalId,
      is_archived: false
    })
    .select('id')
    .single()
  if (itemError) throw itemError

  const itemId = String(item.id)
  const { data: prompt, error: promptError } = await client
    .from('learning_prompts')
    .insert({
      item_id: itemId,
      prompt_type: 'qa',
      front_markdown: input.frontMarkdown.trim(),
      back_markdown: input.backMarkdown.trim(),
      sort_index: 0,
      is_archived: false
    })
    .select('id')
    .single()
  if (promptError) throw promptError

  const promptId = String(prompt.id)
  await replaceCloudTags(client, user.id, itemId, input.tags)
  const { error: scheduleError } = await client
    .from('learning_prompt_schedules')
    .insert({
      user_id: user.id,
      prompt_id: promptId,
      due_at: now,
      reps: 0,
      lapses: 0,
      last_rating: null,
      last_reviewed_at: null
    })
  if (scheduleError) throw scheduleError

  return getCloudCard(promptId)
}

async function updateCloudCard(input: UpdateLearningCardInput): Promise<LearningCard> {
  const { client, user } = await requireCloudContext()
  const { data: prompt, error: promptError } = await client
    .from('learning_prompts')
    .select('id, item_id')
    .eq('id', input.id)
    .single()
  if (promptError) throw promptError
  const itemId = String(prompt.item_id)

  const { error: itemError } = await client
    .from('learning_items')
    .update({
      primary_collection_id: input.collectionId,
      title: input.title.trim() || 'Neue Karte'
    })
    .eq('id', itemId)
    .eq('owner_user_id', user.id)
  if (itemError) throw itemError

  const { error: updatePromptError } = await client
    .from('learning_prompts')
    .update({
      front_markdown: input.frontMarkdown.trim(),
      back_markdown: input.backMarkdown.trim()
    })
    .eq('id', input.id)
  if (updatePromptError) throw updatePromptError

  await replaceCloudTags(client, user.id, itemId, input.tags)
  return getCloudCard(input.id)
}

async function getCloudCard(promptId: string): Promise<LearningCard> {
  const { client, user } = await requireCloudContext()
  const { data: prompt, error: promptError } = await client
    .from('learning_prompts')
    .select('id, item_id, front_markdown, back_markdown, is_archived, created_at, updated_at')
    .eq('id', promptId)
    .eq('is_archived', false)
    .single<CloudPromptRow>()
  if (promptError) throw promptError

  const { data: item, error: itemError } = await client
    .from('learning_items')
    .select('id, primary_collection_id, owner_user_id, title, external_id, is_archived, created_at, updated_at')
    .eq('id', prompt.item_id)
    .eq('owner_user_id', user.id)
    .single<CloudItemRow>()
  if (itemError) throw itemError

  const [{ data: schedule, error: scheduleError }, tagRows] = await Promise.all([
    client
      .from('learning_prompt_schedules')
      .select('prompt_id, due_at, reps, lapses, last_rating')
      .eq('user_id', user.id)
      .eq('prompt_id', promptId)
      .maybeSingle<CloudScheduleRow>(),
    selectInChunks([item.id], async (chunk) => {
      const { data, error } = await client
        .from('learning_item_tags')
        .select('item_id, learning_tags(name)')
        .in('item_id', chunk)
        .returns<CloudTagRow[]>()
      if (error) throw error
      return data ?? []
    })
  ])
  if (scheduleError) throw scheduleError
  const tagsByItemId = groupCloudTags(tagRows)
  const card = {
    schemaVersion: 1,
    id: prompt.id,
    userId: item.owner_user_id,
    collectionId: item.primary_collection_id,
    externalId: item.external_id,
    title: item.title,
    frontMarkdown: prompt.front_markdown,
    backMarkdown: prompt.back_markdown,
    tags: tagsByItemId.get(item.id) ?? [],
    isArchived: item.is_archived || prompt.is_archived,
    dueAt: schedule?.due_at ?? prompt.created_at,
    lastRating: schedule?.last_rating ?? null,
    reps: schedule?.reps ?? 0,
    lapses: schedule?.lapses ?? 0,
    createdAt: prompt.created_at,
    updatedAt: prompt.updated_at > item.updated_at ? prompt.updated_at : item.updated_at
  } satisfies LearningCard
  if (!card) throw new Error(`Karte nicht gefunden: ${promptId}`)
  return card
}

async function replaceCloudTags(
  client: SupabaseClient,
  userId: string,
  itemId: string,
  tags: string[]
): Promise<void> {
  const normalizedTags = normalizeTags(tags)
  const { error: deleteError } = await client.from('learning_item_tags').delete().eq('item_id', itemId)
  if (deleteError) throw deleteError
  if (!normalizedTags.length) return

  const { error: upsertError } = await client
    .from('learning_tags')
    .upsert(
      normalizedTags.map((name) => ({ owner_user_id: userId, name })),
      { onConflict: 'owner_user_id,name' }
    )
  if (upsertError) throw upsertError

  const tagRows = await selectInChunks(normalizedTags, async (chunk) => {
    const { data, error } = await client
      .from('learning_tags')
      .select('id, name')
      .eq('owner_user_id', userId)
      .in('name', chunk)
    if (error) throw error
    return data ?? []
  })

  const { error: linkError } = await client
    .from('learning_item_tags')
    .insert(tagRows.map((tag) => ({ item_id: itemId, tag_id: String(tag.id) })))
  if (linkError) throw linkError
}

function groupCloudTags(rows: CloudTagRow[]): Map<string, string[]> {
  const tagsByItemId = new Map<string, string[]>()
  for (const row of rows) {
    const relation = row.learning_tags
    const tag = Array.isArray(relation) ? relation[0]?.name : relation?.name
    if (!tag) continue
    const tags = tagsByItemId.get(row.item_id) ?? []
    tags.push(tag)
    tagsByItemId.set(row.item_id, tags)
  }
  for (const [itemId, tags] of tagsByItemId) {
    tagsByItemId.set(itemId, normalizeTags(tags))
  }
  return tagsByItemId
}

async function listCloudReviewDays(): Promise<string[]> {
  const { client, user } = await requireCloudContext()
  const { data, error } = await client
    .from('review_events')
    .select('reviewed_at')
    .eq('user_id', user.id)
    .order('reviewed_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []).map((row) => localDateKey(new Date(String(row.reviewed_at))))
}

async function getCloudLearningDashboardSummary(): Promise<{
  dueCount: number
  totalCards: number
  collectionCount: number
}> {
  const { client } = await requireCloudContext()
  const { data, error } = await client.rpc('get_learning_dashboard_summary')
  if (error) throw error
  const summary = (data ?? {}) as {
    due_count?: number
    total_cards?: number
    collection_count?: number
  }
  return {
    dueCount: Number(summary.due_count ?? 0),
    totalCards: Number(summary.total_cards ?? 0),
    collectionCount: Number(summary.collection_count ?? 0)
  }
}

function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
}

async function selectInChunks<T>(
  values: string[],
  query: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const rows: T[] = []
  for (let index = 0; index < values.length; index += CLOUD_QUERY_CHUNK_SIZE) {
    rows.push(...await query(values.slice(index, index + CLOUD_QUERY_CHUNK_SIZE)))
  }
  return rows
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function formatDueIntervalLabel(nextDueAt: string): string {
  const diffMs = new Date(nextDueAt).getTime() - Date.now()
  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) return 'gleich nochmal'
  const days = Math.max(1, Math.round(minutes / 1440))
  return days === 1 ? 'morgen' : `in ${days} Tagen`
}

function calculateCloudStreakDays(activityDays: Set<string>): number {
  let streak = 0
  const cursor = new Date()
  while (activityDays.has(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function countCloudMissedDaysThisWeek(activityDays: Set<string>): number {
  const today = new Date()
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)
  let missed = 0
  for (let offset = 0; offset <= today.getDate() - monday.getDate(); offset += 1) {
    const cursor = new Date(monday)
    cursor.setDate(monday.getDate() + offset)
    if (!activityDays.has(localDateKey(cursor))) missed += 1
  }
  return missed
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function newId(): string {
  return crypto.randomUUID()
}
