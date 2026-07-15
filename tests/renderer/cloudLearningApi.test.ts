import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppApi, ExamDetails, ExamListItem } from '../../src/shared/ipc'
import type { ExamRevision } from '../../src/shared/schemas'

type QueryCall = {
  table: string
  operation: 'select' | 'eq' | 'in' | 'order' | 'range' | 'limit' | 'maybeSingle' | 'upsert'
  column?: string
  value?: unknown
  from?: number
  to?: number
}

type RpcCall = {
  name: string
  args: Record<string, unknown>
}

const now = '2026-07-05T12:00:00.000Z'
const userId = '11111111-1111-4111-8111-111111111111'
const collectionId = '22222222-2222-4222-8222-222222222222'

let queryCalls: QueryCall[] = []
let rpcCalls: RpcCall[] = []
let tableData: Record<string, unknown[]> = {}
let upsertCalls: Array<{ table: string; value: Record<string, unknown>; options?: Record<string, unknown> }> = []

const browserStoreKey = 'jura-wolpertinger-browser-dev-v1'

describe('cloud learning API', () => {
  beforeEach(() => {
    queryCalls = []
    rpcCalls = []
    tableData = {}
    upsertCalls = []
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createMemoryLocalStorage()
    })
    vi.resetModules()
  })

  it('loads cloud review batches through RPC and chunks follow-up ID queries', async () => {
    const batchSize = 125
    const prompts = Array.from({ length: batchSize }, (_, index) => ({
      prompt_id: uuidFor(index, 'prompt'),
      item_id: uuidFor(index, 'item'),
      collection_id: collectionId,
      front_markdown: `Vorderseite ${index + 1}`,
      back_markdown: `Rueckseite ${index + 1}`,
      due_at: now
    }))
    tableData = {
      learning_items: prompts.map((prompt, index) => ({
        id: prompt.item_id,
        primary_collection_id: collectionId,
        owner_user_id: userId,
        title: `Karte ${index + 1}`,
        external_id: `card-${index + 1}`,
        is_archived: false,
        created_at: now,
        updated_at: now
      })),
      learning_prompt_schedules: prompts.map((prompt) => ({
        prompt_id: prompt.prompt_id,
        due_at: now,
        reps: 0,
        lapses: 0,
        last_rating: null
      })),
      learning_item_tags: []
    }

    const authModulePath = '../../src/renderer/src/cloudAuth'
    vi.doMock(authModulePath, () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createLocalApiStub())
    const cards = await api.getReviewBatch({ limit: 100 })

    expect(cards).toHaveLength(batchSize)
    expect(rpcCalls).toEqual([
      {
        name: 'get_review_batch',
        args: {
          p_collection_ids: null,
          p_tag_ids: null,
          p_limit: 100,
          p_exclude_prompt_ids: []
        }
      }
    ])

    const inCalls = queryCalls.filter((call) => call.operation === 'in')
    expect(inCalls.length).toBeGreaterThan(0)
    expect(inCalls.every((call) => Array.isArray(call.value) && call.value.length <= 50)).toBe(true)
    expect(
      queryCalls.some((call) => (
        call.table === 'learning_items' &&
        call.operation === 'eq' &&
        call.column === 'owner_user_id'
      ))
    ).toBe(false)
  })

  it('loads collection summaries without fetching card details', async () => {
    tableData = {
      learning_collections: [
        {
          id: collectionId,
          owner_user_id: userId,
          name: 'Strafrecht',
          description_markdown: '',
          subject: 'Strafrecht',
          source: null,
          card_count: 301,
          due_count: 301,
          created_at: now,
          updated_at: now
        }
      ]
    }

    const authModulePath = '../../src/renderer/src/cloudAuth'
    vi.doMock(authModulePath, () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createLocalApiStub())
    const collections = await api.listLearningCollections()

    expect(collections).toMatchObject([
      {
        id: collectionId,
        cardCount: 301,
        dueCount: 301
      }
    ])
    expect(rpcCalls.map((call) => call.name)).toEqual(['get_learning_collection_summaries'])
    expect(queryCalls.some((call) => call.table === 'learning_items')).toBe(false)
    expect(queryCalls.some((call) => call.table === 'learning_prompts')).toBe(false)
  })

  it('loads and upserts the signed-in user profile', async () => {
    tableData = {
      user_profiles: [{
        user_id: userId,
        first_name: 'Sebastian',
        last_name: 'Erhardt',
        created_at: '2026-07-15T06:11:01.038141+00:00',
        updated_at: '2026-07-15T06:11:00.926+00:00'
      }]
    }

    const authModulePath = '../../src/renderer/src/cloudAuth'
    vi.doMock(authModulePath, () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createLocalApiStub())

    await expect(api.getUserProfile()).resolves.toMatchObject({
      userId,
      firstName: 'Sebastian',
      lastName: 'Erhardt'
    })
    await expect(api.updateUserProfile({ firstName: 'Sebi', lastName: 'E.' })).resolves.toMatchObject({
      userId,
      firstName: 'Sebi',
      lastName: 'E.'
    })

    expect(queryCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'user_profiles', operation: 'select' }),
      expect.objectContaining({ table: 'user_profiles', operation: 'eq', column: 'user_id', value: userId }),
      expect.objectContaining({ table: 'user_profiles', operation: 'upsert' })
    ]))
    expect(upsertCalls).toContainEqual(expect.objectContaining({
      table: 'user_profiles',
      value: expect.objectContaining({
        user_id: userId,
        first_name: 'Sebi',
        last_name: 'E.'
      })
    }))
  })

  it('loads cloud card pages with ranged item queries and page-local details', async () => {
    const total = 30
    const items = Array.from({ length: total }, (_, index) => ({
      id: uuidFor(index, 'item'),
      primary_collection_id: collectionId,
      owner_user_id: userId,
      title: `Karte ${String(index + 1).padStart(2, '0')}`,
      external_id: `card-${index + 1}`,
      is_archived: false,
      created_at: now,
      updated_at: now
    }))
    tableData = {
      learning_items: items,
      learning_prompts: items.map((item, index) => ({
        id: uuidFor(index, 'prompt'),
        item_id: item.id,
        front_markdown: `Vorderseite ${index + 1}`,
        back_markdown: `Rueckseite ${index + 1}`,
        is_archived: false,
        created_at: now,
        updated_at: now
      })),
      learning_prompt_schedules: items.map((_item, index) => ({
        prompt_id: uuidFor(index, 'prompt'),
        due_at: now,
        reps: 0,
        lapses: 0,
        last_rating: null
      })),
      learning_item_tags: []
    }

    const authModulePath = '../../src/renderer/src/cloudAuth'
    vi.doMock(authModulePath, () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createLocalApiStub())
    const page = await api.listLearningCardsPage({ collectionId, page: 2, pageSize: 10 })

    expect(page).toMatchObject({ total, page: 2, pageSize: 10, pageCount: 3 })
    expect(page.items).toHaveLength(10)
    expect(page.items[0].title).toBe('Karte 11')
    expect(queryCalls).toContainEqual({
      table: 'learning_items',
      operation: 'range',
      from: 10,
      to: 19
    })
    const promptIdCalls = queryCalls.filter((call) => call.table === 'learning_prompts' && call.operation === 'in')
    expect(promptIdCalls).toHaveLength(1)
    expect(promptIdCalls[0].value).toHaveLength(10)
  })

  it('stores browser exam revisions in the cloud snapshot and hydrates them in a fresh browser', async () => {
    const examId = '44444444-4444-4444-8444-444444444444'
    const uploadedText = 'Obersatz aus der Cloud-Klausur'
    writeBrowserStore(createBrowserStoreWithExam(examId, 'Lokaler Starttext'))

    vi.doMock('../../src/renderer/src/cloudAuth', () => ({
      getSupabaseAuthClient: () => createSupabaseClientMock()
    }))
    const apiModulePath = '../../src/renderer/src/cloudLearningApi'
    const { createCloudLearningApi } = (await import(/* @vite-ignore */ apiModulePath)) as {
      createCloudLearningApi: (localApi: AppApi) => AppApi
    }
    const api = createCloudLearningApi(createBrowserExamLocalApiStub())

    await api.saveRevision({
      examId,
      kind: 'autosave',
      content: tiptapDoc(uploadedText)
    })
    await waitForCondition(() => upsertCalls.length > 0)

    const uploadedSnapshot = upsertCalls.at(-1)?.value.payload_json
    expect(JSON.stringify(uploadedSnapshot)).toContain(uploadedText)
    expect(JSON.stringify(uploadedSnapshot)).toContain('"exam_revisions"')

    localStorage.removeItem(browserStoreKey)
    tableData.user_sync_snapshots = upsertCalls.map((call) => ({
      ...call.value,
      updated_at: now
    }))

    const hydrated = await api.getExam(examId)
    expect(JSON.stringify(hydrated.currentRevision?.content)).toContain(uploadedText)
  })
})

