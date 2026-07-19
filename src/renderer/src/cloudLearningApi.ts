import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js'
import type {
  AddInlineCommentInput,
  AppApi,
  CreateLearningCardInput,
  CreateLearningCollectionInput,
  CreateExamInput,
  DeleteLearningCardInput,
  GetReviewBatchInput,
  ListLearningCardsInput,
  PaginatedResult,
  RateLearningCardQualityInput,
  RecordReviewInput,
  RecordReviewResult,
  TrashFolderInput,
  UpdateCorrectionInput,
  UpdateExamInput,
  UpdateFolderInput,
  UpdateLearningCardInput
} from '@shared/ipc'
import type {
  Attachment,
  Correction,
  ExamRevision,
  Folder,
  InlineComment,
  LearningCard,
  LearningCardQualityEvent,
  LearningCollection,
  LearningDashboard,
  LearningImportResult,
  LearningReviewEvent,
  ReviewCard,
  ReviewRating,
  Submission,
  User,
  UserProfile
} from '@shared/schemas'
import {
  learningCardQualityReasonSchema,
  learningCardQualityStatusSchema,
  learningExportFileSchema,
  learningImportResultSchema,
  learningReviewEventSchema,
  reviewRatingSchema,
  userProfileSchema
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

type CloudQualityEventRow = {
  id: string
  user_id: string
  prompt_id: string
  status: 'good' | 'needs_work' | 'problematic'
  reasons: string[] | null
  note: string | null
  rated_at: string
  created_at: string
  updated_at: string
}

const CLOUD_QUERY_CHUNK_SIZE = 50
const BROWSER_STORE_KEY = 'jura-wolpertinger-browser-dev-v1'
const CLOUD_BROWSER_SNAPSHOT_MARKER_KEY = 'jura-wolpertinger-cloud-browser-snapshot-v1'

type CloudBrowserStore = {
  users: User[]
  currentUserId: string | null
  folders: Folder[]
  exams: Array<Record<string, unknown>>
  revisions: ExamRevision[]
  submissions: Submission[]
  attachments: Attachment[]
  corrections: Correction[]
  inlineComments?: InlineComment[]
  aiSettings: unknown | null
  aiCorrectionDrafts: unknown[]
  learningTasks: unknown[]
  learningCollections: unknown[]
  learningCards: unknown[]
  learningReviewEvents: unknown[]
  learningSchedules: unknown[]
}

let cloudBrowserSnapshotUploadPromise: Promise<void> | null = null
let cloudBrowserSnapshotUploadQueued = false

export function createCloudLearningApi(localApi: AppApi): AppApi {
  return {
    ...localApi,
    async getUserProfile() {
      return getCloudUserProfile()
    },
    async updateUserProfile(input) {
      return updateCloudUserProfile(input)
    },
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
    async listFolders() {
      await ensureCloudBrowserWorkspaceLoaded()
      return localApi.listFolders()
    },
    async createFolder(name: string, parentId?: string | null) {
      await ensureCloudBrowserWorkspaceLoaded()
      const folder = await localApi.createFolder(name, parentId)
      queueCloudBrowserSnapshotUpload()
      return folder
    },
    async updateFolder(input: UpdateFolderInput) {
      await ensureCloudBrowserWorkspaceLoaded()
      const folder = await localApi.updateFolder(input)
      queueCloudBrowserSnapshotUpload()
      return folder
    },
    async trashFolder(input: TrashFolderInput) {
      await ensureCloudBrowserWorkspaceLoaded()
      const folder = await localApi.trashFolder(input)
      queueCloudBrowserSnapshotUpload()
      return folder
    },
    async restoreFolder(folderId: string) {
      await ensureCloudBrowserWorkspaceLoaded()
      const folder = await localApi.restoreFolder(folderId)
      queueCloudBrowserSnapshotUpload()
      return folder
    },
    async listExams() {
      await ensureCloudBrowserWorkspaceLoaded()
      return localApi.listExams()
    },
    async listExamsPage(input = {}) {
      await ensureCloudBrowserWorkspaceLoaded()
      return localApi.listExamsPage(input)
    },
    async createExam(input: CreateExamInput) {
      await ensureCloudBrowserWorkspaceLoaded()
      const exam = await localApi.createExam(input)
      queueCloudBrowserSnapshotUpload()
      return exam
    },
    async getExam(id: string) {
      await ensureCloudBrowserWorkspaceLoaded()
      return localApi.getExam(id)
    },
    async updateExam(input: UpdateExamInput) {
      await ensureCloudBrowserWorkspaceLoaded()
      const exam = await localApi.updateExam(input)
      queueCloudBrowserSnapshotUpload()
      return exam
    },
    async trashExam(id: string) {
      await ensureCloudBrowserWorkspaceLoaded()
      const exam = await localApi.trashExam(id)
      queueCloudBrowserSnapshotUpload()
      return exam
    },
    async restoreExam(id: string) {
      await ensureCloudBrowserWorkspaceLoaded()
      const exam = await localApi.restoreExam(id)
      queueCloudBrowserSnapshotUpload()
      return exam
    },
    async saveRevision(input) {
      await ensureCloudBrowserWorkspaceLoaded()
      const revision = await localApi.saveRevision(input)
      queueCloudBrowserSnapshotUpload()
      return revision
    },
    async submitExam(examId: string) {
      await ensureCloudBrowserWorkspaceLoaded()
      const submission = await localApi.submitExam(examId)
      queueCloudBrowserSnapshotUpload()
      return submission
    },
    async getSubmission(id: string) {
      await ensureCloudBrowserWorkspaceLoaded()
      return localApi.getSubmission(id)
    },
    async listAnalyticsEntries() {
      await ensureCloudBrowserWorkspaceLoaded()
      return localApi.listAnalyticsEntries()
    },
    async createCorrection(submissionId: string) {
      await ensureCloudBrowserWorkspaceLoaded()
      const correction = await localApi.createCorrection(submissionId)
      queueCloudBrowserSnapshotUpload()
      return correction
    },
    async updateCorrection(input: UpdateCorrectionInput) {
      await ensureCloudBrowserWorkspaceLoaded()
      const correction = await localApi.updateCorrection(input)
      queueCloudBrowserSnapshotUpload()
      return correction
    },
    async addInlineComment(input: AddInlineCommentInput) {
      await ensureCloudBrowserWorkspaceLoaded()
      const comment = await localApi.addInlineComment(input)
      queueCloudBrowserSnapshotUpload()
      return comment
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
    async listLearningCardsPage(input: ListLearningCardsInput = {}) {
      return listCloudCardsPage(input)
    },
    async createLearningCard(input: CreateLearningCardInput) {
      return createCloudCard(input, null)
    },
    async updateLearningCard(input: UpdateLearningCardInput) {
      return updateCloudCard(input)
    },
    async deleteLearningCard(input: DeleteLearningCardInput) {
      return deleteCloudCard(input)
    },
    async getReviewBatch(input: GetReviewBatchInput = {}) {
      if (!input.tag) return listCloudReviewBatch(input)
      const cards = await listCloudCards(input.collectionId ?? null)
      const excluded = new Set(input.excludeCardIds ?? [])
      const now = nowIso()
      const limit = Math.min(Math.max(input.limit ?? 30, 1), 100)
      return cards
        .filter((card) => card.tags.includes(input.tag ?? ''))
        .filter((card) => !excluded.has(card.id))
        .filter((card) => card.qualityStatus !== 'needs_work' && card.qualityStatus !== 'problematic')
        .sort((left, right) => compareSuggestedReviewOrder(left.dueAt, right.dueAt, now))
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
    },
    async rateLearningCardQuality(input: RateLearningCardQualityInput) {
      return rateCloudCardQuality(input)
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
  const createdAt = normalizeCloudTimestamp(user.created_at)
  return {
    id: user.id,
    displayName: user.user_metadata?.display_name || user.email || 'Cloud-Nutzer',
    kind: 'remote',
    remoteUserId: user.id,
    onboardingCompletedAt: nowIso(),
    tourCompletedAt: nowIso(),
    createdAt,
    updatedAt: normalizeCloudTimestamp(user.updated_at, createdAt)
  }
}

async function getCloudUserProfile(): Promise<UserProfile> {
  const { client, user } = await requireCloudContext()
  const { data, error } = await client
    .from('user_profiles')
    .select('user_id, first_name, last_name, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return cloudUserProfileFromRow(data, user.id)
}

async function updateCloudUserProfile(input: { firstName: string | null; lastName: string | null }): Promise<UserProfile> {
  const { client, user } = await requireCloudContext()
  const { error } = await client
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      first_name: cleanProfileName(input.firstName),
      last_name: cleanProfileName(input.lastName),
      updated_at: nowIso()
    }, { onConflict: 'user_id' })
  if (error) throw error
  return getCloudUserProfile()
}

function cloudUserProfileFromRow(row: unknown, userId: string): UserProfile {
  const record = row && typeof row === 'object' ? row as Record<string, unknown> : {}
  const now = nowIso()
  return userProfileSchema.parse({
    userId,
    firstName: cleanProfileName(record.first_name),
    lastName: cleanProfileName(record.last_name),
    createdAt: normalizeCloudTimestamp(record.created_at, now),
    updatedAt: normalizeCloudTimestamp(record.updated_at, now)
  })
}

function cleanProfileName(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

function normalizeCloudTimestamp(value: unknown, fallback = nowIso()): string {
  if (typeof value !== 'string') return fallback
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? fallback : new Date(time).toISOString()
}

async function ensureCloudBrowserWorkspaceLoaded(): Promise<void> {
  const { client, user } = await requireCloudContext()
  const cloudUser = cloudUserFromSupabaseUser(user)
  const existingStore = readCloudBrowserStore()
  const marker = readCloudBrowserSnapshotMarker()

  if (existingStore && marker?.userId === user.id) {
    writeCloudBrowserStore(ensureCloudBrowserUser(existingStore, cloudUser))
    return
  }

  const { data, error } = await client
    .from('user_sync_snapshots')
    .select('payload_json,file_manifest_json,local_user_id,updated_at')
    .eq('user_id', user.id)
    .eq('local_user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error

  const payload = data?.payload_json as { browserStore?: unknown } | null | undefined
  const snapshotStore = parseCloudBrowserStore(payload?.browserStore)
  const store = ensureCloudBrowserUser(snapshotStore ?? existingStore ?? createEmptyCloudBrowserStore(), cloudUser)
  writeCloudBrowserStore(store)
  writeCloudBrowserSnapshotMarker({
    userId: user.id,
    updatedAt: String((data as { updated_at?: unknown } | null)?.updated_at ?? nowIso())
  })
}

function queueCloudBrowserSnapshotUpload(): void {
  if (cloudBrowserSnapshotUploadPromise) {
    cloudBrowserSnapshotUploadQueued = true
    return
  }
  cloudBrowserSnapshotUploadPromise = uploadCloudBrowserSnapshot()
    .catch((error: unknown) => {
      console.error('Online-Sicherung der Klausur ist fehlgeschlagen.', error)
    })
    .finally(() => {
      cloudBrowserSnapshotUploadPromise = null
      if (cloudBrowserSnapshotUploadQueued) {
        cloudBrowserSnapshotUploadQueued = false
        queueCloudBrowserSnapshotUpload()
      }
    })
}

async function uploadCloudBrowserSnapshot(): Promise<void> {
  const { client, user } = await requireCloudContext()
  const cloudUser = cloudUserFromSupabaseUser(user)
  const store = ensureCloudBrowserUser(
    readCloudBrowserStore() ?? createEmptyCloudBrowserStore(),
    cloudUser
  )
  writeCloudBrowserStore(store)

  const exportedAt = nowIso()
  const payload = {
    exportedAt,
    browserStore: sanitizeCloudBrowserStore(store),
    tables: buildCloudBrowserSnapshotTables(store, cloudUser)
  }
  const { error } = await client
    .from('user_sync_snapshots')
    .upsert(
      {
        user_id: user.id,
        local_user_id: user.id,
        snapshot_version: 1,
        payload_json: payload,
        file_manifest_json: []
      },
      { onConflict: 'user_id,local_user_id' }
    )
  if (error) throw error
  writeCloudBrowserSnapshotMarker({ userId: user.id, updatedAt: exportedAt })
}

function readCloudBrowserStore(): CloudBrowserStore | null {
  try {
    const raw = localStorage.getItem(BROWSER_STORE_KEY)
    if (!raw) return null
    return parseCloudBrowserStore(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeCloudBrowserStore(store: CloudBrowserStore): void {
  localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(store))
}

function readCloudBrowserSnapshotMarker(): { userId: string; updatedAt: string } | null {
  try {
    const raw = localStorage.getItem(CLOUD_BROWSER_SNAPSHOT_MARKER_KEY)
    if (!raw) return null
    const marker = JSON.parse(raw) as { userId?: unknown; updatedAt?: unknown }
    if (typeof marker.userId !== 'string') return null
    return {
      userId: marker.userId,
      updatedAt: typeof marker.updatedAt === 'string' ? marker.updatedAt : ''
    }
  } catch {
    return null
  }
}

function writeCloudBrowserSnapshotMarker(marker: { userId: string; updatedAt: string }): void {
  localStorage.setItem(CLOUD_BROWSER_SNAPSHOT_MARKER_KEY, JSON.stringify(marker))
}

function parseCloudBrowserStore(value: unknown): CloudBrowserStore | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<CloudBrowserStore>
  return {
    users: Array.isArray(record.users) ? record.users : [],
    currentUserId: typeof record.currentUserId === 'string' ? record.currentUserId : null,
    folders: Array.isArray(record.folders) ? record.folders : [],
    exams: Array.isArray(record.exams) ? record.exams as Array<Record<string, unknown>> : [],
    revisions: Array.isArray(record.revisions) ? record.revisions : [],
    submissions: Array.isArray(record.submissions) ? record.submissions : [],
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    corrections: Array.isArray(record.corrections) ? record.corrections : [],
    inlineComments: Array.isArray(record.inlineComments) ? record.inlineComments : [],
    aiSettings: record.aiSettings ?? null,
    aiCorrectionDrafts: Array.isArray(record.aiCorrectionDrafts) ? record.aiCorrectionDrafts : [],
    learningTasks: Array.isArray(record.learningTasks) ? record.learningTasks : [],
    learningCollections: Array.isArray(record.learningCollections) ? record.learningCollections : [],
    learningCards: Array.isArray(record.learningCards) ? record.learningCards : [],
    learningReviewEvents: Array.isArray(record.learningReviewEvents) ? record.learningReviewEvents : [],
    learningSchedules: Array.isArray(record.learningSchedules) ? record.learningSchedules : []
  }
}

function createEmptyCloudBrowserStore(): CloudBrowserStore {
  return {
    users: [],
    currentUserId: null,
    folders: [],
    exams: [],
    revisions: [],
    submissions: [],
    attachments: [],
    corrections: [],
    inlineComments: [],
    aiSettings: null,
    aiCorrectionDrafts: [],
    learningTasks: [],
    learningCollections: [],
    learningCards: [],
    learningReviewEvents: [],
    learningSchedules: []
  }
}

function ensureCloudBrowserUser(store: CloudBrowserStore, cloudUser: User): CloudBrowserStore {
  const oldUserId = store.currentUserId && store.currentUserId !== cloudUser.id
    ? store.currentUserId
    : null
  const next = {
    ...store,
    users: [
      cloudUser,
      ...store.users.filter((user) => user.id !== cloudUser.id && user.id !== oldUserId)
    ],
    currentUserId: cloudUser.id
  }
  if (oldUserId) {
    reassignCloudBrowserUserId(next, oldUserId, cloudUser.id)
  }
  return next
}

function reassignCloudBrowserUserId(store: CloudBrowserStore, fromUserId: string, toUserId: string): void {
  const arrays = [
    store.folders,
    store.exams,
    store.revisions,
    store.submissions,
    store.attachments,
    store.corrections,
    store.inlineComments ?? [],
    store.learningTasks as Array<Record<string, unknown>>,
    store.learningCollections as Array<Record<string, unknown>>,
    store.learningCards as Array<Record<string, unknown>>,
    store.learningReviewEvents as Array<Record<string, unknown>>,
    store.learningSchedules as Array<Record<string, unknown>>
  ]
  for (const rows of arrays) {
    for (const row of rows as Array<Record<string, unknown>>) {
      if (row.userId === fromUserId) row.userId = toUserId
    }
  }
}

function sanitizeCloudBrowserStore(store: CloudBrowserStore): CloudBrowserStore {
  return {
    ...store,
    aiSettings: store.aiSettings
      ? {
          provider: 'openai',
          configured: Boolean((store.aiSettings as { configured?: unknown }).configured),
          model: String((store.aiSettings as { model?: unknown }).model ?? ''),
          updatedAt: (store.aiSettings as { updatedAt?: unknown }).updatedAt ?? null
        }
      : null
  }
}

function buildCloudBrowserSnapshotTables(
  store: CloudBrowserStore,
  user: User
): Record<string, Array<Record<string, unknown>>> {
  const exams = store.exams.filter((exam) => exam.userId === user.id)
  const examIds = new Set(exams.map((exam) => String(exam.id)))
  const submissions = store.submissions.filter((submission) => submission.userId === user.id)
  const submissionIds = new Set(submissions.map((submission) => submission.id))
  const corrections = store.corrections.filter((correction) => correction.userId === user.id)
  const correctionIds = new Set(corrections.map((correction) => correction.id))
  const tagNames = normalizeTags(exams.flatMap((exam) => Array.isArray(exam.tags) ? exam.tags.map(String) : []))
  const tags = tagNames.map((name) => ({
    id: cloudBrowserTagId(user.id, name),
    user_id: user.id,
    name,
    created_at: user.createdAt
  }))

  return {
    users: [{
      id: user.id,
      display_name: user.displayName,
      kind: user.kind,
      remote_user_id: user.remoteUserId,
      onboarding_completed_at: user.onboardingCompletedAt,
      tour_completed_at: user.tourCompletedAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    }],
    folders: store.folders
      .filter((folder) => folder.userId === user.id)
      .map((folder) => ({
        id: folder.id,
        user_id: folder.userId,
        name: folder.name,
        parent_id: folder.parentId,
        trashed_at: folder.trashedAt,
        created_at: folder.createdAt,
        updated_at: folder.updatedAt
      })),
    tags,
    exam_tags: exams.flatMap((exam) =>
      (Array.isArray(exam.tags) ? normalizeTags(exam.tags.map(String)) : []).map((tag) => ({
        user_id: user.id,
        exam_id: exam.id,
        tag_id: cloudBrowserTagId(user.id, tag)
      }))
    ),
    exams: exams.map((exam) => ({
      id: exam.id,
      user_id: exam.userId,
      title: exam.title,
      folder_id: exam.folderId ?? null,
      status: exam.status,
      tags_json: JSON.stringify(Array.isArray(exam.tags) ? exam.tags : []),
      notes: exam.notes ?? '',
      legal_area: exam.legalArea ?? null,
      exam_type: exam.examType ?? null,
      source_name: exam.sourceName ?? null,
      source_url: exam.sourceUrl ?? null,
      current_revision_id: exam.currentRevisionId ?? null,
      created_at: exam.createdAt,
      updated_at: exam.updatedAt
    })),
    exam_revisions: store.revisions
      .filter((revision) => revision.userId === user.id && examIds.has(revision.examId))
      .map((revision) => ({
        id: revision.id,
        user_id: revision.userId,
        exam_id: revision.examId,
        created_at: revision.createdAt,
        kind: revision.kind,
        content_format: revision.contentFormat,
        content_hash: revision.contentHash,
        content_json: JSON.stringify(revision.content)
      })),
    submissions: submissions
      .filter((submission) => examIds.has(submission.examId))
      .map((submission) => ({
        id: submission.id,
        user_id: submission.userId,
        exam_id: submission.examId,
        submitted_at: submission.submittedAt,
        revision_id: submission.revisionId,
        content_hash: submission.contentHash,
        pdf_path: submission.pdfPath ?? null
      })),
    corrections: corrections
      .filter((correction) => submissionIds.has(correction.targetSubmissionId))
      .map((correction) => ({
        id: correction.id,
        user_id: correction.userId,
        submission_id: correction.targetSubmissionId,
        created_at: correction.createdAt,
        updated_at: correction.updatedAt,
        score_points: correction.score.points,
        grading_comment: correction.gradingComment,
        tags_json: JSON.stringify(correction.tags)
      })),
    inline_comments: (store.inlineComments ?? [])
      .filter((comment) => comment.userId === user.id && correctionIds.has(comment.correctionId))
      .map((comment) => ({
        id: comment.id,
        user_id: comment.userId,
        correction_id: comment.correctionId,
        submission_id: comment.targetSubmissionId,
        created_at: comment.createdAt,
        status: comment.status,
        body: comment.body,
        anchor_json: JSON.stringify(comment.anchor),
        tags_json: JSON.stringify(comment.tags)
      })),
    attachments: store.attachments
      .filter((attachment) => attachment.userId === user.id && examIds.has(attachment.examId))
      .map((attachment) => ({
        id: attachment.id,
        user_id: attachment.userId,
        exam_id: attachment.examId,
        original_name: attachment.originalName,
        stored_name: attachment.storedName,
        mime_type: attachment.mimeType,
        size: attachment.size,
        relative_path: attachment.relativePath,
        role: attachment.role,
        created_at: attachment.createdAt
      })),
    learning_tasks: [],
    learning_collections: [],
    learning_cards: [],
    learning_card_tags: [],
    learning_review_events: [],
    learning_card_schedules: [],
    learning_card_quality_events: []
  }
}

function cloudBrowserTagId(userId: string, tag: string): string {
  return `cloud-web-tag:${userId}:${tag}`
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

  const [tagRows, qualityByPromptId] = await Promise.all([
    selectInChunks(itemIds, async (chunk) => {
      const { data, error } = await client
        .from('learning_item_tags')
        .select('item_id, learning_tags(name)')
        .in('item_id', chunk)
        .returns<CloudTagRow[]>()
      if (error) throw error
      return data ?? []
    }),
    listLatestCloudQualityByPromptId(client, user.id, promptIds)
  ])

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const schedulesByPromptId = new Map((schedules ?? []).map((schedule) => [schedule.prompt_id, schedule]))
  const tagsByItemId = groupCloudTags(tagRows ?? [])

  return prompts
    .map((prompt) => {
      const item = itemsById.get(prompt.item_id)
      if (!item) return null
      const schedule = schedulesByPromptId.get(prompt.id)
      const quality = cloudQualityFor(qualityByPromptId.get(prompt.id))
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
        ...quality,
        createdAt: prompt.created_at,
        updatedAt: prompt.updated_at > item.updated_at ? prompt.updated_at : item.updated_at
      } satisfies LearningCard
    })
    .filter((card): card is LearningCard => Boolean(card))
}

async function listCloudCardsPage(
  input: ListLearningCardsInput = {}
): Promise<PaginatedResult<LearningCard>> {
  if (
    (input.quality && input.quality !== 'all') ||
    (input.lastRating && input.lastRating !== 'all') ||
    input.search?.trim()
  ) {
    const cards = applyCloudCardFilters(await listCloudCards(input.collectionId ?? null), input)
    return paginateCloudCards(sortCloudCardsPage(cards, input.sort), input)
  }

  const { client, user } = await requireCloudContext()
  const requestedPageSize = normalizeCloudPagination(1, input.pageSize, 0).pageSize
  const requestedPage = Math.max(Number(input.page) || 1, 1)
  const requestedOffset = (requestedPage - 1) * requestedPageSize
  let itemQuery = client
    .from('learning_items')
    .select('id, primary_collection_id, owner_user_id, title, external_id, is_archived, created_at, updated_at', {
      count: 'exact'
    })
    .eq('owner_user_id', user.id)
    .eq('is_archived', false)
  if (input.collectionId) itemQuery = itemQuery.eq('primary_collection_id', input.collectionId)
  const search = input.search?.trim()
  if (search) {
    itemQuery = itemQuery.ilike('title', `%${escapePostgrestLike(search)}%`)
  }
  const itemOrder = input.sort === 'title' ? 'title' : 'updated_at'
  const { data: items, error: itemsError, count } = await itemQuery
    .order(itemOrder, { ascending: input.sort === 'title' })
    .range(requestedOffset, requestedOffset + requestedPageSize - 1)
    .returns<CloudItemRow[]>()
  if (itemsError) throw itemsError

  const total = count ?? 0
  const normalized = normalizeCloudPagination(input.page, input.pageSize, total)
  if (!items?.length) {
    return {
      items: [],
      total,
      page: normalized.page,
      pageSize: normalized.pageSize,
      pageCount: normalized.pageCount
    }
  }

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

  const promptIds = prompts.map((prompt) => prompt.id)
  const [schedules, qualityByPromptId, tagRows] = await Promise.all([
    selectInChunks(promptIds, async (chunk) => {
      const { data, error } = await client
        .from('learning_prompt_schedules')
        .select('prompt_id, due_at, reps, lapses, last_rating')
        .eq('user_id', user.id)
        .in('prompt_id', chunk)
        .returns<CloudScheduleRow[]>()
      if (error) throw error
      return data ?? []
    }),
    listLatestCloudQualityByPromptId(client, user.id, promptIds),
    selectInChunks(itemIds, async (chunk) => {
      const { data, error } = await client
        .from('learning_item_tags')
        .select('item_id, learning_tags(name)')
        .in('item_id', chunk)
        .returns<CloudTagRow[]>()
      if (error) throw error
      return data ?? []
    })
  ])

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const schedulesByPromptId = new Map(schedules.map((schedule) => [schedule.prompt_id, schedule]))
  const tagsByItemId = groupCloudTags(tagRows)
  const cards = prompts
    .map((prompt) => {
      const item = itemsById.get(prompt.item_id)
      if (!item) return null
      const schedule = schedulesByPromptId.get(prompt.id)
      const quality = cloudQualityFor(qualityByPromptId.get(prompt.id))
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
        ...quality,
        createdAt: prompt.created_at,
        updatedAt: prompt.updated_at > item.updated_at ? prompt.updated_at : item.updated_at
      } satisfies LearningCard
    })
    .filter((card): card is LearningCard => Boolean(card))

  return {
    items: sortCloudCardsPage(cards, input.sort),
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
    pageCount: normalized.pageCount
  }
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
  const [items, schedules, qualityByPromptId, tagRows] = await Promise.all([
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
    listLatestCloudQualityByPromptId(client, user.id, promptIds),
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
      const quality = cloudQualityFor(qualityByPromptId.get(row.prompt_id))
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
        ...quality,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      } satisfies ReviewCard
    })
    .filter((card): card is ReviewCard => Boolean(card))
    .filter((card) => card.qualityStatus !== 'needs_work' && card.qualityStatus !== 'problematic')
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

async function deleteCloudCard(input: DeleteLearningCardInput): Promise<void> {
  const { client, user } = await requireCloudContext()
  const { data: prompt, error: promptError } = await client
    .from('learning_prompts')
    .select('id, item_id')
    .eq('id', input.id)
    .eq('is_archived', false)
    .single()
  if (promptError) throw promptError
  const itemId = String(prompt.item_id)

  const { error: promptArchiveError } = await client
    .from('learning_prompts')
    .update({ is_archived: true })
    .eq('id', input.id)
  if (promptArchiveError) throw promptArchiveError

  const { error: itemError } = await client
    .from('learning_items')
    .update({ is_archived: true })
    .eq('id', itemId)
    .eq('owner_user_id', user.id)
  if (itemError) throw itemError
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

  const [{ data: schedule, error: scheduleError }, tagRows, qualityByPromptId] = await Promise.all([
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
    }),
    listLatestCloudQualityByPromptId(client, user.id, [promptId])
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
    ...cloudQualityFor(qualityByPromptId.get(promptId)),
    createdAt: prompt.created_at,
    updatedAt: prompt.updated_at > item.updated_at ? prompt.updated_at : item.updated_at
  } satisfies LearningCard
  if (!card) throw new Error(`Karte nicht gefunden: ${promptId}`)
  return card
}

async function rateCloudCardQuality(input: RateLearningCardQualityInput): Promise<LearningCard> {
  const { client, user } = await requireCloudContext()
  const now = nowIso()
  const status = learningCardQualityStatusSchema.parse(input.status)
  const reasons = input.reasons.map((reason) => learningCardQualityReasonSchema.parse(reason))
  const { error } = await client
    .from('learning_card_quality_events')
    .insert({
      user_id: user.id,
      prompt_id: input.cardId,
      status,
      reasons,
      note: input.note?.trim() ?? '',
      rated_at: now
    })
  if (error) throw error
  return getCloudCard(input.cardId)
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

async function listLatestCloudQualityByPromptId(
  client: SupabaseClient,
  userId: string,
  promptIds: string[]
): Promise<Map<string, CloudQualityEventRow>> {
  if (!promptIds.length) return new Map()
  const rows = await selectInChunks(unique(promptIds), async (chunk) => {
    const { data, error } = await client
      .from('learning_card_quality_events')
      .select('id, user_id, prompt_id, status, reasons, note, rated_at, created_at, updated_at')
      .eq('user_id', userId)
      .in('prompt_id', chunk)
      .order('rated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<CloudQualityEventRow[]>()
    if (error) throw error
    return data ?? []
  })
  const latest = new Map<string, CloudQualityEventRow>()
  for (const row of rows) {
    if (!latest.has(row.prompt_id)) latest.set(row.prompt_id, row)
  }
  return latest
}

function cloudQualityFor(
  event: CloudQualityEventRow | undefined
): Pick<LearningCard, 'qualityStatus' | 'qualityReasons' | 'qualityNote' | 'qualityRatedAt'> {
  return {
    qualityStatus: event?.status ?? null,
    qualityReasons: event?.reasons?.map((reason) => learningCardQualityReasonSchema.parse(reason)) ?? [],
    qualityNote: event?.note ?? '',
    qualityRatedAt: event?.rated_at ?? null
  }
}

function applyCloudCardFilters(cards: LearningCard[], input: ListLearningCardsInput): LearningCard[] {
  const search = input.search?.trim().toLocaleLowerCase('de-DE') ?? ''
  return cards
    .filter((card) => {
      if (!search) return true
      return [card.title, card.frontMarkdown, card.backMarkdown, ...card.tags]
        .join(' ')
        .toLocaleLowerCase('de-DE')
        .includes(search)
    })
    .filter((card) => {
      if (!input.quality || input.quality === 'all') return true
      return input.quality === 'unrated' ? !card.qualityStatus : card.qualityStatus === input.quality
    })
    .filter((card) => {
      if (!input.lastRating || input.lastRating === 'all') return true
      return input.lastRating === 'unrated' ? card.lastRating === null : card.lastRating === input.lastRating
    })
}

function paginateCloudCards(cards: LearningCard[], input: ListLearningCardsInput): PaginatedResult<LearningCard> {
  const pagination = normalizeCloudPagination(input.page, input.pageSize, cards.length)
  return {
    items: cards.slice(pagination.offset, pagination.offset + pagination.pageSize),
    total: cards.length,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount: pagination.pageCount
  }
}

function normalizeCloudPagination(
  requestedPage: number | undefined,
  requestedPageSize: number | undefined,
  total: number
): { page: number; pageSize: number; pageCount: number; offset: number } {
  const allowedPageSizes = [10, 25, 50, 100]
  const pageSize = allowedPageSizes.includes(Number(requestedPageSize)) ? Number(requestedPageSize) : 25
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(Number(requestedPage) || 1, 1), pageCount)
  return {
    page,
    pageSize,
    pageCount,
    offset: (page - 1) * pageSize
  }
}

function escapePostgrestLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function sortCloudCardsPage(cards: LearningCard[], sort: ListLearningCardsInput['sort']): LearningCard[] {
  return [...cards].sort((left, right) => {
    if (sort === 'title') return left.title.localeCompare(right.title, 'de-DE')
    if (sort === 'due') return left.dueAt.localeCompare(right.dueAt)
    if (sort === 'rating') return (right.lastRating ?? 0) - (left.lastRating ?? 0)
    return right.updatedAt.localeCompare(left.updatedAt)
  })
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

function compareSuggestedReviewOrder(leftDueAt: string, rightDueAt: string, now: string): number {
  const leftFuture = leftDueAt > now ? 1 : 0
  const rightFuture = rightDueAt > now ? 1 : 0
  if (leftFuture !== rightFuture) return leftFuture - rightFuture
  return leftDueAt.localeCompare(rightDueAt)
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