function createSupabaseClientMock() {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: {
              user: {
                id: userId,
                email: 'learner@example.test',
                created_at: now,
                updated_at: now,
                user_metadata: {}
              }
            }
          },
          error: null
        }
      }
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args })
      if (name === 'get_review_batch') {
        return {
          data: tableData.learning_items.map((item, index) => ({
            prompt_id: uuidFor(index, 'prompt'),
            item_id: String((item as { id: string }).id),
            collection_id: collectionId,
            front_markdown: `Vorderseite ${index + 1}`,
            back_markdown: `Rueckseite ${index + 1}`,
            due_at: now
          })),
          error: null
        }
      }
      if (name === 'get_learning_collection_summaries') {
        return {
          data: tableData.learning_collections,
          error: null
        }
      }
      if (name === 'get_learning_dashboard_summary') {
        return {
          data: {
            due_count: 301,
            total_cards: 301,
            collection_count: 1
          },
          error: null
        }
      }
      if (name === 'record_review') {
        return {
          data: {
            event_id: uuidFor(999, 'event'),
            due_at: now,
            reps: 1,
            lapses: 0
          },
          error: null
        }
      }
      return { data: null, error: null }
    },
    from(table: string) {
      return createQueryBuilder(table)
    }
  }
}

function createQueryBuilder(table: string) {
  let rows = [...(tableData[table] ?? [])]
  const builder = {
    select(_columns: string, _options?: { count?: string }) {
      queryCalls.push({ table, operation: 'select' })
      return builder
    },
    eq(column: string, value: unknown) {
      queryCalls.push({ table, operation: 'eq', column, value })
      rows = rows.filter((row) => (row as Record<string, unknown>)[column] === value)
      return builder
    },
    in(column: string, value: unknown[]) {
      queryCalls.push({ table, operation: 'in', column, value })
      const allowed = new Set(value)
      rows = rows.filter((row) => allowed.has((row as Record<string, unknown>)[column]))
      return builder
    },
    order(column: string) {
      queryCalls.push({ table, operation: 'order', column })
      return builder
    },
    range(from: number, to: number) {
      queryCalls.push({ table, operation: 'range', from, to })
      rows = rows.slice(from, to + 1)
      return builder
    },
    limit(value: number) {
      queryCalls.push({ table, operation: 'limit', value })
      rows = rows.slice(0, value)
      return builder
    },
    async maybeSingle<T>() {
      queryCalls.push({ table, operation: 'maybeSingle' })
      return { data: (rows[0] ?? null) as T | null, error: null }
    },
    async upsert(value: Record<string, unknown>, options?: Record<string, unknown>) {
      queryCalls.push({ table, operation: 'upsert', value })
      upsertCalls.push({ table, value, options })
      tableData[table] = [
        value,
        ...(tableData[table] ?? []).filter((row) => {
          const current = row as Record<string, unknown>
          return current.user_id !== value.user_id || current.local_user_id !== value.local_user_id
        })
      ]
      return { data: null, error: null }
    },
    async returns<T>() {
      return { data: rows as T, error: null, count: tableData[table]?.length ?? rows.length }
    }
  }
  return builder
}

function createLocalApiStub(): AppApi {
  return {
    getAppVersion: async () => '0.0.0',
    getFeatureFlags: unimplemented,
    createVoiceReviewSession: unimplemented,
    completeVoiceReviewSession: unimplemented,
    getUserProfile: unimplemented,
    updateUserProfile: unimplemented,
    getCurrentUser: unimplemented,
    listUsers: unimplemented,
    createUser: unimplemented,
    updateUser: unimplemented,
    switchUser: unimplemented,
    completeOnboarding: unimplemented,
    completeTour: unimplemented,
    resetTour: unimplemented,
    listFolders: unimplemented,
    createFolder: unimplemented,
    updateFolder: unimplemented,
    trashFolder: unimplemented,
    restoreFolder: unimplemented,
    listExams: unimplemented,
    listExamsPage: unimplemented,
    createExam: unimplemented,
    getExam: unimplemented,
    updateExam: unimplemented,
    trashExam: unimplemented,
    restoreExam: unimplemented,
    saveRevision: unimplemented,
    submitExam: unimplemented,
    getSubmission: unimplemented,
    listAnalyticsEntries: unimplemented,
    getAiSettingsStatus: unimplemented,
    saveAiSettings: unimplemented,
    removeAiSettings: unimplemented,
    testAiConnection: unimplemented,
    generateAiCorrectionDraft: unimplemented,
    listAiCorrectionDrafts: unimplemented,
    acceptAiCorrectionDraft: unimplemented,
    rejectAiCorrectionDraft: unimplemented,
    listLearningTasks: unimplemented,
    updateLearningTaskStatus: unimplemented,
    getLearningDashboard: unimplemented,
    exportLearningDecksJson: unimplemented,
    importLearningDecksJson: unimplemented,
    listLearningCollections: unimplemented,
    createLearningCollection: unimplemented,
    listLearningCards: unimplemented,
    listLearningCardsPage: unimplemented,
    createLearningCard: unimplemented,
    updateLearningCard: unimplemented,
    deleteLearningCard: unimplemented,
    getReviewBatch: unimplemented,
    recordReview: unimplemented,
    addAttachment: unimplemented,
    openAttachment: unimplemented,
    exportExamPackage: unimplemented,
    importExamPackage: unimplemented,
    exportExamPdf: unimplemented,
    createCorrection: unimplemented,
    updateCorrection: unimplemented,
    addInlineComment: unimplemented,
    getSyncStatus: unimplemented,
    connectSyncAccount: unimplemented,
    disconnectSyncAccount: unimplemented,
    runSync: unimplemented
  }
}

function createBrowserExamLocalApiStub(): AppApi {
  return {
    ...createLocalApiStub(),
    async listExams() {
      return readBrowserStore().exams
    },
    async listExamsPage() {
      const items = readBrowserStore().exams
      return {
        items,
        total: items.length,
        page: 1,
        pageSize: 25,
        pageCount: 1
      }
    },
    async getExam(id: string) {
      const store = readBrowserStore()
      const exam = store.exams.find((candidate) => candidate.id === id)
      if (!exam) throw new Error(`Exam not found: ${id}`)
      const currentRevision = store.revisions.find(
        (candidate) => candidate.id === exam.currentRevisionId
      ) ?? null
      return {
        ...exam,
        currentRevision,
        submissions: [],
        attachments: []
      } satisfies ExamDetails
    },
    async saveRevision(input) {
      const store = readBrowserStore()
      const exam = store.exams.find((candidate) => candidate.id === input.examId)
      if (!exam) throw new Error(`Exam not found: ${input.examId}`)
      const revision: ExamRevision = {
        schemaVersion: 1,
        editorSchemaVersion: 1,
        id: '55555555-5555-4555-8555-555555555555',
        userId: exam.userId,
        examId: input.examId,
        createdAt: now,
        kind: input.kind ?? 'autosave',
        contentFormat: 'tiptap-v1',
        contentHash: 'hash-after-save',
        content: input.content
      }
      store.revisions.push(revision)
      exam.currentRevisionId = revision.id
      exam.lastSavedAt = now
      exam.updatedAt = now
      writeBrowserStore(store)
      return revision
    }
  }
}

function createBrowserStoreWithExam(examId: string, text: string) {
  const revisionId = '33333333-3333-4333-8333-333333333333'
  const exam: ExamListItem = {
    id: examId,
    userId,
    title: 'Cloud Klausur',
    folderId: null,
    folderName: null,
    status: 'in_progress',
    tags: ['arbeitsrecht'],
    notes: '',
    createdAt: now,
    updatedAt: now,
    lastSavedAt: now,
    currentRevisionId: revisionId,
    latestScore: null,
    legalArea: null,
    examType: null,
    sourceName: null,
    sourceUrl: null
  }
  const revision: ExamRevision = {
    schemaVersion: 1,
    editorSchemaVersion: 1,
    id: revisionId,
    userId,
    examId,
    createdAt: now,
    kind: 'autosave',
    contentFormat: 'tiptap-v1',
    contentHash: 'hash-before-save',
    content: tiptapDoc(text)
  }
  return {
    users: [{
      id: userId,
      displayName: 'learner@example.test',
      kind: 'remote',
      remoteUserId: userId,
      onboardingCompletedAt: now,
      tourCompletedAt: now,
      createdAt: now,
      updatedAt: now
    }],
    currentUserId: userId,
    folders: [],
    exams: [exam],
    revisions: [revision],
    submissions: [],
    attachments: [],
    corrections: [],
    aiSettings: null,
    aiCorrectionDrafts: [],
    learningTasks: [],
    learningCollections: [],
    learningCards: [],
    learningReviewEvents: [],
    learningSchedules: []
  }
}

function tiptapDoc(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }]
      }
    ]
  }
}

function readBrowserStore(): ReturnType<typeof createBrowserStoreWithExam> {
  const raw = localStorage.getItem(browserStoreKey)
  if (!raw) throw new Error('Browser store is empty')
  return JSON.parse(raw)
}

function writeBrowserStore(store: ReturnType<typeof createBrowserStoreWithExam>): void {
  localStorage.setItem(browserStoreKey, JSON.stringify(store))
}

function createMemoryLocalStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    }
  }
}

async function waitForCondition(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 25; index += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for condition')
}

function unimplemented(): never {
  throw new Error('Unexpected local fallback call')
}

function uuidFor(index: number, kind: 'item' | 'prompt' | 'event'): string {
  const prefix = kind === 'item' ? '10000000' : kind === 'prompt' ? '20000000' : '30000000'
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, '0')}`
}
